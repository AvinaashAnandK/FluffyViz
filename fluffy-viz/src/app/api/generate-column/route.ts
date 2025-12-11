/**
 * API route for AI column generation
 * Handles batch processing of rows with AI inference
 * Supports web search augmentation when enabled
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateCompletion, generateStructuredCompletion, interpolatePromptForRow } from '@/lib/ai-inference'
import {
  getProviderApiKey,
  isProviderEnabled,
  type ProviderKey,
} from '@/config/provider-settings'
import { loadProviderSettingsServer } from '@/lib/provider-config-server'
import { loadModelRegistryServer, getModelById } from '@/lib/model-registry-server'
import type { OutputSchema } from '@/types/structured-output'
import type { WebSearchConfig, SearchSource } from '@/types/web-search'

interface BatchResult {
  content: string
  error?: string
  errorType?: string
  rowIndex: number
  sources?: SearchSource[]
  warning?: string
}

export async function POST(req: NextRequest) {
  try {
    const {
      providerId,
      modelId,
      prompt,
      rows,
      temperature = 0.7,
      maxTokens = 500,
      outputSchema,
      webSearch,
    } = await req.json()

    const isStructuredOutput = outputSchema?.mode === 'structured' && outputSchema?.fields?.length > 0
    const webSearchEnabled = webSearch?.enabled === true

    console.log('[Generate Column] Request:', {
      providerId,
      modelId,
      rowCount: rows?.length,
      hasPrompt: !!prompt,
      isStructuredOutput,
      fieldCount: outputSchema?.fields?.length || 0,
      webSearchEnabled,
      webSearchContextSize: webSearch?.contextSize,
    })

    // Validate required fields
    if (!providerId || !modelId || !prompt || !rows) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, modelId, prompt, rows' },
        { status: 400 }
      )
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { error: 'rows must be a non-empty array' },
        { status: 400 }
      )
    }

    // Load provider config (server-side)
    const config = await loadProviderSettingsServer()

    // Load model registry (server-side)
    await loadModelRegistryServer()

    // Validate provider is enabled
    if (!isProviderEnabled(config, providerId as ProviderKey)) {
      return NextResponse.json(
        { error: `Provider ${providerId} is not enabled or configured` },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey = getProviderApiKey(config, providerId as ProviderKey)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Provider API key not found' },
        { status: 400 }
      )
    }

    console.log('[Generate Column] API key found:', apiKey.substring(0, 10) + '...')

    // Get model config
    const modelConfig = getModelById(modelId)
    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found` },
        { status: 404 }
      )
    }

    // Validate web search compatibility
    if (webSearchEnabled && !modelConfig.searchSupport) {
      console.warn(`[Generate Column] Web search enabled but model ${modelId} does not support it`)
    }

    // Warn about large batch with web search
    if (webSearchEnabled && rows.length > 50) {
      console.warn(`[Generate Column] Web search enabled for ${rows.length} rows - may incur significant API costs`)
    }

    console.log('[Generate Column] Processing', rows.length, 'rows', webSearchEnabled ? 'with web search' : '')

    // Process rows in batches for parallelization
    // Use provider-specific batch size if configured, otherwise default to 5
    // Reduce batch size when web search is enabled to avoid rate limits
    const providerConfig = config.providers[providerId as ProviderKey]
    const defaultBatchSize = webSearchEnabled ? 3 : 5
    const BATCH_SIZE = providerConfig?.batchSize ?? defaultBatchSize
    const results: BatchResult[] = []

    console.log(`[Generate Column] Using batch size: ${BATCH_SIZE}`)

    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length)
      const batch = rows.slice(batchStart, batchEnd)

      console.log(`[Generate Column] Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1} (rows ${batchStart + 1}-${batchEnd})`)

      // Process batch in parallel
      const batchPromises = batch.map(async (row, batchIndex) => {
        const rowIndex = batchStart + batchIndex

        try {
          const interpolatedPrompt = interpolatePromptForRow(prompt, row)

          console.log(`[Generate Column] Row ${rowIndex + 1}/${rows.length} - Prompt length:`, interpolatedPrompt.length, isStructuredOutput ? '(structured)' : '(text)', webSearchEnabled ? '(web search)' : '')

          let result
          if (isStructuredOutput) {
            // Use structured completion for JSON output
            result = await generateStructuredCompletion({
              model: { id: modelId, name: modelConfig.name },
              provider: {
                id: providerId,
                name: providerId,
                apiKey: apiKey,
                displayName: (modelConfig as any).provider || providerId
              },
              prompt: interpolatedPrompt,
              temperature,
              maxTokens,
              outputSchema: outputSchema as OutputSchema,
              webSearch: webSearch as WebSearchConfig | undefined,
            }, modelConfig)
          } else {
            // Use regular text completion
            result = await generateCompletion({
              model: { id: modelId, name: modelConfig.name },
              provider: {
                id: providerId,
                name: providerId,
                apiKey: apiKey,
                displayName: (modelConfig as any).provider || providerId
              },
              prompt: interpolatedPrompt,
              temperature,
              maxTokens,
              webSearch: webSearch as WebSearchConfig | undefined,
            }, modelConfig)
          }

          if (result.error) {
            console.error(`[Generate Column] Row ${rowIndex + 1} error:`, result.error)
          } else {
            console.log(`[Generate Column] Row ${rowIndex + 1} success - Content length:`, result.content.length, result.sources ? `(${result.sources.length} sources)` : '')
          }

          return {
            content: result.content,
            error: result.error,
            errorType: result.errorType,
            rowIndex,
            sources: result.sources,
            warning: result.warning,
          } as BatchResult
        } catch (rowError) {
          console.error(`[Generate Column] Row ${rowIndex + 1} exception:`, rowError)
          return {
            content: '',
            error: rowError instanceof Error ? rowError.message : 'Unknown error',
            rowIndex
          } as BatchResult
        }
      })

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      console.log(`[Generate Column] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1} completed`)

      // Add a small delay between batches when web search is enabled to avoid rate limits
      if (webSearchEnabled && batchEnd < rows.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // Calculate summary statistics
    const succeeded = results.filter(r => !r.error).length
    const failed = results.filter(r => r.error).length
    const warnings = results.filter(r => r.warning).length

    console.log('[Generate Column] Completed - Success:', succeeded, 'Failed:', failed, 'Warnings:', warnings)

    return NextResponse.json({
      results,
      summary: {
        total: rows.length,
        succeeded,
        failed,
        warnings,
        webSearchEnabled,
      }
    })
  } catch (error) {
    console.error('[Generate Column] API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

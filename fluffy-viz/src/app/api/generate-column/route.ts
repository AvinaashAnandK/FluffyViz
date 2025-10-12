/**
 * API route for AI column generation
 * Handles batch processing of rows with AI inference
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateCompletion, interpolatePromptForRow } from '@/lib/ai-inference'
import {
  getProviderApiKey,
  isProviderEnabled,
  type ProviderKey,
} from '@/config/provider-settings'
import { loadProviderSettingsServer } from '@/lib/provider-config-server'
import { loadModelRegistryServer, getModelById } from '@/lib/model-registry-server'

export async function POST(req: NextRequest) {
  try {
    const {
      providerId,
      modelId,
      prompt,
      rows,
      temperature = 0.7,
      maxTokens = 500,
    } = await req.json()

    console.log('[Generate Column] Request:', {
      providerId,
      modelId,
      rowCount: rows?.length,
      hasPrompt: !!prompt
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

    console.log('[Generate Column] Processing', rows.length, 'rows')

    // Process rows in batches for parallelization
    const BATCH_SIZE = 5
    const results: Array<{ content: string; error?: string; rowIndex: number }> = []

    for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length)
      const batch = rows.slice(batchStart, batchEnd)

      console.log(`[Generate Column] Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1} (rows ${batchStart + 1}-${batchEnd})`)

      // Process batch in parallel
      const batchPromises = batch.map(async (row, batchIndex) => {
        const rowIndex = batchStart + batchIndex

        try {
          const interpolatedPrompt = interpolatePromptForRow(prompt, row)

          console.log(`[Generate Column] Row ${rowIndex + 1}/${rows.length} - Prompt length:`, interpolatedPrompt.length)

          const result = await generateCompletion({
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
          })

          if (result.error) {
            console.error(`[Generate Column] Row ${rowIndex + 1} error:`, result.error)
          } else {
            console.log(`[Generate Column] Row ${rowIndex + 1} success - Content length:`, result.content.length)
          }

          return { ...result, rowIndex }
        } catch (rowError) {
          console.error(`[Generate Column] Row ${rowIndex + 1} exception:`, rowError)
          return {
            content: '',
            error: rowError instanceof Error ? rowError.message : 'Unknown error',
            rowIndex
          }
        }
      })

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      console.log(`[Generate Column] Batch ${Math.floor(batchStart / BATCH_SIZE) + 1} completed`)
    }

    console.log('[Generate Column] Completed - Success:', results.filter(r => !r.error).length, 'Errors:', results.filter(r => r.error).length)

    return NextResponse.json({ results })
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

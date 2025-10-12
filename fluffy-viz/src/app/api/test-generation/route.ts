/**
 * Test API route for AI generation
 * Tests the complete flow: provider config → model registry → AI SDK
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateCompletion } from '@/lib/ai-inference'
import {
  getProviderApiKey,
  isProviderEnabled,
  hasCapability,
  type ProviderKey,
} from '@/config/provider-settings'
import { loadProviderSettingsServer } from '@/lib/provider-config-server'
import { loadModelRegistryServer, getModelById } from '@/lib/model-registry-server'

export async function POST(req: NextRequest) {
  try {
    const { providerId, modelId, prompt, temperature, maxTokens } = await req.json()

    console.log('[Test Generation] Request:', { providerId, modelId, prompt })

    // Validate required fields
    if (!providerId || !modelId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, modelId, prompt' },
        { status: 400 }
      )
    }

    // Load provider config (server-side)
    const config = await loadProviderSettingsServer()

    // Validate provider is enabled
    if (!isProviderEnabled(config, providerId as ProviderKey)) {
      return NextResponse.json(
        { error: `Provider ${providerId} is not enabled or configured` },
        { status: 400 }
      )
    }

    // Validate provider has text capability
    if (!hasCapability(config, providerId as ProviderKey, 'text')) {
      return NextResponse.json(
        { error: `Provider ${providerId} does not have text generation capability enabled` },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey = getProviderApiKey(config, providerId as ProviderKey)
    if (!apiKey) {
      return NextResponse.json(
        { error: `Provider ${providerId} API key not found` },
        { status: 400 }
      )
    }

    console.log('[Test Generation] API key found:', apiKey.substring(0, 10) + '...')

    // Load model registry and get model config (server-side)
    await loadModelRegistryServer()
    const modelConfig = getModelById(modelId)
    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found in registry` },
        { status: 404 }
      )
    }

    console.log('[Test Generation] Model config:', {
      id: modelConfig.id,
      name: modelConfig.name,
      type: modelConfig.type
    })

    // Call AI inference
    const result = await generateCompletion({
      model: {
        id: modelId,
        name: modelConfig.name
      },
      provider: {
        id: providerId,
        name: providerId,
        displayName: providerId,
        apiKey: apiKey,
      },
      prompt: prompt,
      temperature: temperature ?? 0.7,
      maxTokens: maxTokens ?? 500,
    })

    console.log('[Test Generation] Result:', {
      contentLength: result.content.length,
      hasError: !!result.error
    })

    if (result.error) {
      return NextResponse.json(
        { error: result.error, content: result.content },
        { status: 500 }
      )
    }

    return NextResponse.json({
      content: result.content,
      model: modelConfig.name,
      provider: providerId
    })
  } catch (error) {
    console.error('[Test Generation] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

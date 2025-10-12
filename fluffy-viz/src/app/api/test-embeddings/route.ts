/**
 * Test API route for embeddings and similarity
 * Tests the complete flow: provider config → model registry → embedding generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateEmbeddings } from '@/lib/ai-inference'
import {
  getProviderApiKey,
  isProviderEnabled,
  hasCapability,
  type ProviderKey,
} from '@/config/provider-settings'
import { loadProviderSettingsServer } from '@/lib/provider-config-server'
import { loadModelRegistryServer, getModelById } from '@/lib/model-registry-server'

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

export async function POST(req: NextRequest) {
  try {
    const { providerId, modelId, texts, queryText } = await req.json()

    console.log('[Test Embeddings] Request:', {
      providerId,
      modelId,
      textsCount: texts?.length,
      hasQueryText: !!queryText
    })

    // Validate required fields
    if (!providerId || !modelId || !texts || !queryText) {
      return NextResponse.json(
        { error: 'Missing required fields: providerId, modelId, texts, queryText' },
        { status: 400 }
      )
    }

    if (!Array.isArray(texts) || texts.length === 0) {
      return NextResponse.json(
        { error: 'texts must be a non-empty array' },
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

    // Validate provider has embedding capability
    if (!hasCapability(config, providerId as ProviderKey, 'embedding')) {
      return NextResponse.json(
        { error: `Provider ${providerId} does not have embedding capability enabled` },
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

    console.log('[Test Embeddings] API key found:', apiKey.substring(0, 10) + '...')

    // Load model registry and get model config (server-side)
    await loadModelRegistryServer()
    const modelConfig = getModelById(modelId)
    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found in registry` },
        { status: 404 }
      )
    }

    console.log('[Test Embeddings] Model config:', {
      id: modelConfig.id,
      name: modelConfig.name,
      type: modelConfig.type
    })

    // Generate embeddings for all texts (static + query)
    const allTexts = [...texts, queryText]
    const embeddings = await generateEmbeddings(
      allTexts,
      providerId as ProviderKey,
      modelId,
      apiKey
    )

    console.log('[Test Embeddings] Generated embeddings:', {
      count: embeddings.length,
      dimensionality: embeddings[0]?.length
    })

    // Extract query embedding (last one)
    const queryEmbedding = embeddings[embeddings.length - 1]
    const staticEmbeddings = embeddings.slice(0, -1)

    // Calculate similarities
    const similarities = staticEmbeddings.map((embedding, index) => ({
      text: texts[index],
      similarity: cosineSimilarity(queryEmbedding, embedding)
    }))

    // Sort by similarity descending
    similarities.sort((a, b) => b.similarity - a.similarity)

    console.log('[Test Embeddings] Similarities calculated:', {
      count: similarities.length,
      topScore: similarities[0]?.similarity
    })

    return NextResponse.json({
      queryText,
      similarities,
      model: modelConfig.name,
      provider: providerId,
      embeddingDimension: queryEmbedding.length
    })
  } catch (error) {
    console.error('[Test Embeddings] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

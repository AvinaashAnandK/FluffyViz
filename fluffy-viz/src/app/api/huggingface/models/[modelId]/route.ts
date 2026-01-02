/**
 * API route for fetching detailed HuggingFace model info
 * Including inference provider mappings
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  HFModelInfo,
  HFModelInfoResponse,
  HFInferenceProvider,
  HFInferenceProviderMap,
} from '@/types/huggingface'
import { formatParameterCount, HF_PROVIDER_DISPLAY_NAMES, HF_INFERENCE_PROVIDERS } from '@/types/huggingface'

// Simple in-memory cache with TTL
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() })
}

/**
 * Fetch model info from HF Hub API with inference provider mapping
 */
async function fetchModelInfo(modelId: string): Promise<HFModelInfo> {
  const cacheKey = `model:${modelId}`
  const cached = getCached<HFModelInfo>(cacheKey)
  if (cached) {
    return cached
  }

  // HuggingFace API expects the model ID with slash in the URL path
  // e.g., /api/models/meta-llama/Llama-3.1-8B-Instruct
  // Do NOT encode the slash - only encode special characters within each part
  const url = `https://huggingface.co/api/models/${modelId}?expand[]=inferenceProviderMapping&expand[]=safetensors&expand[]=cardData`

  console.log('[HF Model Info API] Fetching:', url)

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
    next: { revalidate: 300 },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[HF Model Info API] Error:', response.status, errorText)
    throw new Error(`Model not found: ${modelId}`)
  }

  const model = await response.json()

  // Transform inference provider mapping to our format
  const providerMap = model.inferenceProviderMapping as HFInferenceProviderMap | undefined
  const inferenceProviders: HFInferenceProvider[] = []

  if (providerMap) {
    for (const [providerId, mapping] of Object.entries(providerMap)) {
      if (mapping.status === 'live') {
        // Get display name, fallback to providerId with title case
        const displayName = HF_PROVIDER_DISPLAY_NAMES[providerId as keyof typeof HF_PROVIDER_DISPLAY_NAMES]
          || providerId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

        inferenceProviders.push({
          id: providerId,
          name: displayName,
          providerModelId: mapping.provider_id,
          status: mapping.status,
          task: mapping.task,
        })
      }
    }
  }

  // Sort providers: known providers first (by our list order), then alphabetically
  inferenceProviders.sort((a, b) => {
    const aIndex = HF_INFERENCE_PROVIDERS.indexOf(a.id as any)
    const bIndex = HF_INFERENCE_PROVIDERS.indexOf(b.id as any)

    // Both known: sort by our preferred order
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    // One known: known first
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    // Neither known: alphabetical
    return a.name.localeCompare(b.name)
  })

  // Get parameter count from safetensors
  const paramCount = model.safetensors?.total ?? model.config?.num_parameters ?? null

  const modelInfo: HFModelInfo = {
    id: model.id || model.modelId,
    author: model.author || model.id?.split('/')[0],
    downloads: model.downloads,
    likes: model.likes,
    pipelineTag: model.pipeline_tag || model.pipelineTag,
    parameterCount: paramCount,
    parameterCountFormatted: formatParameterCount(paramCount),
    inferenceProviders,
    lastModified: model.lastModified,
    description: model.cardData?.description,
    cardData: model.cardData,
  }

  setCache(cacheKey, modelInfo)
  return modelInfo
}

/**
 * GET /api/huggingface/models/[modelId]
 *
 * Returns detailed model info including available inference providers
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
) {
  try {
    // Await the params since it's a Promise in Next.js 15
    const { modelId } = await params

    // Decode the model ID (it may contain slashes encoded as %2F)
    const decodedModelId = decodeURIComponent(modelId)

    console.log('[HF Model Info API] Request for:', decodedModelId)

    const model = await fetchModelInfo(decodedModelId)

    console.log('[HF Model Info API] Found', model.inferenceProviders.length, 'providers for', decodedModelId)

    const response: HFModelInfoResponse = { model }
    return NextResponse.json(response)
  } catch (error) {
    console.error('[HF Model Info API] Error:', error)

    return NextResponse.json(
      {
        model: null as any,
        error: error instanceof Error ? error.message : 'Failed to fetch model info',
      } as HFModelInfoResponse,
      { status: 404 }
    )
  }
}

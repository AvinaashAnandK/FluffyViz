/**
 * API route for searching HuggingFace models with inference provider support
 * Proxies requests to HF Hub API and caches results
 */

import { NextRequest, NextResponse } from 'next/server'
import type {
  HFModelSearchResult,
  HFModelsResponse,
  HFInferenceProviderMap,
} from '@/types/huggingface'
import { formatParameterCount } from '@/types/huggingface'

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
 * Fetch models from HF Hub API with inference provider filtering
 */
async function fetchHFModels(params: {
  query?: string
  pipelineTag?: string
  limit?: number
  sort?: string
}): Promise<HFModelSearchResult[]> {
  const { query, pipelineTag = 'text-generation', limit = 20, sort = 'downloads' } = params

  // Build HF Hub API URL
  const url = new URL('https://huggingface.co/api/models')
  url.searchParams.set('inference_provider', 'all')
  url.searchParams.set('pipeline_tag', pipelineTag)
  url.searchParams.set('sort', sort)
  url.searchParams.set('direction', '-1')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('full', 'true')
  // Request inference provider mapping to get provider counts
  url.searchParams.append('expand[]', 'inferenceProviderMapping')
  url.searchParams.append('expand[]', 'safetensors')

  if (query) {
    url.searchParams.set('search', query)
  }

  const cacheKey = url.toString()
  const cached = getCached<any[]>(cacheKey)
  if (cached) {
    return transformModels(cached)
  }

  console.log('[HF API] Fetching models:', url.toString())

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
    next: { revalidate: 300 }, // Next.js cache for 5 minutes
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[HF API] Error:', response.status, errorText)
    throw new Error(`HuggingFace API error: ${response.status}`)
  }

  const models = await response.json()
  setCache(cacheKey, models)

  return transformModels(models)
}

/**
 * Transform raw HF API response to our format
 */
function transformModels(models: any[]): HFModelSearchResult[] {
  return models.map(model => {
    // Count live inference providers
    const providerMap = model.inferenceProviderMapping as HFInferenceProviderMap | undefined
    let liveProviders = 0

    if (providerMap && Object.keys(providerMap).length > 0) {
      // Count providers with 'live' status
      liveProviders = Object.entries(providerMap).filter(([_, v]) => v.status === 'live').length
    } else {
      // If no mapping but model was returned by inference_provider=all filter,
      // assume at least 1 provider (we'll get details when user selects the model)
      liveProviders = 1
    }

    // Get parameter count from safetensors if available
    const paramCount = model.safetensors?.total ?? model.config?.num_parameters ?? null

    return {
      id: model.id || model.modelId,
      name: model.id?.split('/').pop() || model.id,
      author: model.author || model.id?.split('/')[0],
      downloads: model.downloads,
      likes: model.likes,
      pipelineTag: model.pipeline_tag || model.pipelineTag,
      parameterCount: paramCount,
      parameterCountFormatted: formatParameterCount(paramCount),
      inferenceProviderCount: liveProviders,
      lastModified: model.lastModified,
      private: model.private,
      gated: model.gated,
      description: model.cardData?.description || model.description,
      tags: model.tags,
    } as HFModelSearchResult
  })
}

/**
 * GET /api/huggingface/models
 *
 * Query params:
 * - query: Search string (optional)
 * - pipelineTag: 'text-generation' | 'feature-extraction' (default: 'text-generation')
 * - limit: Max results (default: 20)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('query') || undefined
    const pipelineTag = searchParams.get('pipelineTag') || 'text-generation'
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    console.log('[HF Models API] Request:', { query, pipelineTag, limit })

    // Fetch models based on search or get popular ones
    const modelsPromise = fetchHFModels({
      query,
      pipelineTag,
      limit: query ? limit : Math.min(limit, 50), // More results for search
      sort: 'downloads',
    })

    // Always fetch recommended (top downloaded) models for the recommended section
    const recommendedPromise = query
      ? fetchHFModels({ pipelineTag, limit: 10, sort: 'downloads' })
      : Promise.resolve([])

    const [models, recommendedModels] = await Promise.all([modelsPromise, recommendedPromise])

    // For non-search requests, split into recommended and all
    let recommended: HFModelSearchResult[]
    let allModels: HFModelSearchResult[]

    if (query) {
      // When searching: show recommended separately, search results below
      recommended = recommendedModels.slice(0, 5)
      allModels = models
    } else {
      // No search: top 5 are recommended, rest are "all"
      recommended = models.slice(0, 5)
      allModels = models.slice(5)
    }

    const response: HFModelsResponse = {
      models: allModels,
      recommended,
    }

    console.log('[HF Models API] Response:', {
      recommended: recommended.length,
      models: allModels.length,
    })

    return NextResponse.json(response)
  } catch (error) {
    console.error('[HF Models API] Error:', error)

    return NextResponse.json(
      {
        models: [],
        recommended: [],
        error: error instanceof Error ? error.message : 'Failed to fetch models',
      } as HFModelsResponse,
      { status: 500 }
    )
  }
}

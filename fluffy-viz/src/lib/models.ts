import axios from 'axios'
import { Model, ModelSearchParams, ModelSearchResponse, ModelCategory } from '@/types/models'

const HUGGINGFACE_API_BASE = 'https://huggingface.co/api'

// Recommended models configuration based on AI Sheets analysis
const RECOMMENDED_MODELS: Model[] = [
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    description: 'OpenAI GPT-4o optimized model',
    tags: ['NLP', 'Lightweight'],
    category: 'recommended',
    provider: 'openai',
    parameters: '175B'
  },
  {
    id: 'meta-llama/Llama-3.1-70B-Instruct',
    name: 'Llama 3.1 70B Instruct',
    description: 'Meta Llama 3.1 70B instruction-following model',
    tags: ['NLP', 'Lightweight'],
    category: 'recommended',
    provider: 'meta',
    parameters: '70B'
  },
  {
    id: 'CohereForAI/command-r-translate-2025',
    name: 'Command R Translate 2025',
    description: 'Cohere command model optimized for translation',
    tags: ['Translation'],
    category: 'recommended',
    provider: 'cohere',
    parameters: '35B'
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'OpenAI GPT-4o mini model for coding and reasoning',
    tags: ['Coding', 'Reasoning'],
    category: 'recommended',
    provider: 'openai',
    parameters: '8B'
  },
  {
    id: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    name: 'Qwen 2.5 Coder 32B',
    description: 'Qwen coding-specialized model',
    tags: ['Coding'],
    category: 'recommended',
    provider: 'alibaba',
    parameters: '32B'
  }
]

/**
 * Fetch models from Hugging Face API
 */
export async function fetchHuggingFaceModels(params: ModelSearchParams = {}): Promise<ModelSearchResponse> {
  try {
    const queryParams = new URLSearchParams({
      search: params.query || '',
      filter: 'text-generation',
      sort: params.sort === 'popular' ? 'downloads' : params.sort === 'recent' ? 'lastModified' : 'id',
      limit: String(params.limit || 20)
    })

    if (params.cursor) {
      queryParams.append('cursor', params.cursor)
    }

    const response = await axios.get(`${HUGGINGFACE_API_BASE}/models?${queryParams}`)

    const models: Model[] = response.data.map((model: any) => ({
      id: model.id || model.modelId,
      name: model.id || model.modelId,
      description: model.description,
      avatar: model.avatar,
      tags: model.tags || [],
      likes: model.likes || 0,
      downloads: model.downloads || 0,
      category: 'all' as const,
      createdAt: model.createdAt,
      updatedAt: model.lastModified,
      parameters: extractParameterCount(model.id || model.modelId)
    }))

    return {
      models,
      totalCount: response.data.length,
      nextCursor: response.data.nextCursor
    }
  } catch (error) {
    console.error('Error fetching Hugging Face models:', error)
    throw new Error('Failed to fetch models from Hugging Face')
  }
}

/**
 * Extract parameter count from model name/id
 */
function extractParameterCount(modelId: string): string | undefined {
  const parameterRegex = /(\d+(?:\.\d+)?[BbMmKk])/g
  const matches = modelId.match(parameterRegex)
  return matches ? matches[matches.length - 1].toUpperCase() : undefined
}

/**
 * Get recommended models
 */
export function getRecommendedModels(): Model[] {
  return RECOMMENDED_MODELS
}

/**
 * Search models with combined recommended and HF models
 */
export async function searchModels(params: ModelSearchParams = {}): Promise<ModelCategory[]> {
  const categories: ModelCategory[] = []

  // Add recommended models if no specific query or showing all
  if (!params.query || params.category === 'recommended') {
    const recommendedModels = getRecommendedModels()
    const filteredRecommended = params.query
      ? recommendedModels.filter(model =>
          model.name.toLowerCase().includes(params.query!.toLowerCase()) ||
          model.tags?.some(tag => tag.toLowerCase().includes(params.query!.toLowerCase()))
        )
      : recommendedModels

    if (filteredRecommended.length > 0) {
      categories.push({
        id: 'recommended',
        name: 'Recommended Models',
        description: 'Curated models for common tasks',
        models: filteredRecommended
      })
    }
  }

  // Add Hugging Face models if showing all or specific query
  if (!params.category || params.category === 'all' || params.query) {
    try {
      const hfResponse = await fetchHuggingFaceModels(params)
      if (hfResponse.models.length > 0) {
        categories.push({
          id: 'huggingface',
          name: 'All models available on Hugging Face',
          description: 'Browse all available models',
          models: hfResponse.models
        })
      }
    } catch (error) {
      console.error('Error fetching HuggingFace models:', error)
      // Fallback to recommended models only
    }
  }

  return categories
}

/**
 * Get model by ID
 */
export async function getModelById(modelId: string): Promise<Model | null> {
  // Check recommended models first
  const recommended = getRecommendedModels().find(model => model.id === modelId)
  if (recommended) {
    return recommended
  }

  // Fetch from HuggingFace API
  try {
    const response = await axios.get(`${HUGGINGFACE_API_BASE}/models/${modelId}`)
    return {
      id: response.data.id || response.data.modelId,
      name: response.data.id || response.data.modelId,
      description: response.data.description,
      avatar: response.data.avatar,
      tags: response.data.tags || [],
      likes: response.data.likes || 0,
      downloads: response.data.downloads || 0,
      category: 'all',
      createdAt: response.data.createdAt,
      updatedAt: response.data.lastModified,
      parameters: extractParameterCount(response.data.id || response.data.modelId)
    }
  } catch (error) {
    console.error(`Error fetching model ${modelId}:`, error)
    return null
  }
}

/**
 * Filter models by tags
 */
export function filterModelsByTags(models: Model[], tags: string[]): Model[] {
  if (!tags.length) return models

  return models.filter(model =>
    model.tags?.some(tag =>
      tags.some(filterTag =>
        tag.toLowerCase().includes(filterTag.toLowerCase())
      )
    )
  )
}

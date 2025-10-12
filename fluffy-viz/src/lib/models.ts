import axios from 'axios'
import { Model, ModelSearchParams, ModelSearchResponse, ModelCategory } from '@/types/models'
import { loadModelRegistry, getTextModelsForEnabledProviders, type ModelConfig } from '@/config/model-registry'
import { loadProviderSettings, getEnabledProviders, hasCapability, type ProviderKey } from '@/config/provider-settings'

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
 * Convert ModelConfig from registry to Model type
 */
function convertModelConfigToModel(modelConfig: ModelConfig, provider: string): Model {
  return {
    id: modelConfig.id,
    name: modelConfig.name,
    description: modelConfig.description,
    parameters: modelConfig.contextWindow ? `${(modelConfig.contextWindow / 1000).toFixed(0)}K ctx` : undefined,
    category: modelConfig.recommended ? 'recommended' : 'all',
    provider: provider,
    contextLength: modelConfig.contextWindow,
    tags: [provider, modelConfig.type]
  }
}

/**
 * Search models from model registry, filtered by enabled providers with text capability
 */
export async function searchModels(params: ModelSearchParams = {}): Promise<ModelCategory[]> {
  const categories: ModelCategory[] = []

  try {
    // Load model registry
    await loadModelRegistry()

    // Load provider config and get enabled providers with text capability
    const providerConfig = await loadProviderSettings()
    const enabledProviderKeys = getEnabledProviders(providerConfig)
      .filter(provider => hasCapability(providerConfig, provider as ProviderKey, 'text'))

    // Get all text models from enabled providers
    const modelConfigs = getTextModelsForEnabledProviders(enabledProviderKeys)

    // Convert to Model type with provider info
    const allModels = modelConfigs.map(config =>
      convertModelConfigToModel(config, (config as any).provider || 'unknown')
    )

    // Filter by search query if provided
    const filteredModels = params.query
      ? allModels.filter(model =>
          model.name.toLowerCase().includes(params.query!.toLowerCase()) ||
          model.id.toLowerCase().includes(params.query!.toLowerCase()) ||
          model.description?.toLowerCase().includes(params.query!.toLowerCase())
        )
      : allModels

    // Separate recommended and all models
    const recommendedModels = filteredModels.filter(m => m.category === 'recommended')
    const otherModels = filteredModels.filter(m => m.category !== 'recommended')

    if (recommendedModels.length > 0) {
      categories.push({
        id: 'recommended',
        name: 'Recommended Models',
        description: 'Best models from your configured providers',
        models: recommendedModels
      })
    }

    if (otherModels.length > 0) {
      categories.push({
        id: 'all',
        name: 'All Available Models',
        description: 'All models from your configured providers',
        models: otherModels
      })
    }

    // If no models found, show helpful message
    if (categories.length === 0) {
      console.warn('No models available. Check provider configuration.')
    }

  } catch (error) {
    console.error('Error loading models:', error)
    // Return empty categories on error
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

import { ModelProvider } from '@/types/models'

// Inference providers configuration based on AI Sheets analysis
export const INFERENCE_PROVIDERS: ModelProvider[] = [
  {
    id: 'groq',
    name: 'groq',
    displayName: 'Groq',
    icon: '⚡',
    url: 'https://api.groq.com/openai/v1',
    models: [
      'llama-3.1-8b-instant',
      'llama-3.1-70b-versatile',
      'mixtral-8x7b-32768',
      'gemma-7b-it'
    ],
    maxContextLength: 32768,
    supportsStreaming: true,
    pricing: {
      input: 0.05,
      output: 0.08,
      unit: 'per 1M tokens'
    }
  },
  {
    id: 'together',
    name: 'together',
    displayName: 'Together AI',
    icon: '🤝',
    url: 'https://api.together.xyz/v1',
    models: [
      'meta-llama/Llama-3.1-8B-Instruct-Turbo',
      'meta-llama/Llama-3.1-70B-Instruct-Turbo',
      'mistralai/Mixtral-8x7B-Instruct-v0.1',
      'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO'
    ],
    maxContextLength: 32768,
    supportsStreaming: true,
    pricing: {
      input: 0.1,
      output: 0.1,
      unit: 'per 1M tokens'
    }
  },
  {
    id: 'novita',
    name: 'novita',
    displayName: 'Novita AI',
    icon: '🚀',
    url: 'https://api.novita.ai/v3',
    models: [
      'meta-llama/llama-3.1-8b-instruct',
      'meta-llama/llama-3.1-70b-instruct',
      'mistralai/mistral-7b-instruct-v0.3'
    ],
    maxContextLength: 8192,
    supportsStreaming: true,
    pricing: {
      input: 0.08,
      output: 0.12,
      unit: 'per 1M tokens'
    }
  },
  {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI',
    icon: '🤖',
    url: 'https://api.openai.com/v1',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ],
    maxContextLength: 128000,
    supportsStreaming: true,
    pricing: {
      input: 2.5,
      output: 10,
      unit: 'per 1M tokens'
    }
  },
  {
    id: 'anthropic',
    name: 'anthropic',
    displayName: 'Anthropic',
    icon: '🔮',
    url: 'https://api.anthropic.com/v1',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ],
    maxContextLength: 200000,
    supportsStreaming: true,
    pricing: {
      input: 3,
      output: 15,
      unit: 'per 1M tokens'
    }
  },
  {
    id: 'cohere',
    name: 'cohere',
    displayName: 'Cohere',
    icon: '🌊',
    url: 'https://api.cohere.ai/v1',
    models: [
      'command-r-plus',
      'command-r',
      'command',
      'command-nightly',
      'embed-english-v3.0',
      'embed-multilingual-v3.0'
    ],
    maxContextLength: 128000,
    supportsStreaming: true,
    pricing: {
      input: 3,
      output: 15,
      unit: 'per 1M tokens'
    }
  }
]

/**
 * Get all available providers
 */
export function getInferenceProviders(): ModelProvider[] {
  return INFERENCE_PROVIDERS
}

/**
 * Get provider by ID
 */
export function getProviderById(providerId: string): ModelProvider | null {
  return INFERENCE_PROVIDERS.find(provider => provider.id === providerId) || null
}

/**
 * Get providers that support a specific model
 */
export function getProvidersForModel(modelId: string): ModelProvider[] {
  return INFERENCE_PROVIDERS.filter(provider =>
    provider.models?.some(model =>
      model.toLowerCase().includes(modelId.toLowerCase()) ||
      modelId.toLowerCase().includes(model.toLowerCase())
    )
  )
}

/**
 * Get compatible providers for a model based on model name patterns
 */
export function getCompatibleProviders(modelId: string): ModelProvider[] {
  const compatibleProviders: ModelProvider[] = []

  // OpenAI models
  if (modelId.includes('gpt') || modelId.includes('openai')) {
    const openai = getProviderById('openai')
    if (openai) compatibleProviders.push(openai)
  }

  // Llama models
  if (modelId.includes('llama') || modelId.includes('meta-llama')) {
    const groq = getProviderById('groq')
    const together = getProviderById('together')
    const novita = getProviderById('novita')
    if (groq) compatibleProviders.push(groq)
    if (together) compatibleProviders.push(together)
    if (novita) compatibleProviders.push(novita)
  }

  // Mixtral models
  if (modelId.includes('mixtral') || modelId.includes('mistral')) {
    const groq = getProviderById('groq')
    const together = getProviderById('together')
    const novita = getProviderById('novita')
    if (groq) compatibleProviders.push(groq)
    if (together) compatibleProviders.push(together)
    if (novita) compatibleProviders.push(novita)
  }

  // Claude models
  if (modelId.includes('claude') || modelId.includes('anthropic')) {
    const anthropic = getProviderById('anthropic')
    if (anthropic) compatibleProviders.push(anthropic)
  }

  // Cohere models
  if (modelId.includes('command') || modelId.includes('cohere') || modelId.includes('embed')) {
    const cohere = getProviderById('cohere')
    if (cohere) compatibleProviders.push(cohere)
  }

  // If no specific matches, return popular general providers
  if (compatibleProviders.length === 0) {
    const groq = getProviderById('groq')
    const together = getProviderById('together')
    if (groq) compatibleProviders.push(groq)
    if (together) compatibleProviders.push(together)
  }

  return compatibleProviders
}

/**
 * Get provider count for a model (for display purposes)
 */
export function getProviderCountForModel(modelId: string): number {
  return getCompatibleProviders(modelId).length
}

/**
 * Format provider display name with count
 */
export function formatProviderWithCount(provider: ModelProvider, totalCount: number): string {
  const additionalCount = Math.max(0, totalCount - 1)
  return additionalCount > 0 ? `${provider.displayName} +${additionalCount}` : provider.displayName
}

/**
 * Get default provider for a model
 */
export function getDefaultProviderForModel(modelId: string): ModelProvider | null {
  const compatibleProviders = getCompatibleProviders(modelId)

  // Prefer specific provider matches first
  if (modelId.includes('gpt') || modelId.includes('openai')) {
    return getProviderById('openai')
  }

  if (modelId.includes('claude') || modelId.includes('anthropic')) {
    return getProviderById('anthropic')
  }

  // For other models, prefer Groq for speed
  const groq = compatibleProviders.find(p => p.id === 'groq')
  if (groq) return groq

  // Fallback to first compatible provider
  return compatibleProviders[0] || null
}

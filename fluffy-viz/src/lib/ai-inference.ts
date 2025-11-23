import { generateText, embed, embedMany } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createCohere } from '@ai-sdk/cohere'
import { createGroq } from '@ai-sdk/groq'
import { HfInference } from '@huggingface/inference'
import type { ProviderKey } from '@/config/provider-settings'
import { Model, ModelProvider } from '@/types/models'
import type { FailureType } from '@/lib/duckdb'

export interface InferenceOptions {
  model: Model
  provider: ModelProvider
  prompt: string
  temperature?: number
  maxTokens?: number
}

export interface InferenceResult {
  content: string
  error?: string
  errorType?: FailureType
}

/**
 * Classify error type for better UI feedback
 * Uses dual detection: HTTP status code + fuzzy string matching
 */
export function classifyError(error: any): FailureType {
  // Check HTTP status code first (most reliable)
  const status = error?.status || error?.response?.status

  if (status === 429) {
    return 'rate_limit'
  }

  if (status === 401 || status === 403) {
    return 'auth'
  }

  if (status >= 500) {
    return 'server_error'
  }

  // Fuzzy string matching on error message
  const message = (error?.message || error?.error || String(error)).toLowerCase()

  // Rate limit keywords
  const rateLimitKeywords = [
    'rate limit',
    'too many requests',
    'quota exceeded',
    'requests per minute',
    'rpm exceeded',
    'rate_limit_exceeded',
    'quota_exceeded'
  ]

  if (rateLimitKeywords.some(keyword => message.includes(keyword))) {
    return 'rate_limit'
  }

  // Auth keywords
  const authKeywords = [
    'unauthorized',
    'authentication',
    'invalid api key',
    'api key',
    'forbidden',
    'access denied'
  ]

  if (authKeywords.some(keyword => message.includes(keyword))) {
    return 'auth'
  }

  // Network keywords
  const networkKeywords = [
    'network',
    'connection',
    'timeout',
    'econnrefused',
    'fetch failed',
    'offline'
  ]

  if (!navigator.onLine || networkKeywords.some(keyword => message.includes(keyword))) {
    return 'network'
  }

  // Server error keywords
  const serverKeywords = [
    'internal server error',
    'service unavailable',
    '500',
    '502',
    '503',
    '504'
  ]

  if (serverKeywords.some(keyword => message.includes(keyword))) {
    return 'server_error'
  }

  // Default to invalid_request for everything else
  return 'invalid_request'
}

/**
 * Interpolate prompt template with row data using {{column_slug}} syntax
 */
export function interpolatePromptForRow(
  template: string,
  row: Record<string, any>
): string {
  let result = template

  // Replace {{column_slug}} with actual row values
  const regex = /\{\{(\w+)\}\}/g
  result = result.replace(regex, (match, columnSlug) => {
    const value = row[columnSlug]
    if (value === null || value === undefined) {
      return '(empty)'
    }
    return String(value)
  })

  return result
}

/**
 * Get AI SDK model instance for major providers
 * API keys are passed dynamically from provider configuration
 */
function getAISDKModel(
  providerId: ProviderKey,
  modelId: string,
  apiKey: string
) {
  // All AI SDK providers use factory pattern for API key initialization
  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({ apiKey })
      return provider(modelId)
    }
    case 'anthropic': {
      const provider = createAnthropic({ apiKey })
      return provider(modelId)
    }
    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey })
      return provider(modelId)
    }
    case 'mistral': {
      const provider = createMistral({ apiKey })
      return provider(modelId)
    }
    case 'cohere': {
      const provider = createCohere({ apiKey })
      return provider(modelId)
    }
    case 'groq': {
      const provider = createGroq({ apiKey })
      return provider(modelId)
    }
    default:
      throw new Error(`AI SDK does not support provider: ${providerId}`)
  }
}

/**
 * HuggingFace-specific inference
 */
async function generateHuggingFaceCompletion(
  options: InferenceOptions
): Promise<InferenceResult> {
  const { model, prompt, temperature = 0.7, maxTokens = 500 } = options
  const apiKey = options.provider.apiKey

  const hf = new HfInference(apiKey)

  try {
    // Use chat completion for instruction models
    if (
      model.id.includes('Instruct') ||
      model.id.includes('chat') ||
      model.id.includes('Chat')
    ) {
      const response = await hf.chatCompletion({
        model: model.id,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature,
      })

      return {
        content: response.choices[0]?.message?.content || '',
      }
    } else {
      // Use text generation for base models
      const response = await hf.textGeneration({
        model: model.id,
        inputs: prompt,
        parameters: {
          max_new_tokens: maxTokens,
          temperature,
          return_full_text: false,
        },
      })

      return {
        content: response.generated_text,
      }
    }
  } catch (error) {
    const errorType = classifyError(error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType,
    }
  }
}

/**
 * Main inference function - routes to correct implementation
 */
export async function generateCompletion(
  options: InferenceOptions
): Promise<InferenceResult> {
  const { provider, model, prompt, temperature = 0.7, maxTokens = 500 } = options

  try {
    // Validate API key is present
    if (!provider.apiKey) {
      throw new Error(`API key missing for provider: ${provider.id}`)
    }

    console.log('[AI Inference] Starting generation:', {
      providerId: provider.id,
      modelId: model.id,
      hasApiKey: !!provider.apiKey,
      apiKeyLength: provider.apiKey?.length,
      apiKeyPrefix: provider.apiKey?.substring(0, 10)
    })

    // Route to HuggingFace for HF models
    if (provider.id === 'huggingface') {
      return await generateHuggingFaceCompletion(options)
    }

    // Use AI SDK for major providers
    const aiModel = getAISDKModel(
      provider.id as ProviderKey,
      model.id,
      provider.apiKey
    )

    const { text } = await generateText({
      model: aiModel,
      prompt,
      temperature,
    })

    return { content: text }
  } catch (error) {
    console.error('AI inference error:', error)
    const errorType = classifyError(error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType,
    }
  }
}

/**
 * Embeddings - unified interface for all providers
 */
export async function generateEmbeddings(
  texts: string[],
  provider: ProviderKey,
  modelId: string,
  apiKey: string
): Promise<number[][]> {
  // Use HuggingFace Inference API
  if (provider === 'huggingface') {
    const hf = new HfInference(apiKey)
    const result = await hf.featureExtraction({
      model: modelId,
      inputs: texts,
    })

    // Normalize return format
    return Array.isArray(result[0])
      ? (result as number[][])
      : [result as number[]]
  }

  // Use AI SDK for other providers
  const embeddingModel = getEmbeddingModel(provider, modelId, apiKey)

  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: texts,
  })

  return embeddings
}

function getEmbeddingModel(
  provider: ProviderKey,
  modelId: string,
  apiKey: string
) {
  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({ apiKey })
      return openai.textEmbeddingModel(modelId)
    }
    case 'google': {
      const google = createGoogleGenerativeAI({ apiKey })
      return google.textEmbeddingModel(modelId)
    }
    case 'mistral': {
      const mistral = createMistral({ apiKey })
      return mistral.textEmbeddingModel(modelId)
    }
    case 'cohere': {
      const cohere = createCohere({ apiKey })
      return cohere.textEmbeddingModel(modelId)
    }
    default:
      throw new Error(`Embeddings not supported for provider: ${provider}`)
  }
}

/**
 * Generate column data for multiple rows
 */
export async function generateColumnData(
  rows: any[],
  columnId: string,
  prompt: string,
  model: Model,
  provider: ModelProvider,
  referenceColumns: string[],
  onProgress?: (current: number, total: number) => void,
  onCellComplete?: (rowIndex: number, result: InferenceResult) => void
): Promise<Map<number, InferenceResult>> {
  try {
    // Call the server-side API endpoint for batch generation
    const response = await fetch('/api/generate-column', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        providerId: provider.id,
        modelId: model.id,
        prompt,
        rows,
        temperature: 0.7,
        maxTokens: 500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Failed to generate column data')
    }

    const { results: apiResults } = await response.json()

    // Convert API results array to Map and notify on each cell completion
    const results = new Map<number, InferenceResult>()
    apiResults.forEach((result: InferenceResult & { rowIndex: number }) => {
      const rowIndex = result.rowIndex
      const cellResult = {
        content: result.content,
        error: result.error,
        errorType: result.errorType
      }

      results.set(rowIndex, cellResult)

      // Notify cell completion immediately
      if (onCellComplete) {
        onCellComplete(rowIndex, cellResult)
      }

      // Report overall progress
      if (onProgress) {
        onProgress(results.size, rows.length)
      }
    })

    return results
  } catch (error) {
    console.error('Error generating column data:', error)
    const errorType = classifyError(error)

    // Return error result for all rows
    const errorResults = new Map<number, InferenceResult>()
    rows.forEach((_, index) => {
      errorResults.set(index, {
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType,
      })
    })

    return errorResults
  }
}

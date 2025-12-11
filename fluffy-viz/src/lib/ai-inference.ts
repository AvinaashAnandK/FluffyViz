import { generateText, generateObject, embed, embedMany, Output } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createCohere } from '@ai-sdk/cohere'
import { createGroq } from '@ai-sdk/groq'
import { createPerplexity } from '@ai-sdk/perplexity'
import { HfInference } from '@huggingface/inference'
import type { ProviderKey } from '@/config/provider-settings'
import { Model, ModelProvider } from '@/types/models'
import type { FailureType } from '@/lib/duckdb'
import type { OutputSchema } from '@/types/structured-output'
import type { WebSearchConfig, SearchSource, WebSearchError, WebSearchErrorType } from '@/types/web-search'
import type { ModelConfig } from '@/lib/model-registry-server'
import { buildZodSchema, generateSchemaPromptSuffix, parseJSONFromResponse, validateStructuredOutput } from '@/lib/schema-utils'

export interface InferenceOptions {
  model: Model
  provider: ModelProvider
  prompt: string
  temperature?: number
  maxTokens?: number
  webSearch?: WebSearchConfig
}

export interface InferenceResult {
  content: string
  error?: string
  errorType?: FailureType
  sources?: SearchSource[]
  warning?: string
}

export interface StructuredInferenceOptions extends InferenceOptions {
  outputSchema: OutputSchema
}

export interface StructuredInferenceResult {
  content: string  // JSON stringified result
  data?: any       // Parsed and validated data
  error?: string
  errorType?: FailureType
  sources?: SearchSource[]
  warning?: string
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

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'network'
  }

  if (networkKeywords.some(keyword => message.includes(keyword))) {
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
 * Classify web search specific errors
 */
export function classifyWebSearchError(error: unknown): WebSearchError | null {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // OpenAI web search errors
  if (lowerMessage.includes('web_search') && lowerMessage.includes('rate')) {
    return {
      type: 'search_rate_limit',
      message: 'Web search rate limit reached. Try again in a few minutes.',
      retryable: true,
      retryAfterMs: 60000,
    }
  }

  // Google grounding errors
  if (lowerMessage.includes('grounding') && lowerMessage.includes('quota')) {
    return {
      type: 'search_quota_exceeded',
      message: 'Google Search grounding quota exceeded for today.',
      retryable: false,
    }
  }

  // Perplexity errors
  if (lowerMessage.includes('search') && lowerMessage.includes('timeout')) {
    return {
      type: 'search_timeout',
      message: 'Web search timed out. The query may be too complex.',
      retryable: true,
      retryAfterMs: 5000,
    }
  }

  // Generic search errors
  if (lowerMessage.includes('search') && lowerMessage.includes('error')) {
    return {
      type: 'search_provider_error',
      message: 'The search provider encountered an error.',
      retryable: true,
      retryAfterMs: 5000,
    }
  }

  return null  // Not a web search error
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
 * Handles web search configuration and API mode selection
 */
function getAISDKModel(
  providerId: ProviderKey,
  modelId: string,
  apiKey: string,
  modelConfig?: ModelConfig,
  webSearch?: WebSearchConfig
) {
  switch (providerId) {
    case 'openai': {
      const provider = createOpenAI({ apiKey })

      // Route based on apiMode field from model registry
      // - 'completions': ChatCompletions API (search-preview, audio models)
      // - 'responses': Responses API (GPT-5, GPT-4.1, GPT-4o, o-series, etc.)

      console.log('[AI SDK] OpenAI model routing:', {
        modelId,
        apiMode: modelConfig?.apiMode,
        searchBuiltIn: modelConfig?.searchBuiltIn,
        searchSupport: modelConfig?.searchSupport,
      })

      if (modelConfig?.apiMode === 'completions') {
        // ChatCompletions API for search-preview and audio models
        console.log('[AI SDK] Using ChatCompletions API for', modelId)
        return provider.chat(modelId)
      }

      // Default to Responses API for modern OpenAI models
      console.log('[AI SDK] Using Responses API for', modelId)
      return provider.responses(modelId)
    }

    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey })
      // Note: Search grounding is handled via googleSearch tool in getWebSearchTools()
      return provider(modelId)
    }

    case 'perplexity': {
      const provider = createPerplexity({ apiKey })
      return provider(modelId)  // Search is always-on for Perplexity
    }

    case 'anthropic': {
      const provider = createAnthropic({ apiKey })
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
 * Get web search tools for providers that support them
 */
function getWebSearchTools(
  providerId: ProviderKey,
  webSearch: WebSearchConfig,
  apiKey: string,
  modelConfig?: ModelConfig
): Record<string, any> | undefined {
  if (!webSearch.enabled) return undefined

  // Built-in search models don't need external tools
  if (modelConfig?.searchBuiltIn) return undefined

  switch (providerId) {
    case 'openai': {
      // Only for Responses API models
      if (modelConfig?.apiMode !== 'responses') return undefined

      const openai = createOpenAI({ apiKey })
      return {
        web_search_preview: openai.tools.webSearchPreview({
          searchContextSize: webSearch.contextSize || 'medium',
          ...(webSearch.userLocation && {
            userLocation: webSearch.userLocation
          })
        })
      }
    }

    case 'google': {
      // Google uses useSearchGrounding in model creation, not separate tools
      // But we can also use the googleSearch tool
      if (!modelConfig?.searchSupport) return undefined

      const google = createGoogleGenerativeAI({ apiKey })
      return {
        google_search: google.tools.googleSearch({})
      }
    }

    // Perplexity has native search, no tools needed
    case 'perplexity':
      return undefined

    default:
      return undefined
  }
}

/**
 * Get provider-specific options for Perplexity location settings
 */
function getPerplexityProviderOptions(webSearch?: WebSearchConfig): Record<string, any> | undefined {
  console.log('[AI Inference] getPerplexityProviderOptions called with:', {
    enabled: webSearch?.enabled,
    hasUserLocation: !!webSearch?.userLocation,
    userLocation: webSearch?.userLocation,
  })

  if (!webSearch?.enabled) {
    console.log('[AI Inference] Perplexity location skipped: webSearch not enabled')
    return undefined
  }
  if (!webSearch.userLocation) {
    console.log('[AI Inference] Perplexity location skipped: no userLocation')
    return undefined
  }

  const { city, region, country } = webSearch.userLocation

  // Only add user_location if we have at least country
  if (!country) {
    console.log('[AI Inference] Perplexity location skipped: no country code provided')
    return undefined
  }

  console.log('[AI Inference] Perplexity location config:', { city, region, country })

  return {
    perplexity: {
      web_search_options: {
        user_location: {
          ...(country && { country }),
          ...(region && { region }),
          ...(city && { city }),
          // Note: lat/long not supported in our UI, but could be added
        }
      }
    }
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
 * Supports web search when enabled
 */
export async function generateCompletion(
  options: InferenceOptions,
  modelConfig?: ModelConfig
): Promise<InferenceResult> {
  const { provider, model, prompt, temperature = 0.7, maxTokens = 500, webSearch } = options

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
      apiKeyPrefix: provider.apiKey?.substring(0, 10),
      webSearchEnabled: webSearch?.enabled
    })

    // Route to HuggingFace for HF models
    if (provider.id === 'huggingface') {
      return await generateHuggingFaceCompletion(options)
    }

    // Use AI SDK for major providers
    const aiModel = getAISDKModel(
      provider.id as ProviderKey,
      model.id,
      provider.apiKey,
      modelConfig,
      webSearch
    )

    // Get web search tools if enabled
    const tools = webSearch?.enabled
      ? getWebSearchTools(
          provider.id as ProviderKey,
          webSearch,
          provider.apiKey,
          modelConfig
        )
      : undefined

    // Get provider-specific options (e.g., Perplexity location)
    const providerOptions = provider.id === 'perplexity'
      ? getPerplexityProviderOptions(webSearch)
      : undefined

    // Generate with or without tools
    const result = await generateText({
      model: aiModel,
      prompt,
      temperature,
      ...(tools && {
        tools,
        maxSteps: 3,  // Allow tool use round-trips
      }),
      ...(providerOptions && { providerOptions }),
    })

    // Extract sources from result - check multiple locations
    const sources: SearchSource[] = []

    // Debug: Log the full result structure
    console.log('[AI Inference] Result structure:', {
      hasText: !!result.text,
      textLength: result.text?.length,
      hasSources: !!(result as any).sources,
      hasProviderMetadata: !!(result as any).providerMetadata,
      providerMetadataKeys: Object.keys((result as any).providerMetadata || {}),
      hasExperimentalProviderMetadata: !!(result as any).experimental_providerMetadata,
      toolCalls: result.toolCalls?.map(tc => tc.toolName),
      toolResults: result.toolResults?.length,
    })

    // Check direct sources property (Perplexity returns sources here)
    if ((result as any).sources) {
      console.log('[AI Inference] Found direct sources:', (result as any).sources.length)
      for (const s of (result as any).sources) {
        sources.push({
          url: s.url,
          title: s.title || s.name,
        })
      }
    }

    // Check providerMetadata for Perplexity sources
    const perplexityMeta = (result as any).providerMetadata?.perplexity ||
                           (result as any).experimental_providerMetadata?.perplexity
    if (perplexityMeta) {
      console.log('[AI Inference] Perplexity metadata:', Object.keys(perplexityMeta))
      // Perplexity may return sources in metadata
      if (perplexityMeta.sources) {
        for (const s of perplexityMeta.sources) {
          sources.push({
            url: s.url || s,
            title: s.title || s.name || 'Perplexity Source',
          })
        }
      }
    }

    // Check providerMetadata for OpenAI built-in search citations
    const openaiMeta = (result as any).providerMetadata?.openai ||
                       (result as any).experimental_providerMetadata?.openai
    if (openaiMeta) {
      console.log('[AI Inference] OpenAI metadata:', Object.keys(openaiMeta))
      if (openaiMeta.annotations) {
        for (const annotation of openaiMeta.annotations) {
          if (annotation.type === 'url_citation' && annotation.url) {
            sources.push({
              url: annotation.url,
              title: annotation.title || annotation.text || 'Source',
            })
          }
        }
      }
    }

    // Check tool results for web search sources (OpenAI web_search_preview tool)
    if (result.toolResults) {
      for (const toolResult of result.toolResults) {
        if (toolResult.toolName?.includes('search') || toolResult.toolName?.includes('web')) {
          const searchResult = toolResult.result as any
          console.log('[AI Inference] Tool result for', toolResult.toolName, ':', typeof searchResult)
          if (searchResult?.sources) {
            for (const s of searchResult.sources) {
              sources.push({
                url: s.url || s.link,
                title: s.title || s.name || 'Source',
              })
            }
          }
        }
      }
    }

    console.log('[AI Inference] Extracted sources:', sources.length, sources.map(s => s.url))

    // Check for empty search results warning
    const searchWasUsed = result.toolCalls?.some(
      tc => tc.toolName.includes('search') || tc.toolName.includes('grounding')
    ) || openaiMeta?.annotations?.length > 0 || provider.id === 'perplexity'  // Perplexity always searches
    const hasNoSources = sources.length === 0

    return {
      content: result.text,
      sources: sources.length > 0 ? sources : undefined,
      warning: searchWasUsed && hasNoSources
        ? 'Web search was attempted but returned no results. Response may lack current information.'
        : undefined,
    }
  } catch (error) {
    console.error('AI inference error:', error)

    // Check for web search specific errors first
    const webSearchError = classifyWebSearchError(error)
    if (webSearchError) {
      return {
        content: '',
        error: webSearchError.message,
        errorType: 'invalid_request', // Map to existing type for compatibility
      }
    }

    const errorType = classifyError(error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType,
    }
  }
}

/**
 * Generate structured output using AI SDK's generateObject
 * When web search is enabled, uses generateText with experimental_output
 */
export async function generateStructuredCompletion(
  options: StructuredInferenceOptions,
  modelConfig?: ModelConfig
): Promise<StructuredInferenceResult> {
  const { provider, model, prompt, outputSchema, temperature = 0.7, webSearch } = options

  try {
    // Validate API key is present
    if (!provider.apiKey) {
      throw new Error(`API key missing for provider: ${provider.id}`)
    }

    // Build Zod schema from field definitions
    const zodSchema = buildZodSchema(outputSchema.fields)

    // Append schema format to prompt
    const promptWithSchema = prompt + generateSchemaPromptSuffix(outputSchema.fields)

    console.log('[AI Inference] Starting structured generation:', {
      providerId: provider.id,
      modelId: model.id,
      fieldCount: outputSchema.fields.length,
      webSearchEnabled: webSearch?.enabled
    })

    // HuggingFace doesn't support generateObject well, use text generation + parsing
    if (provider.id === 'huggingface') {
      const textResult = await generateHuggingFaceCompletion({
        ...options,
        prompt: promptWithSchema
      })

      if (textResult.error) {
        return {
          content: '',
          error: textResult.error,
          errorType: textResult.errorType
        }
      }

      // Parse and validate the JSON response
      const parseResult = parseJSONFromResponse(textResult.content)
      if (!parseResult.success) {
        return {
          content: textResult.content,
          error: parseResult.error,
          errorType: 'invalid_request'
        }
      }

      const validationResult = validateStructuredOutput(parseResult.data, zodSchema)
      if (!validationResult.success) {
        return {
          content: textResult.content,
          error: `Validation failed: ${validationResult.error}`,
          errorType: 'invalid_request'
        }
      }

      return {
        content: JSON.stringify(validationResult.data),
        data: validationResult.data
      }
    }

    const aiModel = getAISDKModel(
      provider.id as ProviderKey,
      model.id,
      provider.apiKey,
      modelConfig,
      webSearch
    )

    // When web search is enabled, use generateText with experimental_output
    // because generateObject does NOT support tools
    if (webSearch?.enabled && modelConfig?.searchSupport) {
      const tools = getWebSearchTools(
        provider.id as ProviderKey,
        webSearch,
        provider.apiKey,
        modelConfig
      )

      // Get provider-specific options (e.g., Perplexity location)
      const providerOptions = provider.id === 'perplexity'
        ? getPerplexityProviderOptions(webSearch)
        : undefined

      const result = await generateText({
        model: aiModel,
        prompt: promptWithSchema,
        temperature,
        ...(tools && {
          tools,
          maxSteps: 3,
        }),
        ...(providerOptions && { providerOptions }),
        experimental_output: Output.object({ schema: zodSchema }),
      })

      // Extract sources - same logic as generateCompletion
      const sources: SearchSource[] = []

      // Check direct sources property (Perplexity returns sources here)
      if ((result as any).sources) {
        for (const s of (result as any).sources) {
          sources.push({
            url: s.url,
            title: s.title || s.name,
          })
        }
      }

      // Check providerMetadata for Perplexity sources
      const perplexityMeta = (result as any).providerMetadata?.perplexity
      if (perplexityMeta?.sources) {
        for (const s of perplexityMeta.sources) {
          sources.push({
            url: s.url || s,
            title: s.title || s.name || 'Perplexity Source',
          })
        }
      }

      // Check providerMetadata for OpenAI citations
      const openaiMeta = (result as any).providerMetadata?.openai
      if (openaiMeta?.annotations) {
        for (const annotation of openaiMeta.annotations) {
          if (annotation.type === 'url_citation' && annotation.url) {
            sources.push({
              url: annotation.url,
              title: annotation.title || annotation.text || 'Source',
            })
          }
        }
      }

      // Check tool results for web search sources
      if (result.toolResults) {
        for (const toolResult of result.toolResults) {
          if (toolResult.toolName?.includes('search') || toolResult.toolName?.includes('web')) {
            const searchResult = toolResult.result as any
            if (searchResult?.sources) {
              for (const s of searchResult.sources) {
                sources.push({
                  url: s.url || s.link,
                  title: s.title || s.name || 'Source',
                })
              }
            }
          }
        }
      }

      // Check for empty search results
      const searchWasUsed = result.toolCalls?.some(
        tc => tc.toolName.includes('search') || tc.toolName.includes('grounding')
      ) || provider.id === 'perplexity'  // Perplexity always searches
      const hasNoSources = sources.length === 0

      return {
        content: JSON.stringify(result.experimental_output),
        data: result.experimental_output,
        sources: sources.length > 0 ? sources : undefined,
        warning: searchWasUsed && hasNoSources
          ? 'Web search was attempted but returned no results.'
          : undefined,
      }
    }

    // Without web search: use generateObject (existing behavior)
    const { object } = await generateObject({
      model: aiModel,
      schema: zodSchema,
      prompt: promptWithSchema,
      temperature,
    })

    return {
      content: JSON.stringify(object),
      data: object
    }
  } catch (error) {
    console.error('Structured AI inference error:', error)

    // Check for web search specific errors first
    const webSearchError = classifyWebSearchError(error)
    if (webSearchError) {
      return {
        content: '',
        error: webSearchError.message,
        errorType: 'invalid_request',
      }
    }

    const errorType = classifyError(error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType
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
  onCellComplete?: (rowIndex: number, result: InferenceResult) => void,
  outputSchema?: OutputSchema,
  webSearch?: WebSearchConfig
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
        outputSchema: outputSchema?.mode === 'structured' ? outputSchema : undefined,
        webSearch,
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
      const cellResult: InferenceResult = {
        content: result.content,
        error: result.error,
        errorType: result.errorType,
        sources: result.sources,
        warning: result.warning,
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

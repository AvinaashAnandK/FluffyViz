# Web Search Augmentation v0 - Implementation Plan
Enable LLM-generated columns to access real-time web information when answering questions. This is critical for use cases where agent conversations reference current events, product information, or data that changes frequently.

### Supported Providers (v0)

| Provider | Search Mechanism | Notes |
|----------|------------------|-------|
| **OpenAI** | Responses API + `webSearchPreview` tool | Most models use Responses API |
| **OpenAI** | ChatCompletions API (search-preview models) | Built-in search, always-on |
| **Google Gemini** | `useSearchGrounding` flag or `googleSearch` tool | Model-level or tool-based |
| **Perplexity** | Native search (Sonar models) | Search always-on, no tool needed |

---

## 1. Model Registry Schema Updates

### File: `src/config/models/model-registry.yaml`

Add new fields to model definitions:

```yaml
# New fields per model:
apiMode: 'responses' | 'completions'  # Which API to use (OpenAI only)
searchSupport: boolean                 # Can use web search when enabled
searchBuiltIn: boolean                 # Search is always-on (no toggle needed)
```

### OpenAI Models Classification

Based on OpenAI platform data:

#### Responses API Models (use `webSearchPreview` tool)

```yaml
openai:
  text:
    # GPT-5 Series
    - id: gpt-5
      name: GPT-5
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Best model for coding and agentic tasks across domains
      recommended: true

    - id: gpt-5-mini
      name: GPT-5 Mini
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Faster, cost-efficient version for well-defined tasks
      recommended: true

    - id: gpt-5-nano
      name: GPT-5 Nano
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Fastest, most cost-efficient GPT-5 variant
      recommended: false

    - id: gpt-5-chat-latest
      name: GPT-5 Chat
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: GPT-5 model used in ChatGPT
      recommended: true

    # GPT-4.1 Series
    - id: gpt-4.1
      name: GPT-4.1
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Smartest non-reasoning model
      recommended: true

    - id: gpt-4.1-mini
      name: GPT-4.1 Mini
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Smaller, faster version of GPT-4.1
      recommended: false

    - id: gpt-4.1-nano
      name: GPT-4.1 Nano
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Fastest, most cost-efficient GPT-4.1 variant
      recommended: false

    # GPT-4o Series
    - id: gpt-4o
      name: GPT-4o
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Fast, intelligent, flexible model
      recommended: true

    - id: gpt-4o-mini
      name: GPT-4o Mini
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: Fast, affordable model for focused tasks
      recommended: false

    # O-Series Reasoning Models
    - id: o3
      name: o3
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 100000
      description: Reasoning model for complex tasks
      recommended: true

    - id: o3-mini
      name: o3-mini
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 65536
      description: Compact reasoning model alternative
      recommended: false

    - id: o4-mini
      name: o4-mini
      type: text
      apiMode: responses
      searchSupport: true
      contextWindow: 128000
      maxOutputTokens: 65536
      description: Fast, cost-efficient reasoning model
      recommended: false
```

#### ChatCompletions API Models (built-in search)

These models should ONLY appear in the model dropdown when web search is toggled ON:

```yaml
    # Search-Preview Models (ChatCompletions API with built-in search)
    - id: gpt-5-search-api
      name: GPT-5 Search
      type: text
      apiMode: completions
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: GPT-5 with built-in web search (always-on)
      recommended: false

    - id: gpt-4o-search-preview
      name: GPT-4o Search Preview
      type: text
      apiMode: completions
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: GPT-4o with built-in web search (always-on)
      recommended: true

    - id: gpt-4o-mini-search-preview
      name: GPT-4o Mini Search Preview
      type: text
      apiMode: completions
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 128000
      maxOutputTokens: 16384
      description: GPT-4o Mini with built-in web search (always-on)
      recommended: false
```

### Google Gemini Models

```yaml
google:
  text:
    - id: gemini-2.5-pro
      name: Gemini 2.5 Pro
      type: text
      searchSupport: true
      contextWindow: 200000
      maxOutputTokens: 8192
      description: Most advanced reasoning model, best for coding and complex tasks
      recommended: true

    - id: gemini-2.5-flash
      name: Gemini 2.5 Flash
      type: text
      searchSupport: true
      contextWindow: 1048576
      maxOutputTokens: 8192
      description: Balanced reasoning model with 1M context and thinking budgets
      recommended: true

    - id: gemini-2.0-flash
      name: Gemini 2.0 Flash
      type: text
      searchSupport: true
      contextWindow: 1048576
      maxOutputTokens: 8192
      description: Well-rounded multimodal model for diverse tasks
      recommended: true

    # Note: Gemma models do NOT support search grounding
    - id: gemma-3-27b-it
      name: Gemma 3 27B
      type: text
      searchSupport: false
      # ...
```

### Perplexity Provider (NEW)

Add Perplexity as a new provider:

```yaml
perplexity:
  text:
    - id: sonar
      name: Sonar
      type: text
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 127072
      maxOutputTokens: 8192
      description: Fast, web-grounded responses with citations
      recommended: true

    - id: sonar-pro
      name: Sonar Pro
      type: text
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 200000
      maxOutputTokens: 8192
      description: More capable model with better citations
      recommended: true

    - id: sonar-reasoning
      name: Sonar Reasoning
      type: text
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 127072
      maxOutputTokens: 8192
      description: Enhanced reasoning with web search
      recommended: false

    - id: sonar-reasoning-pro
      name: Sonar Reasoning Pro
      type: text
      searchSupport: true
      searchBuiltIn: true
      contextWindow: 127072
      maxOutputTokens: 8192
      description: Advanced reasoning with web search
      recommended: false

  embedding: []
```

---

## 2. Type System Updates

### File: `src/lib/model-registry-server.ts`

Update the Zod schema:

```typescript
const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'embedding']),
  contextWindow: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  dimensions: z.number().optional(),
  description: z.string().optional(),
  recommended: z.boolean().optional().default(false),
  // NEW fields for web search
  apiMode: z.enum(['responses', 'completions']).optional(),
  searchSupport: z.boolean().optional().default(false),
  searchBuiltIn: z.boolean().optional().default(false),
})
```

### File: `src/config/provider-settings.ts`

Add Perplexity provider:

```typescript
export type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'cohere'
  | 'groq'
  | 'huggingface'
  | 'google'
  | 'mistral'
  | 'perplexity'  // NEW

export const PROVIDER_META: Record<ProviderKey, ProviderMeta> = {
  // ... existing providers
  perplexity: {
    label: 'Perplexity',
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
}
```

### New Type: Web Search Configuration

Create `src/types/web-search.ts`:

```typescript
export type SearchContextSize = 'low' | 'medium' | 'high'

export interface UserLocation {
  type: 'approximate'
  city?: string
  region?: string
  country?: string
}

export interface WebSearchConfig {
  enabled: boolean
  contextSize: SearchContextSize
  userLocation?: UserLocation
}

export interface SearchSource {
  url: string
  title?: string
  snippet?: string
}

export interface WebSearchResult {
  sources: SearchSource[]
}
```

---

## 3. Inference Layer Updates

### File: `src/lib/ai-inference.ts`

#### 3.1 Install Perplexity SDK

```bash
npm install @ai-sdk/perplexity
```

#### 3.2 Updated Imports

```typescript
import { generateText, generateObject, embed, embedMany, Output } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createMistral } from '@ai-sdk/mistral'
import { createCohere } from '@ai-sdk/cohere'
import { createGroq } from '@ai-sdk/groq'
import { createPerplexity } from '@ai-sdk/perplexity'  // NEW
import { HfInference } from '@huggingface/inference'
```

#### 3.3 Extended Inference Options

```typescript
export interface InferenceOptions {
  model: Model
  provider: ModelProvider
  prompt: string
  temperature?: number
  maxTokens?: number
  webSearch?: WebSearchConfig  // NEW
}

export interface InferenceResult {
  content: string
  error?: string
  errorType?: FailureType
  sources?: SearchSource[]  // NEW
}
```

#### 3.4 Updated `getAISDKModel` Function

```typescript
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

      // For search-preview models (built-in search via ChatCompletions)
      if (modelConfig?.searchBuiltIn) {
        return provider(modelId)
      }

      // For Responses API models when web search is enabled
      if (webSearch?.enabled && modelConfig?.apiMode === 'responses') {
        return provider.responses(modelId)
      }

      // Default: standard ChatCompletions API
      return provider(modelId)
    }

    case 'google': {
      const provider = createGoogleGenerativeAI({ apiKey })

      // Enable search grounding when web search is enabled
      if (webSearch?.enabled && modelConfig?.searchSupport) {
        return provider(modelId, { useSearchGrounding: true })
      }

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
```

#### 3.5 Get Web Search Tools Function

```typescript
function getWebSearchTools(
  providerId: ProviderKey,
  webSearch: WebSearchConfig,
  apiKey: string
) {
  if (!webSearch.enabled) return undefined

  switch (providerId) {
    case 'openai': {
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
```

#### 3.6 Updated `generateCompletion` Function

```typescript
export async function generateCompletion(
  options: InferenceOptions
): Promise<InferenceResult> {
  const { provider, model, prompt, temperature = 0.7, maxTokens = 500, webSearch } = options

  try {
    if (!provider.apiKey) {
      throw new Error(`API key missing for provider: ${provider.id}`)
    }

    // Route to HuggingFace for HF models
    if (provider.id === 'huggingface') {
      return await generateHuggingFaceCompletion(options)
    }

    // Get model config for API mode detection
    const modelConfig = getModelById(model.id)

    // Get AI SDK model instance
    const aiModel = getAISDKModel(
      provider.id as ProviderKey,
      model.id,
      provider.apiKey,
      modelConfig,
      webSearch
    )

    // Get web search tools if enabled
    const tools = getWebSearchTools(
      provider.id as ProviderKey,
      webSearch || { enabled: false, contextSize: 'medium' },
      provider.apiKey
    )

    // Generate with or without tools
    const result = await generateText({
      model: aiModel,
      prompt,
      temperature,
      ...(tools && {
        tools,
        maxSteps: 3,  // Allow tool use round-trips
      }),
    })

    return {
      content: result.text,
      sources: result.sources?.map(s => ({
        url: s.url,
        title: s.title,
      })),
    }
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
```

#### 3.7 Updated `generateStructuredCompletion` Function

**Critical**: `generateObject` does NOT support tools. Use `generateText` with `experimental_output` when web search is enabled:

```typescript
export async function generateStructuredCompletion(
  options: StructuredInferenceOptions
): Promise<StructuredInferenceResult> {
  const { provider, model, prompt, outputSchema, temperature = 0.7, webSearch } = options

  try {
    if (!provider.apiKey) {
      throw new Error(`API key missing for provider: ${provider.id}`)
    }

    const zodSchema = buildZodSchema(outputSchema.fields)
    const promptWithSchema = prompt + generateSchemaPromptSuffix(outputSchema.fields)
    const modelConfig = getModelById(model.id)

    // HuggingFace: use text generation + parsing (no change)
    if (provider.id === 'huggingface') {
      // ... existing HuggingFace handling
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
        provider.apiKey
      )

      const result = await generateText({
        model: aiModel,
        prompt: promptWithSchema,
        temperature,
        ...(tools && {
          tools,
          maxSteps: 3,
        }),
        experimental_output: Output.object({ schema: zodSchema }),
      })

      return {
        content: JSON.stringify(result.experimental_output),
        data: result.experimental_output,
        sources: result.sources?.map(s => ({
          url: s.url,
          title: s.title,
        })),
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
      data: object,
    }
  } catch (error) {
    console.error('Structured AI inference error:', error)
    const errorType = classifyError(error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType,
    }
  }
}
```

---

## 4. API Route Updates

### File: `src/app/api/generate-column/route.ts`

#### 4.1 Updated Request Schema

```typescript
const {
  providerId,
  modelId,
  prompt,
  rows,
  temperature = 0.7,
  maxTokens = 500,
  outputSchema,
  webSearch,  // NEW: { enabled, contextSize, userLocation }
} = await req.json()
```

#### 4.2 Pass Web Search Config to Inference

```typescript
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
  webSearch,  // NEW
})
```

#### 4.3 Return Sources in Response

```typescript
return {
  ...result,
  rowIndex,
  sources: result.sources,  // NEW: include sources from web search
}
```

#### 4.4 Error Handling

Web search introduces new failure modes beyond standard LLM errors. Handle these explicitly.

##### 4.4.1 Error Types

Add web-search-specific error types to the existing classification:

```typescript
// src/types/web-search.ts
export type WebSearchErrorType =
  | 'search_no_results'      // Search returned empty results
  | 'search_rate_limit'      // Search API rate limited
  | 'search_timeout'         // Search took too long
  | 'search_quota_exceeded'  // Monthly/daily quota hit
  | 'search_provider_error'  // Provider-specific failure

export interface WebSearchError {
  type: WebSearchErrorType
  message: string
  retryable: boolean
  retryAfterMs?: number  // For rate limits
}
```

##### 4.4.2 Error Classification in Inference Layer

Update `src/lib/ai-inference.ts` to classify web search errors:

```typescript
function classifyWebSearchError(error: unknown): WebSearchError | null {
  const message = error instanceof Error ? error.message : String(error)
  const lowerMessage = message.toLowerCase()

  // OpenAI web search errors
  if (lowerMessage.includes('web_search') && lowerMessage.includes('rate')) {
    return {
      type: 'search_rate_limit',
      message: 'Web search rate limit reached. Try again in a few minutes.',
      retryable: true,
      retryAfterMs: 60000,  // 1 minute default
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

  return null  // Not a web search error
}
```

##### 4.4.3 Empty Search Results Handling

When web search returns no results, still return the LLM response with a warning:

```typescript
// In generateCompletion / generateStructuredCompletion
const result = await generateText({
  model: aiModel,
  prompt,
  tools,
  maxSteps: 3,
})

// Check for empty search results
const searchWasUsed = result.toolCalls?.some(
  tc => tc.toolName.includes('search') || tc.toolName.includes('grounding')
)
const hasNoSources = !result.sources || result.sources.length === 0

return {
  content: result.text,
  sources: result.sources,
  warning: searchWasUsed && hasNoSources
    ? 'Web search was attempted but returned no results. Response may lack current information.'
    : undefined,
}
```

##### 4.4.4 Batch Processing Error Handling

For batch column generation, handle partial failures gracefully:

```typescript
// In /api/generate-column/route.ts
interface BatchResult {
  rowIndex: number
  content: string
  sources?: SearchSource[]
  error?: string
  errorType?: FailureType | WebSearchErrorType
  warning?: string
  retryable?: boolean
}

async function processBatchWithRetry(
  rows: any[],
  options: InferenceOptions,
  maxRetries: number = 2
): Promise<BatchResult[]> {
  const results: BatchResult[] = []
  const retryQueue: { row: any; attempts: number }[] = rows.map(r => ({ row: r, attempts: 0 }))

  while (retryQueue.length > 0) {
    const batch = retryQueue.splice(0, BATCH_SIZE)

    const batchResults = await Promise.allSettled(
      batch.map(async ({ row, attempts }) => {
        try {
          const result = await generateCompletion({
            ...options,
            prompt: interpolatePrompt(options.prompt, row),
          })

          return {
            rowIndex: row.rowIndex,
            content: result.content,
            sources: result.sources,
            warning: result.warning,
          }
        } catch (error) {
          const webSearchError = classifyWebSearchError(error)

          // If retryable and under max attempts, requeue
          if (webSearchError?.retryable && attempts < maxRetries) {
            // Wait before retry (exponential backoff)
            await sleep(webSearchError.retryAfterMs || 1000 * (attempts + 1))
            retryQueue.push({ row, attempts: attempts + 1 })
            return null  // Will be retried
          }

          return {
            rowIndex: row.rowIndex,
            content: '',
            error: webSearchError?.message || (error instanceof Error ? error.message : 'Unknown error'),
            errorType: webSearchError?.type || classifyError(error),
            retryable: webSearchError?.retryable ?? true,
          }
        }
      })
    )

    // Collect non-null results
    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value)
      }
    }
  }

  return results
}
```

##### 4.4.5 Rate Limit Backoff Strategy

Implement exponential backoff for rate-limited requests:

```typescript
const BACKOFF_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitter: 0.1,  // Add 10% random jitter
}

function calculateBackoff(attempt: number, baseDelay?: number): number {
  const delay = baseDelay || BACKOFF_CONFIG.initialDelayMs
  const exponentialDelay = delay * Math.pow(BACKOFF_CONFIG.multiplier, attempt)
  const cappedDelay = Math.min(exponentialDelay, BACKOFF_CONFIG.maxDelayMs)
  const jitter = cappedDelay * BACKOFF_CONFIG.jitter * Math.random()
  return cappedDelay + jitter
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

##### 4.4.6 User-Facing Error Messages

Map technical errors to user-friendly messages in the UI:

```typescript
// src/lib/error-messages.ts
export const WEB_SEARCH_ERROR_MESSAGES: Record<WebSearchErrorType, {
  title: string
  description: string
  action: string
}> = {
  search_no_results: {
    title: 'No search results',
    description: 'Web search found no relevant information for this query.',
    action: 'The response was generated without web context. Consider rephrasing or retrying.',
  },
  search_rate_limit: {
    title: 'Search rate limited',
    description: 'Too many search requests in a short time.',
    action: 'Wait a minute and retry, or process fewer rows at once.',
  },
  search_timeout: {
    title: 'Search timed out',
    description: 'The web search took too long to complete.',
    action: 'Try a simpler query or retry. Complex queries may timeout.',
  },
  search_quota_exceeded: {
    title: 'Search quota exceeded',
    description: 'You have reached the search API limit for this period.',
    action: 'Wait until quota resets, or disable web search for this column.',
  },
  search_provider_error: {
    title: 'Search service error',
    description: 'The search provider encountered an error.',
    action: 'This is usually temporary. Retry in a few minutes.',
  },
}
```

##### 4.4.7 Partial Success Response

When a batch has mixed results, return detailed status:

```typescript
// API response structure for batch with partial failures
interface BatchResponse {
  success: boolean
  totalRows: number
  succeeded: number
  failed: number
  warnings: number
  results: BatchResult[]
  summary: {
    errorBreakdown: Record<string, number>  // Error type → count
    retryableCount: number
    hasWarnings: boolean
  }
}

// Example response
{
  success: true,  // true if ANY rows succeeded
  totalRows: 100,
  succeeded: 95,
  failed: 3,
  warnings: 2,
  results: [...],
  summary: {
    errorBreakdown: {
      'search_rate_limit': 2,
      'search_timeout': 1,
    },
    retryableCount: 3,
    hasWarnings: true,
  }
}
```

##### 4.4.8 Pre-Generation Validation

Before starting batch generation, validate configuration:

```typescript
async function validateWebSearchConfig(
  providerId: ProviderKey,
  modelId: string,
  webSearch: WebSearchConfig,
  rowCount: number
): Promise<{ valid: boolean; warnings: string[] }> {
  const warnings: string[] = []
  const modelConfig = getModelById(modelId)

  // Check if model supports web search
  if (webSearch.enabled && !modelConfig?.searchSupport) {
    return {
      valid: false,
      warnings: [`Model ${modelId} does not support web search.`],
    }
  }

  // Warn about potential costs for large batches
  if (webSearch.enabled && rowCount > 50) {
    warnings.push(
      `Web search enabled for ${rowCount} rows. This may result in ${rowCount}-${rowCount * 3} search queries and increased API costs.`
    )
  }

  // Warn about Perplexity always-on search
  if (providerId === 'perplexity' && !webSearch.enabled) {
    warnings.push(
      'Perplexity models always include web search. Toggle has no effect.'
    )
  }

  return { valid: true, warnings }
}
```

---

## 5. Sources Storage

When web search returns sources, store them in TWO places:

### 5.1 Cell Metadata

Store sources in the existing `cell_metadata` table:

```typescript
// In cell metadata update
await saveCellMetadata(fileId, rowId, columnId, {
  status: 'completed',
  sources: result.sources,  // Array of { url, title, snippet }
})
```

### 5.2 Automatic `_sources` Column

When generating an AI column with web search enabled, automatically create a companion `_sources` column:

```typescript
// After generating main column, create sources column
if (webSearch?.enabled) {
  const sourcesColumnId = `${columnId}_sources`

  // Add the sources column to the table
  await addColumn(fileId, sourcesColumnId, '')

  // Populate with JSON-stringified sources
  const sourcesUpdates = results.map(r => ({
    rowId: r.rowIndex,
    value: JSON.stringify(r.sources || [])
  }))

  await batchUpdateColumn(fileId, sourcesColumnId, sourcesUpdates)
}
```

---

## 6. UI Components

### 6.1 Web Search Toggle in AddColumnModal

#### File: `src/components/spreadsheet/AddColumnModal.tsx`

Add web search toggle and generation settings after provider/model selection:

```tsx
// State
const [temperature, setTemperature] = useState(0.7)
const [maxTokens, setMaxTokens] = useState(500)
const [webSearchEnabled, setWebSearchEnabled] = useState(false)
const [webSearchConfig, setWebSearchConfig] = useState<WebSearchConfig>({
  enabled: false,
  contextSize: 'medium',
  userLocation: undefined,
})

// UI: Web Search Toggle + Generation Settings Gear Icon
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Switch
      id="web-search"
      checked={webSearchEnabled}
      onCheckedChange={(checked) => {
        setWebSearchEnabled(checked)
        setWebSearchConfig(prev => ({ ...prev, enabled: checked }))
      }}
    />
    <Label htmlFor="web-search">Enable web search</Label>
  </div>

  {/* Generation settings gear - always visible */}
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm">
        <Settings2 className="h-4 w-4" />
        <span className="sr-only">Generation settings</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-80">
      <GenerationSettings
        temperature={temperature}
        maxTokens={maxTokens}
        webSearchEnabled={webSearchEnabled}
        webSearchConfig={webSearchConfig}
        onTemperatureChange={setTemperature}
        onMaxTokensChange={setMaxTokens}
        onWebSearchConfigChange={setWebSearchConfig}
      />
    </PopoverContent>
  </Popover>
</div>

{webSearchEnabled && (
  <p className="text-xs text-muted-foreground">
    LLM will search the web for current information. Adds latency and API costs.
  </p>
)}
```

### 6.2 Generation Settings Component

#### File: `src/components/spreadsheet/GenerationSettings.tsx` (NEW)

This component handles all generation settings (temperature, maxTokens) with conditional web search options when enabled.

```tsx
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import type { WebSearchConfig, SearchContextSize } from '@/types/web-search'

interface GenerationSettingsProps {
  temperature: number
  maxTokens: number
  webSearchEnabled: boolean
  webSearchConfig: WebSearchConfig
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onWebSearchConfigChange: (config: WebSearchConfig) => void
}

export function GenerationSettings({
  temperature,
  maxTokens,
  webSearchEnabled,
  webSearchConfig,
  onTemperatureChange,
  onMaxTokensChange,
  onWebSearchConfigChange,
}: GenerationSettingsProps) {
  return (
    <div className="space-y-4">
      {/* Always visible: Temperature */}
      <div className="space-y-2">
        <Label>Temperature</Label>
        <Slider
          value={[temperature]}
          onValueChange={([v]) => onTemperatureChange(v)}
          min={0}
          max={2}
          step={0.1}
        />
        <p className="text-xs text-muted-foreground">
          {temperature.toFixed(1)} — Higher = more creative, lower = more focused
        </p>
      </div>

      {/* Always visible: Max Tokens */}
      <div className="space-y-2">
        <Label>Max Tokens</Label>
        <Input
          type="number"
          value={maxTokens}
          onChange={(e) => onMaxTokensChange(Number(e.target.value))}
          min={1}
          max={8192}
        />
        <p className="text-xs text-muted-foreground">
          Maximum length of generated response
        </p>
      </div>

      {/* Conditionally visible: Web Search Settings */}
      {webSearchEnabled && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>Search Context Size</Label>
            <Select
              value={webSearchConfig.contextSize}
              onValueChange={(value: SearchContextSize) =>
                onWebSearchConfigChange({ ...webSearchConfig, contextSize: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low (faster, cheaper)</SelectItem>
                <SelectItem value="medium">Medium (balanced)</SelectItem>
                <SelectItem value="high">High (comprehensive)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controls how much search context is included in responses
            </p>
          </div>

          <div className="space-y-2">
            <Label>Location (optional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={webSearchConfig.userLocation?.city || ''}
                onChange={(e) =>
                  onWebSearchConfigChange({
                    ...webSearchConfig,
                    userLocation: {
                      type: 'approximate',
                      ...webSearchConfig.userLocation,
                      city: e.target.value || undefined,
                    },
                  })
                }
              />
              <Input
                placeholder="Region/State"
                value={webSearchConfig.userLocation?.region || ''}
                onChange={(e) =>
                  onWebSearchConfigChange({
                    ...webSearchConfig,
                    userLocation: {
                      type: 'approximate',
                      ...webSearchConfig.userLocation,
                      region: e.target.value || undefined,
                    },
                  })
                }
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Helps localize search results
            </p>
          </div>
        </>
      )}
    </div>
  )
}
```

### 6.3 Model Filtering Logic

When web search is toggled ON:
- Show all models with `searchSupport: true`
- Show search-preview models (models with `searchBuiltIn: true`)

When web search is toggled OFF:
- Hide models with `searchBuiltIn: true` (they require search to be useful)
- Show all other models normally

```typescript
// In AddColumnModal model selection
const filteredModels = useMemo(() => {
  return allModels.filter(model => {
    // If web search is enabled, show all search-capable models
    if (webSearchEnabled) {
      return model.searchSupport === true
    }

    // If web search is disabled, hide built-in search models
    // (they're only useful with search)
    return model.searchBuiltIn !== true
  })
}, [allModels, webSearchEnabled])
```

### 6.4 Provider Filtering for Web Search

Derive web-search-capable providers from the model registry (single source of truth):

```typescript
// Derive web-search-capable providers from model registry
const webSearchCapableProviders = useMemo(() => {
  const providers = new Set<ProviderKey>()
  allModels.forEach(model => {
    if (model.searchSupport) {
      providers.add(model.provider as ProviderKey)
    }
  })
  return providers
}, [allModels])

// When web search is enabled, filter to providers that have search-capable models
const availableProviders = useMemo(() => {
  if (!webSearchEnabled) {
    return enabledProviders
  }
  return enabledProviders.filter(p => webSearchCapableProviders.has(p))
}, [enabledProviders, webSearchEnabled, webSearchCapableProviders])
```

This approach:
- Uses model registry as single source of truth
- Auto-updates when new providers/models are added to registry
- No manual synchronization required between registry and UI code

---

## 7. Retry Workflow Updates

### File: `src/components/spreadsheet/RetryModal.tsx`

The retry workflow must preserve web search settings from the original column generation.

#### 7.1 Store Generation Config in Column Metadata

When generating a column, store all generation settings:

```typescript
// In column_metadata table
await saveColumnMetadata(fileId, columnId, {
  templateId,
  modelId,
  provider,
  promptTemplate,
  temperature,        // NEW: store temperature
  maxTokens,          // NEW: store max tokens
  webSearchConfig,    // NEW: store web search settings
  createdAt: new Date().toISOString(),
})
```

#### 7.2 Load Config in RetryModal

```typescript
// Load column metadata to get all generation settings
const columnMeta = await getColumnMetadata(fileId, columnId)
const originalWebSearchConfig = columnMeta?.webSearchConfig
const originalTemperature = columnMeta?.temperature ?? 0.7
const originalMaxTokens = columnMeta?.maxTokens ?? 500
```

#### 7.3 Retry Settings UI

The retry modal displays the same generation settings UI but with the web search **toggle locked** to the original state. Other settings (temperature, maxTokens, contextSize, location) are editable.

```tsx
// Web search enabled state is FIXED from original (cannot toggle)
const webSearchEnabled = originalWebSearchConfig?.enabled ?? false

// These are EDITABLE - initialized from original but can be changed
const [temperature, setTemperature] = useState(originalTemperature)
const [maxTokens, setMaxTokens] = useState(originalMaxTokens)
const [webSearchConfig, setWebSearchConfig] = useState<WebSearchConfig>({
  enabled: webSearchEnabled,  // locked
  contextSize: originalWebSearchConfig?.contextSize ?? 'medium',  // editable
  userLocation: originalWebSearchConfig?.userLocation,  // editable
})

// Model filtering uses same logic as AddColumnModal
const filteredModels = useMemo(() => {
  return allModels.filter(model => {
    if (webSearchEnabled) {
      return model.searchSupport === true
    }
    return model.searchBuiltIn !== true
  })
}, [allModels, webSearchEnabled])

// UI
<div className="space-y-4">
  {/* Read-only web search indicator */}
  <div className="flex items-center gap-2">
    <Switch
      id="web-search-retry"
      checked={webSearchEnabled}
      disabled={true}  // Cannot change in retry
    />
    <Label htmlFor="web-search-retry" className="text-muted-foreground">
      Web search {webSearchEnabled ? 'enabled' : 'disabled'} (from original)
    </Label>
  </div>

  {/* Settings gear - all settings editable except web search toggle */}
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="sm">
        <Settings2 className="h-4 w-4" />
        <span>Generation settings</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent className="w-80">
      <GenerationSettings
        temperature={temperature}
        maxTokens={maxTokens}
        webSearchEnabled={webSearchEnabled}
        webSearchConfig={webSearchConfig}
        onTemperatureChange={setTemperature}
        onMaxTokensChange={setMaxTokens}
        onWebSearchConfigChange={(config) =>
          // Preserve the locked enabled state
          setWebSearchConfig({ ...config, enabled: webSearchEnabled })
        }
      />
    </PopoverContent>
  </Popover>

  {/* Model selection - filtered same as AddColumnModal */}
  <Select value={selectedModel} onValueChange={setSelectedModel}>
    {filteredModels.map(model => (
      <SelectItem key={model.id} value={model.id}>
        {model.name}
      </SelectItem>
    ))}
  </Select>
</div>

// Pass settings to retry generation
const result = await generateCompletion({
  // ... other options
  temperature,
  maxTokens,
  webSearch: webSearchConfig,
})
```

---

## 8. DuckDB Schema Updates

### Column Metadata Table

Add generation config storage:

```sql
-- Add generation config columns if not exist
ALTER TABLE column_metadata ADD COLUMN IF NOT EXISTS
  temperature DOUBLE;           -- Temperature setting (0-2)

ALTER TABLE column_metadata ADD COLUMN IF NOT EXISTS
  max_tokens INTEGER;           -- Max tokens setting

ALTER TABLE column_metadata ADD COLUMN IF NOT EXISTS
  web_search_config VARCHAR;    -- JSON string of WebSearchConfig
```

### Cell Metadata Table

Add sources storage:

```sql
-- Add sources column if not exists
ALTER TABLE cell_metadata ADD COLUMN IF NOT EXISTS
  sources VARCHAR;  -- JSON string of SearchSource[]
```

---

## 9. Generation Workflow Summary

```
1. User opens AddColumnModal
   │
2. User toggles "Enable web search" ON
   │
   ├── Providers filtered to those with searchSupport models (derived from registry)
   ├── Models filtered to: searchSupport === true
   └── Search-preview models now visible (searchBuiltIn === true)
   │
3. User clicks gear icon to configure (optional)
   │
   ├── Temperature: 0-2 (always visible)
   ├── Max Tokens: 1-8192 (always visible)
   └── If web search enabled:
       ├── Search context size: low/medium/high
       └── User location: city, region
   │
4. User selects provider, model, writes prompt
   │
5. User clicks "Generate Column"
   │
6. API Route: /api/generate-column
   │
   ├── Receives: { providerId, modelId, prompt, rows, temperature, maxTokens, webSearch }
   │
   ├── Pre-generation validation (check model supports search, warn on large batches)
   │
   ├── For each row (with retry logic):
   │   │
   │   ├── Get model config (apiMode, searchBuiltIn, searchSupport)
   │   │
   │   ├── Get AI SDK model instance:
   │   │   ├── OpenAI Responses API: provider.responses(modelId)
   │   │   ├── OpenAI search-preview: provider(modelId)
   │   │   ├── Google: provider(modelId, { useSearchGrounding: true })
   │   │   └── Perplexity: provider(modelId) -- native search
   │   │
   │   ├── Get web search tools (if applicable):
   │   │   ├── OpenAI: openai.tools.webSearchPreview({ contextSize, userLocation })
   │   │   └── Google: google.tools.googleSearch({})
   │   │
   │   ├── If structured output + web search:
   │   │   └── Use generateText with experimental_output
   │   │
   │   ├── Else if text output:
   │   │   └── Use generateText with tools
   │   │
   │   ├── Collect result + sources
   │   │
   │   └── On error:
   │       ├── Classify error (web search vs standard)
   │       ├── If retryable: exponential backoff + retry (max 2)
   │       └── If not retryable: mark cell failed with error type
   │
   └── Return BatchResponse with results, summary, errorBreakdown
   │
7. SpreadsheetEditor receives results
   │
   ├── Update main column cells (succeeded rows)
   ├── Update cell metadata (including sources, warnings)
   ├── Mark failed cells with error type and message
   ├── Create/update _sources companion column
   └── Show summary toast: "95/100 succeeded, 3 failed (retryable), 2 warnings"
   │
8. Done - Column populated with web-grounded data (partial failures shown in UI)
```

---

## 10. Retry Workflow Summary

```
1. User clicks retry on failed cell(s)
   │
2. RetryModal opens
   │
   ├── Load column metadata (webSearchConfig, temperature, maxTokens)
   ├── Web search toggle: READ-ONLY (locked to original state)
   ├── Model filtering: same logic as AddColumnModal (based on web search state)
   └── Generation settings gear opens popover with:
       ├── Temperature: EDITABLE
       ├── Max Tokens: EDITABLE
       └── If web search enabled:
           ├── Context size: EDITABLE
           └── Location: EDITABLE
   │
3. User clicks "Retry"
   │
4. API Route: /api/generate-column (same as generation)
   │
   └── Uses:
       ├── Original webSearchConfig.enabled (locked)
       ├── Adjusted contextSize/userLocation (if changed)
       └── Adjusted temperature/maxTokens (if changed)
   │
5. Update cells and metadata
   │
6. Update _sources column if web search was used
```

---

## 11. Dependencies

### New NPM Package

```bash
npm install @ai-sdk/perplexity
```

### Existing Packages (already installed)

- `@ai-sdk/openai` - OpenAI provider with Responses API support
- `@ai-sdk/google` - Google provider with search grounding
- `ai` - Core AI SDK with `experimental_output` support

---

## 12. Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/types/web-search.ts` | WebSearchConfig, SearchSource, WebSearchError types |
| `src/components/spreadsheet/GenerationSettings.tsx` | Generation settings popover UI (temperature, maxTokens, web search config) |
| `src/lib/error-messages.ts` | User-facing error messages for web search errors |

### Modified Files

| File | Changes |
|------|---------|
| `src/config/models/model-registry.yaml` | Add apiMode, searchSupport, searchBuiltIn fields; Add Perplexity provider |
| `src/lib/model-registry-server.ts` | Update ModelConfigSchema with new fields |
| `src/config/provider-settings.ts` | Add 'perplexity' to ProviderKey and PROVIDER_META |
| `src/lib/ai-inference.ts` | Add web search support, Perplexity provider, experimental_output path, error classification |
| `src/app/api/generate-column/route.ts` | Accept webSearch config, temperature, maxTokens; return sources; batch error handling with retry |
| `src/components/spreadsheet/AddColumnModal.tsx` | Add web search toggle, generation settings gear, provider/model filtering derived from registry |
| `src/components/spreadsheet/RetryModal.tsx` | Load generation config from metadata; web search toggle read-only; temperature/maxTokens/contextSize/location editable; same model filtering as AddColumnModal |
| `src/lib/duckdb/schema.ts` | Add web_search_config, temperature, max_tokens, and sources columns |
| `src/lib/duckdb/operations.ts` | Handle sources column creation |

---

## 13. Testing Scenarios

### Provider-Specific Tests

1. **OpenAI Responses API**
   - Model: `gpt-4o` with web search enabled
   - Verify: Uses `openai.responses()` + `webSearchPreview` tool
   - Verify: Sources returned in response

2. **OpenAI Search-Preview**
   - Model: `gpt-4o-search-preview`
   - Verify: Uses standard `openai()` (built-in search)
   - Verify: Model only visible when web search toggle is ON

3. **Google Gemini**
   - Model: `gemini-2.5-flash` with web search enabled
   - Verify: Uses `useSearchGrounding: true`
   - Verify: Sources returned via grounding metadata

4. **Perplexity**
   - Model: `sonar-pro`
   - Verify: Search always-on (no toggle needed for functionality)
   - Verify: Sources/citations in response

### Structured Output + Web Search

1. Test `generateText` with `experimental_output` for:
   - Quality score evaluation with web fact-checking
   - Classification with current event context

### Retry Workflow

1. Retry with same web search config as original
2. Retry with web search toggled (on→off, off→on)
3. Retry with different context size

### Error Handling Tests

1. **Empty Search Results**
   - Trigger: Query with obscure/nonsensical topic
   - Verify: Response returned with `warning` field set
   - Verify: Cell status shows warning indicator in UI

2. **Rate Limit Handling**
   - Trigger: Rapid batch of 50+ rows
   - Verify: Automatic retry with exponential backoff
   - Verify: Partial results returned after max retries

3. **Partial Batch Failure**
   - Trigger: Mix of valid and invalid prompts
   - Verify: Succeeded rows populated correctly
   - Verify: Failed rows marked with appropriate error type
   - Verify: Summary includes `errorBreakdown` counts

4. **Pre-Generation Validation**
   - Test: Select non-search model with web search enabled
   - Verify: Validation returns `valid: false`
   - Test: Large batch (100+ rows) with web search
   - Verify: Warning about potential costs shown

5. **User-Facing Error Messages**
   - Verify: Each `WebSearchErrorType` maps to readable message
   - Verify: Action suggestions are actionable (not generic)

6. **Perplexity Always-On Warning**
   - Trigger: Select Perplexity with web search toggle OFF
   - Verify: Warning displayed that toggle has no effect

---

## References

- [AI SDK OpenAI Responses Guide](https://ai-sdk.dev/docs/guides/openai-responses)
- [AI SDK Perplexity Provider](https://ai-sdk.dev/providers/ai-sdk-providers/perplexity)
- [AI SDK Google Provider](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)
- [Google Gemini Search Grounding](https://ai.google.dev/gemini-api/docs/google-search)
- [OpenAI Responses vs ChatCompletions](https://platform.openai.com/docs/guides/responses-vs-chat-completions)

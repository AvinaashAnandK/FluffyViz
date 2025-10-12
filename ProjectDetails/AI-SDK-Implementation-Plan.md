# AI SDK Implementation Plan for FluffyViz

**Date:** January 2025
**Updated:** January 2025 (Task-based breakdown)
**Decision:** Hybrid approach - Vercel AI SDK + HuggingFace Inference Client

---

## Executive Summary

After comprehensive research and refinement, FluffyViz will use a **hybrid approach** combining:

1. **Vercel AI SDK** for major providers (OpenAI, Anthropic, Google, Mistral, Cohere, Groq, Together AI)
2. **@huggingface/inference** for full HuggingFace model ecosystem (800k+ models)
3. **YAML-based model registry** for maintainable configuration
4. **Server-side architecture** for security and flexibility

**Key Benefits:**
- ✅ 10/10 providers fully supported
- ✅ 1000+ embedding models available
- ✅ Type-safe with Zod validation
- ✅ Non-developers can add models via YAML
- ✅ Production-ready architecture

---

## Provider Coverage Matrix

| Provider | Implementation | Package | Text | Embeddings |
|----------|---------------|---------|------|------------|
| OpenAI | AI SDK | `@ai-sdk/openai` | ✅ | ✅ |
| Anthropic | AI SDK | `@ai-sdk/anthropic` | ✅ | ❌ |
| Google AI | AI SDK | `@ai-sdk/google` | ✅ | ✅ |
| Mistral | AI SDK | `@ai-sdk/mistral` | ✅ | ✅ |
| Cohere | AI SDK | `@ai-sdk/cohere` | ✅ | ✅ |
| Groq | AI SDK | `@ai-sdk/groq` | ✅ | ❌ |
| Together AI | AI SDK | `@ai-sdk/togetherai` | ✅ | ❌ |
| HuggingFace | HF Client | `@huggingface/inference` | ✅ | ✅ |
| Novita | AI SDK | Skip (not priority) | ⚠️ | ❌ |
| Local LLM | AI SDK | Skip (not priority) | ⚠️ | ❌ |

**Coverage: 8/10 providers (100% of priority providers)**

---

## Task Breakdown

### **Task 1: Install Dependencies**
**Priority:** High
**Estimated Time:** 15 minutes
**Dependencies:** None

**Actions:**
```bash
cd fluffy-viz

# Core AI SDK
npm install ai

# Major provider packages
npm install @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google \
  @ai-sdk/mistral @ai-sdk/cohere @ai-sdk/groq

# HuggingFace official client
npm install @huggingface/inference
```

**Acceptance Criteria:**
- [ ] All packages installed without errors
- [ ] `package.json` updated with correct versions
- [ ] TypeScript types available (check with `npm list @types/node`)

---

### **Task 2: Create Model Registry YAML Schema**
**Priority:** High
**Estimated Time:** 30 minutes
**Dependencies:** Task 1
**Status:** ✅ **COMPLETED**

**Files Created:**
- ✅ `/src/config/models/model-registry.yaml` - Model definitions (server-side)
- ✅ `/src/app/api/model-registry/route.ts` - API endpoint to serve registry
- ✅ `/src/config/model-registry.ts` - Loader with Zod validation

**What Was Done:**
- Created YAML structure with all 8 providers
- Added 40+ text generation models
- Added 15+ embedding models
- Marked recommended models for each provider
- Implemented server-side loading via API route
- Added Zod schemas for runtime validation
- Implemented caching for performance

**Helper Functions Available:**
```typescript
// Load registry once at app start
await loadModelRegistry()

// Get models for dropdowns
getModelsForProvider('openai', 'text')
getRecommendedModels('huggingface', 'embedding')

// Search across providers
searchModels('llama', 'text')

// Get specific model
getModelById('gpt-4o')
```

---

### **Task 3: Implement Unified Inference Layer**
**Priority:** High
**Estimated Time:** 2-3 hours
**Dependencies:** Task 1, Task 2

**File to Update:**
- `/src/lib/ai-inference.ts` (replace mock implementation)

**Implementation:**

```typescript
import { generateText, embed, embedMany } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { mistral } from '@ai-sdk/mistral'
import { cohere } from '@ai-sdk/cohere'
import { groq } from '@ai-sdk/groq'
import { InferenceClient } from '@huggingface/inference'
import type { ProviderKey } from '@/config/provider-settings'

/**
 * Get AI SDK model instance for major providers
 */
function getAISDKModel(
  providerId: ProviderKey,
  modelId: string,
  apiKey: string
) {
  switch (providerId) {
    case 'openai':
      return openai(modelId, { apiKey })
    case 'anthropic':
      return anthropic(modelId, { apiKey })
    case 'google':
      return google(modelId, { apiKey })
    case 'mistral':
      return mistral(modelId, { apiKey })
    case 'cohere':
      return cohere(modelId, { apiKey })
    case 'groq':
      return groq(modelId, { apiKey })
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

  const hf = new InferenceClient(apiKey)

  try {
    // Use chat completion for instruction models
    if (
      model.id.includes('Instruct') ||
      model.id.includes('chat') ||
      model.id.includes('Chat')
    ) {
      const response = await hf.chatCompletion({
        model: model.id,
        provider: ':auto', // Auto-select best provider
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
    throw new Error(
      `HuggingFace inference failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
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
      maxTokens,
    })

    return { content: text }
  } catch (error) {
    console.error('AI inference error:', error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
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
    const hf = new InferenceClient(apiKey)
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
    case 'openai':
      return openai.textEmbeddingModel(modelId, { apiKey })
    case 'google':
      return google.textEmbeddingModel(modelId, { apiKey })
    case 'mistral':
      return mistral.textEmbeddingModel(modelId, { apiKey })
    case 'cohere':
      return cohere.textEmbeddingModel(modelId, { apiKey })
    default:
      throw new Error(`Embeddings not supported for provider: ${provider}`)
  }
}
```

**Acceptance Criteria:**
- [ ] `generateCompletion()` works with all 8 providers
- [ ] HuggingFace uses chat completion for Instruct models
- [ ] Error handling returns structured error messages
- [ ] Existing `interpolatePromptForRow()` and `generateColumnData()` still work

---

### **Task 4: Create API Route for Inference**
**Priority:** High
**Estimated Time:** 1 hour
**Dependencies:** Task 3

**File to Create:**
- `/src/app/api/generate-column/route.ts`

**Implementation:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { generateCompletion, interpolatePromptForRow } from '@/lib/ai-inference'
import {
  loadProviderSettings,
  getProviderApiKey,
  isProviderEnabled,
} from '@/config/provider-settings'
import { getModelById } from '@/config/model-registry'

export async function POST(req: NextRequest) {
  try {
    const {
      providerId,
      modelId,
      prompt,
      rows,
      temperature,
      maxTokens,
    } = await req.json()

    // Load provider config
    const config = await loadProviderSettings()

    // Validate provider is enabled
    if (!isProviderEnabled(config, providerId)) {
      return NextResponse.json(
        { error: `Provider ${providerId} is not enabled or configured` },
        { status: 400 }
      )
    }

    // Get API key
    const apiKey = getProviderApiKey(config, providerId)
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Provider API key not found' },
        { status: 400 }
      )
    }

    // Get model config
    const modelConfig = getModelById(modelId)
    if (!modelConfig) {
      return NextResponse.json(
        { error: `Model ${modelId} not found` },
        { status: 404 }
      )
    }

    // Process each row
    const results = []
    for (const row of rows) {
      const interpolatedPrompt = interpolatePromptForRow(prompt, row)

      const result = await generateCompletion({
        model: { id: modelId, name: modelConfig.name },
        provider: { id: providerId, apiKey, displayName: modelConfig.provider },
        prompt: interpolatedPrompt,
        temperature,
        maxTokens,
      })

      results.push(result)
    }

    return NextResponse.json({ results })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

**Acceptance Criteria:**
- [ ] POST `/api/generate-column` endpoint works
- [ ] Validates provider is enabled
- [ ] Interpolates prompts for each row
- [ ] Returns array of results with content/error
- [ ] API keys never exposed to client

---

### **Task 5: Update AddColumnModal to Use Model Registry**
**Priority:** Medium
**Estimated Time:** 2-3 hours
**Dependencies:** Task 2, Task 3

**Files to Update:**
- `/src/components/spreadsheet/AddColumnModal.tsx`
- `/src/components/spreadsheet/ProviderSelector.tsx` (add filtering logic)
- `/src/components/spreadsheet/ModelSelector.tsx` (use model registry)

**Changes Needed:**

1. **Filter providers based on API key configuration:**
   - Only show providers that have API keys configured
   - Use `isProviderEnabled()` from `provider-settings.ts`
   - Show empty state if no providers configured

2. **Update model dropdown to use model registry:**
   - Call `getModelsForProvider(providerId, 'text')`
   - Show "Recommended" section first
   - Add model descriptions in dropdown

3. **Add empty state UI:**
   - When no providers are configured, show helpful message
   - Add button to navigate to provider configuration
   - Clear instructions on what to do next

**Example Implementation:**

```typescript
import { getModelsForProvider, getRecommendedModels } from '@/config/model-registry'
import {
  loadProviderSettings,
  getEnabledProviders,
  isProviderEnabled
} from '@/config/provider-settings'
import { PROVIDER_META } from '@/config/provider-settings'

function AddColumnModal() {
  const [config, setConfig] = useState<ProviderSettings | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null)

  // Load provider config on mount
  useEffect(() => {
    loadProviderSettings().then(setConfig)
  }, [])

  // Get only enabled providers
  const enabledProviders = config ? getEnabledProviders(config) : []

  // Check if any providers are configured
  if (enabledProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No LLM Provider Configured</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md">
          To use AI-powered columns, you need to configure at least one LLM provider
          with an API key.
        </p>
        <Button onClick={() => navigateToProviderConfig()}>
          Add LLM Provider Keys
        </Button>
      </div>
    )
  }

  return (
    // ... rest of modal UI
  )
}

function ProviderSelector({ config, onSelect }) {
  const enabledProviders = getEnabledProviders(config)

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Select provider" />
      </SelectTrigger>
      <SelectContent>
        {enabledProviders.map(providerId => {
          const meta = PROVIDER_META[providerId]
          return (
            <SelectItem key={providerId} value={providerId}>
              <div className="flex items-center gap-2">
                <span>{meta.label}</span>
                {meta.freeTier && (
                  <Badge variant="secondary" className="text-xs">Free</Badge>
                )}
              </div>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

function ModelSelector({ providerId, onSelect }) {
  // Only get models for text generation (not embeddings)
  const allModels = getModelsForProvider(providerId, 'text')
  const recommendedModels = getRecommendedModels(providerId, 'text')

  if (allModels.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No models available for this provider
      </div>
    )
  }

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {recommendedModels.length > 0 && (
          <>
            <SelectGroup>
              <SelectLabel>Recommended</SelectLabel>
              {recommendedModels.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {model.description}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
          </>
        )}

        <SelectGroup>
          <SelectLabel>All Models</SelectLabel>
          {allModels.map(model => (
            <SelectItem key={model.id} value={model.id}>
              {model.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
```

**Empty State Design:**
```
┌─────────────────────────────────────────────┐
│                                             │
│              🔴 (AlertCircle Icon)          │
│                                             │
│        No LLM Provider Configured           │
│                                             │
│  To use AI-powered columns, you need to    │
│  configure at least one LLM provider with   │
│  an API key.                                │
│                                             │
│       [Add LLM Provider Keys] (Button)      │
│                                             │
└─────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Provider dropdown only shows enabled providers (with API keys)
- [ ] Empty state shows when no providers configured
- [ ] "Add LLM Provider Keys" button navigates to provider config
- [ ] Model dropdown shows recommended models first
- [ ] Model dropdown filtered to text generation models only
- [ ] Model descriptions visible in dropdown
- [ ] Badge shows "Free" for providers with free tier

---

### **Task 6: Add Error Handling and User Feedback**
**Priority:** High
**Estimated Time:** 2 hours
**Dependencies:** Task 3, Task 4

**Files to Update:**
- `/src/lib/ai-inference.ts` (add retry logic)
- `/src/components/spreadsheet/AddColumnModal.tsx` (show errors)

**Implementation Details:**

1. **Retry Logic with Exponential Backoff:**
```typescript
async function generateWithRetry(
  fn: () => Promise<InferenceResult>,
  maxRetries = 3
): Promise<InferenceResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, i) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  throw new Error('Max retries exceeded')
}
```

2. **User-Friendly Error Messages:**
```typescript
function formatErrorMessage(error: Error, provider: string): string {
  if (error.message.includes('API key')) {
    return `Invalid API key for ${provider}. Please check your configuration.`
  }
  if (error.message.includes('rate limit')) {
    return `Rate limit exceeded for ${provider}. Please try again in a moment.`
  }
  if (error.message.includes('timeout')) {
    return `Request timed out for ${provider}. The model may be loading.`
  }
  return `Error with ${provider}: ${error.message}`
}
```

3. **Progress Tracking:**
- Update `onProgress` callback to show current row
- Display error count
- Allow cancellation

**Acceptance Criteria:**
- [ ] Failed requests retry up to 3 times
- [ ] Exponential backoff between retries
- [ ] User-friendly error messages shown in UI
- [ ] Progress indicator shows current row / total rows
- [ ] Errors don't crash entire batch process

---

### **Task 7: Initialize Model Registry on App Start**
**Priority:** High
**Estimated Time:** 30 minutes
**Dependencies:** Task 2

**File to Update:**
- `/src/app/layout.tsx`

**Implementation:**

```typescript
import { loadModelRegistry } from '@/config/model-registry'

export default async function RootLayout({ children }) {
  // Load model registry on server-side during app initialization
  try {
    await loadModelRegistry()
  } catch (error) {
    console.error('Failed to load model registry:', error)
    // Optionally show error UI or use fallback
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
```

**Acceptance Criteria:**
- [ ] Model registry loads once at app start
- [ ] Registry cached in memory
- [ ] Helper functions work after load
- [ ] Errors logged but don't crash app

---

### **Task 8: Test with Real Providers (Text Generation Only)**
**Priority:** High
**Estimated Time:** 2-3 hours
**Dependencies:** All previous tasks

**Scope:** Focus on **AI column generation only** (not embeddings, not new rows)

**Testing Matrix:**

| Provider | Text Generation Model | Notes |
|----------|----------------------|-------|
| OpenAI | gpt-4o-mini | Cheapest, fastest |
| Anthropic | claude-3-5-haiku | Fastest model |
| Google | gemini-1.5-flash | Free tier |
| Mistral | mistral-small-latest | Free tier |
| Cohere | command-r | Free tier |
| Groq | llama-3.1-8b-instant | Free tier, ultra-fast |
| HuggingFace | meta-llama/Llama-3.1-8B-Instruct | Free tier |

**Test Cases:**

1. **Single Row Generation:**
   - Upload sample file with 1 row (e.g., agent conversation log)
   - Open AddColumnModal
   - Select provider (e.g., OpenAI)
   - Select model (e.g., gpt-4o-mini)
   - Create simple prompt: "Summarize: {{user_message}}"
   - Click "Generate"
   - Verify output appears in new column

2. **Batch Generation (10 rows):**
   - Upload file with 10 rows
   - Create AI column with prompt: "Classify sentiment: {{message}}"
   - Verify all 10 rows processed
   - Check progress indicator shows "3/10", "4/10", etc.
   - Verify results appear in column

3. **Error Handling:**
   - **Invalid API key:** Remove API key, attempt generation → should show error
   - **No provider configured:** Clear all API keys → should show empty state UI
   - **Non-existent model:** Manually set invalid model ID → should error gracefully
   - **Rate limiting:** Test with provider known to rate limit → should retry with backoff

4. **Provider-Specific Tests:**
   - **HuggingFace:** Test with Instruct model (chat completion) vs base model (text generation)
   - **Anthropic:** Test with system prompt support
   - **Google:** Test with Gemini long context (large prompt)
   - **Groq:** Test speed (should be noticeably faster)

5. **UI/UX Validation:**
   - Empty state shows when no providers configured
   - "Add LLM Provider Keys" button works
   - Provider dropdown only shows enabled providers
   - Model dropdown shows recommended models first
   - Progress tracking updates in real-time
   - Errors display user-friendly messages

**Acceptance Criteria:**
- [ ] All 7 providers successfully generate text for columns
- [ ] Single row generation works correctly
- [ ] Batch generation (10 rows) completes without errors
- [ ] Progress tracking shows current row / total rows
- [ ] Empty state UI appears when no providers configured
- [ ] Provider filtering works (only shows configured providers)
- [ ] Error messages are user-friendly and actionable
- [ ] Generated outputs are sensible and relevant to prompts
- [ ] HuggingFace works with both Instruct and base models

**Out of Scope for This Task:**
- ❌ Embeddings generation (future feature)
- ❌ New row addition (only testing column addition)
- ❌ Cost tracking
- ❌ Streaming responses

---

### **Task 9: Documentation and Testing**

**Priority:** Medium
**Estimated Time:** 2-3 hours
**Dependencies:** All previous tasks

**Documentation to Update:**

1. **CLAUDE.md:**
   - Update AI inference section
   - Document model registry usage
   - Add provider configuration guide

2. **Add comments to code:**
   - Document all public functions
   - Add JSDoc for complex logic
   - Include usage examples

3. **Create tests:**
   - Unit tests for `interpolatePromptForRow()`
   - Unit tests for model registry helpers
   - Integration tests for inference functions
   - Mock API responses for testing

**Test Files to Create:**
- `/src/lib/__tests__/ai-inference.test.ts`
- `/src/config/__tests__/model-registry.test.ts`

**Acceptance Criteria:**
- [ ] All major functions have JSDoc comments
- [ ] CLAUDE.md updated with new architecture
- [ ] Unit tests cover >80% of new code
- [ ] Integration tests pass with mocked providers

---

## Implementation Checklist

### **Pre-Implementation**
- [x] Research AI SDK vs LangChain
- [x] Design hybrid architecture
- [x] Create YAML model registry schema
- [x] Move registry to server-side

### **Core Implementation**
- [ ] Task 1: Install dependencies
- [ ] Task 2: Create model registry ✅ **COMPLETED**
- [ ] Task 3: Implement unified inference layer
- [ ] Task 4: Create API route for inference
- [ ] Task 5: Update AddColumnModal (with provider filtering & empty state)
- [ ] Task 6: Add error handling
- [ ] Task 7: Initialize registry on app start
- [ ] Task 8: Test with real providers (text generation only)

### **Polish & Documentation**
- [ ] Task 9: Documentation and testing

### **Out of Scope for This Implementation**
- ❌ Cost tracking (not needed)
- ❌ Embeddings generation (future feature)
- ❌ New row addition (only column addition)
- ❌ Streaming support (future enhancement)

### **Future Enhancements**
- [ ] Add embeddings UI for index creation
- [ ] Add streaming support for real-time UI updates
- [ ] Implement caching for identical prompts
- [ ] Add batch parallelization for faster generation
- [ ] Add provider-specific optimizations
- [ ] Add cost tracking (optional)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ User Interface                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  AddColumnModal                                                 │
│    ├─> Provider Selector (from provider-settings.ts)           │
│    ├─> Model Selector (from model-registry.yaml)               │
│    └─> PromptComposer (TipTap with variable pills)             │
│              │                                                  │
│              └─> serializePrompt() → "{{column_slug}}" template│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ POST /api/generate-column
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Route (Server)                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /api/generate-column                                           │
│    ├─> Load provider config (provider-settings.ts)             │
│    ├─> Get API key                                             │
│    ├─> Load model metadata (model-registry.yaml)               │
│    └─> For each row:                                           │
│         ├─> interpolatePromptForRow()                          │
│         └─> generateCompletion()                               │
│                   │                                             │
└───────────────────┼─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Inference Layer (ai-inference.ts)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  generateCompletion(options)                                    │
│    │                                                            │
│    ├─> If provider === 'huggingface'                           │
│    │     └─> HuggingFace Inference Client                      │
│    │           ├─> chatCompletion() (for Instruct models)      │
│    │           └─> textGeneration() (for base models)          │
│    │                                                            │
│    └─> Else (major providers)                                  │
│          └─> Vercel AI SDK                                     │
│                ├─> openai(model, { apiKey })                   │
│                ├─> anthropic(model, { apiKey })                │
│                ├─> google(model, { apiKey })                   │
│                ├─> mistral(model, { apiKey })                  │
│                ├─> cohere(model, { apiKey })                   │
│                └─> groq(model, { apiKey })                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Provider APIs (External)                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  - api.openai.com                                               │
│  - api.anthropic.com                                            │
│  - generativelanguage.googleapis.com                            │
│  - api.mistral.ai                                               │
│  - api.cohere.com                                               │
│  - api.groq.com                                                 │
│  - api-inference.huggingface.co                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Model Registry Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Server-Side Configuration                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  /src/config/models/model-registry.yaml                         │
│    ├─> openai:                                                  │
│    │     ├─> text: [gpt-4o, gpt-4o-mini, ...]                  │
│    │     └─> embedding: [text-embedding-3-large, ...]          │
│    ├─> anthropic:                                               │
│    │     ├─> text: [claude-3-5-sonnet, ...]                    │
│    │     └─> embedding: []                                      │
│    └─> huggingface:                                             │
│          ├─> text: [Llama-3.1-8B-Instruct, ...]                │
│          └─> embedding: [bge-base-en-v1.5, ...]                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ fs.readFile()
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Route                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  GET /api/model-registry                                        │
│    ├─> Read YAML from filesystem                               │
│    ├─> Parse YAML → JSON                                       │
│    └─> Return JSON response                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ fetch('/api/model-registry')
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Client-Side Loader (model-registry.ts)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  loadModelRegistry()                                            │
│    ├─> Fetch JSON from API                                     │
│    ├─> Validate with Zod schemas                               │
│    ├─> Cache in memory (cachedRegistry)                        │
│    └─> Inject provider names into model configs                │
│                                                                 │
│  Helper Functions:                                              │
│    ├─> getModelsForProvider(provider, type)                    │
│    ├─> getRecommendedModels(provider, type)                    │
│    ├─> searchModels(query, type, provider)                     │
│    └─> getModelById(modelId)                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    │ Used by
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ UI Components                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ModelSelector.tsx                                              │
│  EmbeddingSelector.tsx                                          │
│  AddColumnModal.tsx                                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting Guide

### Common Issues

**Issue: "Model registry not loaded"**
- **Cause:** `loadModelRegistry()` not called at app start
- **Solution:** Add to `app/layout.tsx` server component
- **Check:** Verify `/api/model-registry` returns JSON

**Issue: "Provider not supported"**
- **Cause:** Provider ID not in switch statement
- **Solution:** Add provider to `getAISDKModel()` or use HuggingFace
- **Check:** Verify `provider-settings.ts` has provider definition

**Issue: HuggingFace "Model loading"**
- **Cause:** Cold start for serverless inference
- **Solution:** Retry after 20 seconds or use popular models
- **Check:** Visit https://huggingface.co/[model-id] to verify model exists

**Issue: "API key not configured"**
- **Cause:** Provider not enabled in `provider-config.json`
- **Solution:** Use AI Provider Config UI to add API key
- **Check:** Verify `isProviderEnabled()` returns true

**Issue: Rate limit errors**
- **Cause:** Too many requests to provider
- **Solution:** Implement delay between rows (100-200ms)
- **Check:** Review provider rate limit docs

---

## Security Checklist

- [x] Model registry stored server-side (not in `/public`)
- [x] API keys never sent to client
- [x] API routes validate provider configuration
- [x] Zod validation on all YAML inputs
- [ ] Environment variables for production API keys
- [ ] Rate limiting on API routes
- [ ] Input sanitization for user prompts
- [ ] Max token limits to prevent runaway costs

---

## References

### Documentation
- [Vercel AI SDK](https://ai-sdk.dev/docs)
- [HuggingFace Inference API](https://huggingface.co/docs/api-inference)
- [Zod Validation](https://zod.dev/)

### Related Project Files
- `CLAUDE.md` - Project architecture
- `ProjectDetails/ClaudeOct5/files-requiring-changes.md` - Roadmap
- `ProjectDetails/PromptEditorRevamp/tech-plan.md` - PromptComposer spec

### Provider Docs
- [OpenAI API](https://platform.openai.com/docs)
- [Anthropic](https://docs.anthropic.com/)
- [Google AI](https://ai.google.dev/docs)
- [Mistral](https://docs.mistral.ai/)
- [Cohere](https://docs.cohere.com/)
- [Groq](https://console.groq.com/docs)
- [HuggingFace](https://huggingface.co/docs/api-inference)

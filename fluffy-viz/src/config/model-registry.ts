/**
 * Model Registry Configuration
 * Loads model definitions from server-side YAML via API and provides type-safe access
 */

import { z } from 'zod'

/**
 * Zod schema for model configuration validation
 */
const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'embedding']),
  contextWindow: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  dimensions: z.number().optional(),
  description: z.string().optional(),
  recommended: z.boolean().optional().default(false),
  // Web search fields
  apiMode: z.enum(['responses', 'completions']).optional(),
  searchSupport: z.boolean().optional().default(false),
  searchBuiltIn: z.boolean().optional().default(false),
})

const ProviderModelsSchema = z.object({
  text: z.array(ModelConfigSchema).default([]),
  embedding: z.array(ModelConfigSchema).default([]),
})

const ModelRegistrySchema = z.record(z.string(), ProviderModelsSchema)

/**
 * TypeScript types inferred from Zod schemas
 */
export type ModelConfig = z.infer<typeof ModelConfigSchema>
export type ProviderModels = z.infer<typeof ProviderModelsSchema>
export type ModelRegistry = z.infer<typeof ModelRegistrySchema>

/**
 * Cache for loaded registry
 */
let cachedRegistry: ModelRegistry | null = null

/**
 * Load and validate model registry from API
 */
export async function loadModelRegistry(): Promise<ModelRegistry> {
  if (cachedRegistry) {
    return cachedRegistry
  }

  try {
    // Fetch from API route (server-side YAML loading)
    const response = await fetch('/api/model-registry')

    if (!response.ok) {
      throw new Error(`Failed to load model registry: ${response.statusText}`)
    }

    const rawData = await response.json()

    // Validate and parse with Zod
    const registry = ModelRegistrySchema.parse(rawData)

    // Inject provider name into each model config
    for (const [providerName, providerModels] of Object.entries(registry)) {
      for (const model of [...providerModels.text, ...providerModels.embedding]) {
        ;(model as any).provider = providerName
      }
    }

    cachedRegistry = registry
    return registry
  } catch (error) {
    console.error('Error loading model registry:', error)
    throw new Error(
      `Failed to load model registry: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Get the cached registry (synchronous access after initial load)
 */
function getRegistry(): ModelRegistry {
  if (!cachedRegistry) {
    throw new Error(
      'Model registry not loaded. Call loadModelRegistry() first.'
    )
  }
  return cachedRegistry
}

/**
 * Get available models for a provider and type
 */
export function getModelsForProvider(
  provider: string,
  type: 'text' | 'embedding'
): ModelConfig[] {
  const registry = getRegistry()
  return registry[provider]?.[type] || []
}

/**
 * Get text models for a provider
 */
export function getTextModelsForProvider(provider: string): ModelConfig[] {
  return getModelsForProvider(provider, 'text')
}

/**
 * Get embedding models for a provider
 */
export function getEmbeddingModelsForProvider(provider: string): ModelConfig[] {
  return getModelsForProvider(provider, 'embedding')
}

/**
 * Get recommended models for a provider and type
 */
export function getRecommendedModels(
  provider: string,
  type: 'text' | 'embedding'
): ModelConfig[] {
  return getModelsForProvider(provider, type).filter(model => model.recommended)
}

/**
 * Get model by ID across all providers
 */
export function getModelById(modelId: string): ModelConfig | undefined {
  const registry = getRegistry()

  for (const provider of Object.keys(registry)) {
    const textModels = registry[provider].text
    const embeddingModels = registry[provider].embedding

    const found = [...textModels, ...embeddingModels].find(m => m.id === modelId)
    if (found) return found
  }
  return undefined
}

/**
 * Search models across all providers
 * @param query - Search query string
 * @param type - Filter by model type ('text' or 'embedding')
 * @param providers - Filter by specific providers (array of provider keys)
 */
export function searchModels(
  query: string,
  type?: 'text' | 'embedding',
  providers?: string[]
): ModelConfig[] {
  const registry = getRegistry()
  const results: ModelConfig[] = []
  const lowerQuery = query.toLowerCase()

  const providersToSearch = providers && providers.length > 0
    ? providers
    : Object.keys(registry)

  for (const prov of providersToSearch) {
    const types = type ? [type] : ['text', 'embedding'] as const

    for (const t of types) {
      const models = registry[prov]?.[t] || []
      const matches = models.filter(model =>
        model.name.toLowerCase().includes(lowerQuery) ||
        model.id.toLowerCase().includes(lowerQuery) ||
        model.description?.toLowerCase().includes(lowerQuery)
      )
      results.push(...matches)
    }
  }

  return results
}

/**
 * Get all text models from enabled providers with text capability
 * @param enabledProviders - Array of enabled provider keys
 */
export function getTextModelsForEnabledProviders(
  enabledProviders: string[]
): ModelConfig[] {
  const registry = getRegistry()
  const results: ModelConfig[] = []

  for (const provider of enabledProviders) {
    const textModels = registry[provider]?.text || []
    results.push(...textModels)
  }

  return results
}

/**
 * Get all embedding models from enabled providers with embedding capability
 * @param enabledProviders - Array of enabled provider keys
 */
export function getEmbeddingModelsForEnabledProviders(
  enabledProviders: string[]
): ModelConfig[] {
  const registry = getRegistry()
  const results: ModelConfig[] = []

  for (const provider of enabledProviders) {
    const embeddingModels = registry[provider]?.embedding || []
    results.push(...embeddingModels)
  }

  return results
}

/**
 * Validate if a model supports a capability
 */
export function supportsCapability(
  provider: string,
  capability: 'text' | 'embedding'
): boolean {
  const registry = getRegistry()
  return (registry[provider]?.[capability]?.length ?? 0) > 0
}

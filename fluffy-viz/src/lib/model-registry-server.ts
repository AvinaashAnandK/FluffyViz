/**
 * Server-side model registry utilities
 * DO NOT IMPORT IN CLIENT CODE - use model-registry.ts instead
 */

import { readFile } from 'fs/promises'
import { join } from 'path'
import yaml from 'js-yaml'

/**
 * Zod schema for model configuration validation
 */
import { z } from 'zod'

const ModelConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'embedding']),
  contextWindow: z.number().optional(),
  maxOutputTokens: z.number().optional(),
  dimensions: z.number().optional(),
  description: z.string().optional(),
  recommended: z.boolean().optional().default(false),
})

const ProviderModelsSchema = z.object({
  text: z.array(ModelConfigSchema).default([]),
  embedding: z.array(ModelConfigSchema).default([]),
})

const ModelRegistrySchema = z.record(z.string(), ProviderModelsSchema)

export type ModelConfig = z.infer<typeof ModelConfigSchema>
export type ProviderModels = z.infer<typeof ProviderModelsSchema>
export type ModelRegistry = z.infer<typeof ModelRegistrySchema>

/**
 * Cache for loaded registry
 */
let cachedRegistry: ModelRegistry | null = null

/**
 * Load and validate model registry from filesystem (server-side)
 */
export async function loadModelRegistryServer(): Promise<ModelRegistry> {
  if (cachedRegistry) {
    return cachedRegistry
  }

  try {
    // Read YAML from filesystem
    const yamlPath = join(process.cwd(), 'src', 'config', 'models', 'model-registry.yaml')
    const yamlText = await readFile(yamlPath, 'utf-8')

    // Parse YAML to JSON
    const rawData = yaml.load(yamlText)

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
      'Model registry not loaded. Call loadModelRegistryServer() first.'
    )
  }
  return cachedRegistry
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
 * Get all text models from enabled providers
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

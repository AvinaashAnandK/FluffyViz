/**
 * TypeScript types for HuggingFace Hub API integration
 * Used for dynamic model discovery and inference provider selection
 */

/**
 * Inference provider status from HF Hub API
 */
export type HFProviderStatus = 'live' | 'staging' | 'disabled'

/**
 * Single inference provider mapping for a model
 */
export interface HFInferenceProviderMapping {
  status: HFProviderStatus
  providerId: string  // Provider-specific model ID
  task: string        // e.g., 'conversational', 'text-generation'
}

/**
 * Full inference provider mapping object from HF Hub API
 * Keys are provider IDs (e.g., 'groq', 'nebius', 'together')
 */
export type HFInferenceProviderMap = Record<string, {
  status: HFProviderStatus
  provider_id: string
  task: string
}>

/**
 * Inference provider with display information
 */
export interface HFInferenceProvider {
  id: string              // Provider ID (e.g., 'groq', 'nebius')
  name: string            // Display name
  providerModelId: string // Provider-specific model ID
  status: HFProviderStatus
  task: string
}

/**
 * Model search result from HF Hub API
 */
export interface HFModelSearchResult {
  id: string                      // Full model ID (e.g., 'meta-llama/Llama-3.3-70B-Instruct')
  name: string                    // Display name
  author?: string                 // Model author/organization
  downloads?: number              // Download count (for popularity sorting)
  likes?: number                  // Like count
  pipelineTag?: string            // Task type (e.g., 'text-generation', 'feature-extraction')
  parameterCount?: number | null  // Parameter count from safetensors metadata
  parameterCountFormatted?: string // Formatted (e.g., '70B', '7B')
  inferenceProviderCount: number  // Number of live providers
  lastModified?: string           // ISO date string
  private?: boolean
  gated?: boolean | 'auto' | 'manual'
  description?: string
  tags?: string[]
}

/**
 * Detailed model info from HF Hub API
 */
export interface HFModelInfo {
  id: string
  author?: string
  downloads?: number
  likes?: number
  pipelineTag?: string
  parameterCount?: number | null
  parameterCountFormatted?: string
  inferenceProviders: HFInferenceProvider[]
  lastModified?: string
  description?: string
  cardData?: {
    license?: string
    language?: string | string[]
    tags?: string[]
  }
}

/**
 * Response from /api/huggingface/models endpoint
 */
export interface HFModelsResponse {
  models: HFModelSearchResult[]
  recommended: HFModelSearchResult[]
  error?: string
}

/**
 * Response from /api/huggingface/models/[modelId] endpoint
 */
export interface HFModelInfoResponse {
  model: HFModelInfo
  error?: string
}

/**
 * Query parameters for model search
 */
export interface HFModelSearchParams {
  query?: string
  pipelineTag?: 'text-generation' | 'feature-extraction' | 'text-classification'
  limit?: number
  offset?: number
}

/**
 * All supported HF inference provider IDs
 * These map to the providers available through HF's inference router
 * Order determines UI display priority - Groq and Fireworks are preferred for speed
 */
export const HF_INFERENCE_PROVIDERS = [
  'groq',           // Preferred: fastest inference
  'fireworks-ai',   // Second choice: good speed
  'together',       // Popular choice
  'nebius',
  'cerebras',
  'sambanova',
  'hyperbolic',
  'novita',
  'nscale',
  'scaleway',
  'ovhcloud',
  'wavespeed',
  'cohere',
  'fal-ai',
  'featherless-ai',
  'hf-inference',
  'openai',
  'publicai',
  'replicate',
  'zai-org',
] as const

export type HFInferenceProviderId = typeof HF_INFERENCE_PROVIDERS[number]

/**
 * Provider display names for UI
 */
export const HF_PROVIDER_DISPLAY_NAMES: Record<HFInferenceProviderId, string> = {
  'cerebras': 'Cerebras',
  'cohere': 'Cohere',
  'fal-ai': 'Fal AI',
  'featherless-ai': 'Featherless AI',
  'fireworks-ai': 'Fireworks AI',
  'groq': 'Groq',
  'hf-inference': 'HF Inference',
  'hyperbolic': 'Hyperbolic',
  'nebius': 'Nebius',
  'novita': 'Novita',
  'nscale': 'Nscale',
  'openai': 'OpenAI',
  'ovhcloud': 'OVHcloud',
  'publicai': 'Public AI',
  'replicate': 'Replicate',
  'sambanova': 'SambaNova',
  'scaleway': 'Scaleway',
  'together': 'Together AI',
  'wavespeed': 'Wavespeed',
  'zai-org': 'Zai',
}

/**
 * Format parameter count to human-readable string
 */
export function formatParameterCount(count: number | null | undefined): string | undefined {
  if (!count) return undefined

  if (count >= 1e12) {
    return `${(count / 1e12).toFixed(1)}T`
  }
  if (count >= 1e9) {
    return `${(count / 1e9).toFixed(0)}B`
  }
  if (count >= 1e6) {
    return `${(count / 1e6).toFixed(0)}M`
  }
  return `${count}`
}

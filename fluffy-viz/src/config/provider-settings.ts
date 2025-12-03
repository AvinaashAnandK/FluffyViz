/**
 * Provider configuration loader and types
 * Loads provider API keys and settings from filesystem-based config
 */

export type ProviderKey =
  | 'openai'
  | 'anthropic'
  | 'cohere'
  | 'groq'
  | 'together'
  | 'novita'
  | 'huggingface'
  | 'google'
  | 'mistral'
  | 'local'

export interface ProviderCapabilities {
  text: boolean
  embedding: boolean
  mmEmbedding: boolean
}

export interface ProviderConfig {
  apiKey: string
  enabled: boolean
  capabilities: ProviderCapabilities
  baseUrl?: string
  batchSize?: number // Number of rows to process per batch (default: 5)
}

export interface ProviderDefaults {
  augmentation?: ProviderKey
  embedding?: ProviderKey
}

export interface ProviderSettings {
  version: string
  providers: Partial<Record<ProviderKey, ProviderConfig>>
  defaults?: ProviderDefaults
}

export interface ProviderMeta {
  label: string
  freeTier: boolean
  needsApiKey: boolean
  supports: ProviderCapabilities
}

/**
 * Metadata about each provider's capabilities and requirements
 */
export const PROVIDER_META: Record<ProviderKey, ProviderMeta> = {
  huggingface: {
    label: 'HuggingFace',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: true, mmEmbedding: true },
  },
  google: {
    label: 'Google AI',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: true, mmEmbedding: true },
  },
  cohere: {
    label: 'Cohere',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: true, mmEmbedding: false },
  },
  mistral: {
    label: 'Mistral',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: true, mmEmbedding: false },
  },
  anthropic: {
    label: 'Anthropic',
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
  openai: {
    label: 'OpenAI',
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, embedding: true, mmEmbedding: false },
  },
  groq: {
    label: 'Groq',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
  together: {
    label: 'Together AI',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
  novita: {
    label: 'Novita AI',
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
  local: {
    label: 'Local LLM',
    freeTier: true,
    needsApiKey: false,
    supports: { text: true, embedding: false, mmEmbedding: false },
  },
}

/**
 * Default capabilities configuration
 */
export const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  text: false,
  embedding: false,
  mmEmbedding: false,
}

/**
 * Validation error class
 */
export class ProviderConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderConfigError'
  }
}

/**
 * Validate provider configuration structure
 */
export function validateProviderConfig(config: unknown): ProviderSettings {
  if (!config || typeof config !== 'object') {
    throw new ProviderConfigError('Config must be an object')
  }

  const cfg = config as any

  if (!cfg.version || typeof cfg.version !== 'string') {
    throw new ProviderConfigError('Config must have a version string')
  }

  if (!cfg.providers || typeof cfg.providers !== 'object') {
    throw new ProviderConfigError('Config must have a providers object')
  }

  const providers = cfg.providers as Record<string, unknown>

  // Validate each provider configuration
  for (const [key, value] of Object.entries(providers)) {
    if (!isValidProviderKey(key)) {
      throw new ProviderConfigError(`Unknown provider: ${key}`)
    }

    if (!value || typeof value !== 'object') {
      throw new ProviderConfigError(`Provider ${key} config must be an object`)
    }

    const providerConfig = value as Record<string, unknown>

    if (typeof providerConfig.enabled !== 'boolean') {
      throw new ProviderConfigError(`Provider ${key} must have enabled boolean`)
    }

    const meta = PROVIDER_META[key as ProviderKey]
    if (meta.needsApiKey && typeof providerConfig.apiKey !== 'string') {
      throw new ProviderConfigError(`Provider ${key} requires apiKey string`)
    }

    if (!providerConfig.capabilities || typeof providerConfig.capabilities !== 'object') {
      throw new ProviderConfigError(`Provider ${key} must have capabilities object`)
    }

    const capabilities = providerConfig.capabilities as Record<string, unknown>
    for (const cap of ['text', 'embedding', 'mmEmbedding']) {
      if (typeof capabilities[cap] !== 'boolean') {
        throw new ProviderConfigError(
          `Provider ${key} capability ${cap} must be boolean`
        )
      }
    }
  }

  return cfg as ProviderSettings
}

/**
 * Type guard for provider keys
 */
export function isValidProviderKey(key: string): key is ProviderKey {
  return key in PROVIDER_META
}

/**
 * Load provider configuration from API (client-side)
 */
export async function loadProviderSettings(): Promise<ProviderSettings> {
  try {
    const response = await fetch('/api/provider-config')

    if (!response.ok) {
      if (response.status === 404) {
        // Config file doesn't exist yet, return empty config
        return createEmptyConfig()
      }
      throw new ProviderConfigError(
        `Failed to load config: ${response.statusText}`
      )
    }

    const config = await response.json()
    return validateProviderConfig(config)
  } catch (error) {
    if (error instanceof ProviderConfigError) {
      throw error
    }
    throw new ProviderConfigError(
      `Failed to load provider config: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Save provider configuration via API
 */
export async function saveProviderSettings(
  config: ProviderSettings
): Promise<void> {
  try {
    // Validate before saving
    validateProviderConfig(config)

    const response = await fetch('/api/provider-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (!response.ok) {
      throw new ProviderConfigError(
        `Failed to save config: ${response.statusText}`
      )
    }
  } catch (error) {
    if (error instanceof ProviderConfigError) {
      throw error
    }
    throw new ProviderConfigError(
      `Failed to save provider config: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Create an empty configuration
 */
export function createEmptyConfig(): ProviderSettings {
  return {
    version: '1.0.0',
    providers: {},
    defaults: {},
  }
}

/**
 * Get API key for a specific provider
 */
export function getProviderApiKey(
  config: ProviderSettings,
  providerId: ProviderKey
): string | null {
  const provider = config.providers[providerId]
  return provider?.apiKey ?? null
}

/**
 * Check if a provider is enabled and configured
 */
export function isProviderEnabled(
  config: ProviderSettings,
  providerId: ProviderKey
): boolean {
  const provider = config.providers[providerId]
  if (!provider || !provider.enabled) {
    return false
  }

  const meta = PROVIDER_META[providerId]
  if (meta.needsApiKey && !provider.apiKey) {
    return false
  }

  return true
}

/**
 * Get all enabled providers
 */
export function getEnabledProviders(
  config: ProviderSettings
): ProviderKey[] {
  return Object.keys(config.providers).filter((key) =>
    isProviderEnabled(config, key as ProviderKey)
  ) as ProviderKey[]
}

/**
 * Check if provider has a capability enabled
 */
export function hasCapability(
  config: ProviderSettings,
  providerId: ProviderKey,
  capability: keyof ProviderCapabilities
): boolean {
  if (!isProviderEnabled(config, providerId)) {
    return false
  }

  const provider = config.providers[providerId]
  return provider?.capabilities[capability] ?? false
}

/**
 * Get default provider for a use case
 */
export function getDefaultProvider(
  config: ProviderSettings,
  useCase: 'augmentation' | 'embedding'
): ProviderKey | null {
  const defaultProvider = config.defaults?.[useCase]
  if (defaultProvider && isProviderEnabled(config, defaultProvider)) {
    return defaultProvider
  }

  // Fallback to first enabled provider with appropriate capability
  const capability = useCase === 'augmentation' ? 'text' : 'embedding'
  const enabledProviders = getEnabledProviders(config)

  for (const provider of enabledProviders) {
    if (hasCapability(config, provider, capability)) {
      return provider
    }
  }

  return null
}

/**
 * Update a single provider configuration
 */
export function updateProviderConfig(
  config: ProviderSettings,
  providerId: ProviderKey,
  updates: Partial<ProviderConfig>
): ProviderSettings {
  return {
    ...config,
    providers: {
      ...config.providers,
      [providerId]: {
        ...(config.providers[providerId] ?? {
          apiKey: '',
          enabled: false,
          capabilities: { ...DEFAULT_CAPABILITIES },
        }),
        ...updates,
      },
    },
  }
}

/**
 * Mask API key for display (show only last 4 characters)
 */
export function maskApiKey(key: string): string {
  if (!key) return ''
  if (key.length <= 4) return key
  return '•'.repeat(key.length - 4) + key.slice(-4)
}

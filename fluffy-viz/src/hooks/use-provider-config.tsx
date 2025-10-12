'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  type ProviderSettings,
  type ProviderKey,
  type ProviderConfig,
  type ProviderCapabilities,
  loadProviderSettings,
  saveProviderSettings,
  ProviderConfigError,
  isProviderEnabled,
  getProviderApiKey,
  hasCapability,
  getEnabledProviders,
  getDefaultProvider,
  updateProviderConfig,
  createEmptyConfig,
  PROVIDER_META,
} from '@/config/provider-settings'

interface UseProviderConfigReturn {
  // State
  config: ProviderSettings | null
  loading: boolean
  error: Error | null

  // Provider queries
  isProviderEnabled: (providerId: ProviderKey) => boolean
  getProviderApiKey: (providerId: ProviderKey) => string | null
  hasCapability: (
    providerId: ProviderKey,
    capability: keyof ProviderCapabilities
  ) => boolean
  getEnabledProviders: () => ProviderKey[]
  getDefaultProvider: (useCase: 'augmentation' | 'embedding') => ProviderKey | null

  // Provider mutations
  updateProvider: (
    providerId: ProviderKey,
    updates: Partial<ProviderConfig>
  ) => Promise<void>
  setProviderApiKey: (providerId: ProviderKey, apiKey: string) => Promise<void>
  setProviderEnabled: (providerId: ProviderKey, enabled: boolean) => Promise<void>
  toggleCapability: (
    providerId: ProviderKey,
    capability: keyof ProviderCapabilities
  ) => Promise<void>

  // Global operations
  reload: () => Promise<void>
  reset: () => Promise<void>
}

const ProviderConfigContext = createContext<UseProviderConfigReturn | null>(null)

function useProviderConfigInternal(): UseProviderConfigReturn {
  const [config, setConfig] = useState<ProviderSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const loadedConfig = await loadProviderSettings()
      setConfig(loadedConfig)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to load config')
      setError(error)
      console.error('Error loading provider config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (newConfig: ProviderSettings) => {
    try {
      await saveProviderSettings(newConfig)
      setConfig(newConfig)
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to save config')
      setError(error)
      console.error('Error saving provider config:', error)
      throw error
    }
  }, [])

  const updateProvider = useCallback(
    async (providerId: ProviderKey, updates: Partial<ProviderConfig>) => {
      if (!config) {
        throw new ProviderConfigError('Config not loaded')
      }

      const updatedConfig = updateProviderConfig(config, providerId, updates)
      await save(updatedConfig)
    },
    [config, save]
  )

  const setProviderApiKey = useCallback(
    async (providerId: ProviderKey, apiKey: string) => {
      await updateProvider(providerId, { apiKey: apiKey.trim() })
    },
    [updateProvider]
  )

  const setProviderEnabled = useCallback(
    async (providerId: ProviderKey, enabled: boolean) => {
      await updateProvider(providerId, { enabled })
    },
    [updateProvider]
  )

  const toggleCapability = useCallback(
    async (providerId: ProviderKey, capability: keyof ProviderCapabilities) => {
      if (!config) {
        throw new ProviderConfigError('Config not loaded')
      }

      const provider = config.providers[providerId]
      if (!provider) {
        throw new ProviderConfigError(`Provider ${providerId} not configured`)
      }

      await updateProvider(providerId, {
        capabilities: {
          ...provider.capabilities,
          [capability]: !provider.capabilities[capability],
        },
      })
    },
    [config, updateProvider]
  )

  const reset = useCallback(async () => {
    try {
      const response = await fetch('/api/provider-config', {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to reset configuration')
      }

      setConfig(createEmptyConfig())
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reset config')
      setError(error)
      console.error('Error resetting provider config:', error)
      throw error
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const isEnabled = useCallback(
    (providerId: ProviderKey): boolean => {
      return config ? isProviderEnabled(config, providerId) : false
    },
    [config]
  )

  const getKey = useCallback(
    (providerId: ProviderKey): string | null => {
      return config ? getProviderApiKey(config, providerId) : null
    },
    [config]
  )

  const hasCap = useCallback(
    (providerId: ProviderKey, capability: keyof ProviderCapabilities): boolean => {
      return config ? hasCapability(config, providerId, capability) : false
    },
    [config]
  )

  const enabledProviders = useCallback((): ProviderKey[] => {
    return config ? getEnabledProviders(config) : []
  }, [config])

  const defaultProvider = useCallback(
    (useCase: 'augmentation' | 'embedding'): ProviderKey | null => {
      return config ? getDefaultProvider(config, useCase) : null
    },
    [config]
  )

  return useMemo(
    () => ({
      config,
      loading,
      error,
      isProviderEnabled: isEnabled,
      getProviderApiKey: getKey,
      hasCapability: hasCap,
      getEnabledProviders: enabledProviders,
      getDefaultProvider: defaultProvider,
      updateProvider,
      setProviderApiKey,
      setProviderEnabled,
      toggleCapability,
      reload,
      reset,
    }),
    [
      config,
      loading,
      error,
      isEnabled,
      getKey,
      hasCap,
      enabledProviders,
      defaultProvider,
      updateProvider,
      setProviderApiKey,
      setProviderEnabled,
      toggleCapability,
      reload,
      reset,
    ]
  )
}

export function ProviderConfigProvider({ children }: { children: ReactNode }) {
  const value = useProviderConfigInternal()
  return (
    <ProviderConfigContext.Provider value={value}>
      {children}
    </ProviderConfigContext.Provider>
  )
}

export function useProviderConfig(): UseProviderConfigReturn {
  const context = useContext(ProviderConfigContext)
  if (!context) {
    throw new Error('useProviderConfig must be used within a ProviderConfigProvider')
  }

  return context
}

export function useProviderMeta() {
  return PROVIDER_META
}

export function useHasConfiguredProviders(): boolean {
  const { config } = useProviderConfig()

  if (!config) return false

  return Object.keys(config.providers).some((key) =>
    isProviderEnabled(config, key as ProviderKey)
  )
}

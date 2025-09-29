"use client"

// A lightweight localStorage-backed store for AI provider configs.
// Keys are stored locally and never sent anywhere. No server interaction.

// Types
export type ProviderKey = "huggingface" | "google" | "cohere" | "mistral" | "anthropic" | "openai" | "local"

export type Capability = "columnGeneration" | "text" | "image" | "embedding" | "mmEmbedding"

export type ProviderCapabilities = {
  columnGeneration: boolean
  text: boolean
  image: boolean
  embedding: boolean
  mmEmbedding: boolean
}

export type ProviderSupport = {
  text: boolean
  image: boolean
  embedding: boolean
  mmEmbedding: boolean
}

export type ProviderConfig = {
  apiKey?: string // Not present for local provider
  enabled: ProviderCapabilities
}

export type ProvidersState = Record<ProviderKey, ProviderConfig>

export const PROVIDERS_META: Record<
  ProviderKey,
  {
    label: string
    freeTier: boolean
    supports: ProviderSupport
    needsApiKey: boolean
  }
> = {
  huggingface: {
    label: "HuggingFace",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: true, embedding: true, mmEmbedding: true },
  },
  google: {
    label: "Google AI",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: true, embedding: true, mmEmbedding: true },
  },
  cohere: {
    label: "Cohere",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: false, embedding: true, mmEmbedding: false },
  },
  mistral: {
    label: "Mistral",
    freeTier: true,
    needsApiKey: true,
    supports: { text: true, image: false, embedding: true, mmEmbedding: false },
  },
  anthropic: {
    label: "Anthropic",
    freeTier: false,
    needsApiKey: true,
    // Note: Anthropic supports multimodal understanding, but does not provide image generation.
    // Embedding availability varies by account/time; set to false by default to avoid confusion.
    supports: { text: true, image: false, embedding: false, mmEmbedding: false },
  },
  openai: {
    label: "OpenAI",
    freeTier: false,
    needsApiKey: true,
    supports: { text: true, image: true, embedding: true, mmEmbedding: false },
  },
  local: {
    label: "Local LLM",
    freeTier: false,
    needsApiKey: false,
    // Local capabilities depend on user setup; default all off except text support
    supports: { text: true, image: false, embedding: false, mmEmbedding: false },
  },
}

const STORAGE_KEY = "aiProvidersConfig:v1"

const defaultCapabilities: ProviderCapabilities = {
  columnGeneration: false,
  text: false,
  image: false,
  embedding: false,
  mmEmbedding: false,
}

function defaultState(): ProvidersState {
  return {
    huggingface: { apiKey: "", enabled: { ...defaultCapabilities } },
    google: { apiKey: "", enabled: { ...defaultCapabilities } },
    cohere: { apiKey: "", enabled: { ...defaultCapabilities } },
    mistral: { apiKey: "", enabled: { ...defaultCapabilities } },
    anthropic: { apiKey: "", enabled: { ...defaultCapabilities } },
    openai: { apiKey: "", enabled: { ...defaultCapabilities } },
    local: { enabled: { ...defaultCapabilities, text: false } },
  } as ProvidersState
}

function safeParse<T>(raw: string | null, fallback: T): T {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function maskKey(key?: string) {
  if (!key) return ""
  const visible = key.slice(-4)
  return "•".repeat(Math.max(0, key.length - 4)) + visible
}

// React hook to read/write config
import { useCallback, useEffect, useMemo, useState } from "react"

export function useProviderConfig() {
  const [state, setState] = useState<ProvidersState>(() => {
    if (typeof window === "undefined") return defaultState()
    const saved = safeParse<ProvidersState>(
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
      defaultState(),
    )
    // Ensure shape and defaults for any new fields
    const base = defaultState()
    return { ...base, ...saved }
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    }
  }, [state])

  const setApiKey = useCallback((provider: ProviderKey, apiKey: string) => {
    setState((prev) => ({ ...prev, [provider]: { ...prev[provider], apiKey } }))
  }, [])

  const clearApiKey = useCallback((provider: ProviderKey) => {
    setState((prev) => {
      const next = { ...prev }
      if (PROVIDERS_META[provider].needsApiKey) {
        next[provider] = { ...next[provider], apiKey: "" }
      }
      // Disable all toggles if no key (for key-based providers)
      next[provider] = {
        ...next[provider],
        enabled: { ...defaultCapabilities },
      }
      return next
    })
  }, [])

  const setCapability = useCallback((provider: ProviderKey, cap: Capability, value: boolean) => {
    setState((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        enabled: { ...prev[provider].enabled, [cap]: value },
      },
    }))
  }, [])

  const isConnected = useCallback(
    (provider: ProviderKey) => {
      if (!PROVIDERS_META[provider].needsApiKey) return true
      const key = state[provider]?.apiKey
      return Boolean(key && key.length > 0)
    },
    [state],
  )

  const value = useMemo(
    () => ({ state, setApiKey, clearApiKey, setCapability, isConnected }),
    [state, setApiKey, clearApiKey, setCapability, isConnected],
  )

  return value
}

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Search,
  ChevronDown,
  Check,
  Loader2,
  Sparkles,
  Globe,
  AlertCircle,
  RefreshCw,
  Server,
} from 'lucide-react'
import type {
  HFModelSearchResult,
  HFModelsResponse,
  HFModelInfo,
  HFModelInfoResponse,
  HFInferenceProvider,
} from '@/types/huggingface'

export interface HuggingFaceModelSelection {
  modelId: string
  modelName: string
  providerId: string
  providerName: string
  providerModelId: string
}

interface HuggingFaceModelSelectorProps {
  /** Current selection (if any) */
  selection?: HuggingFaceModelSelection
  /** Called when user completes selection (model + provider) */
  onSelect: (selection: HuggingFaceModelSelection) => void
  /** Pipeline tag filter: 'text-generation' for LLMs, 'feature-extraction' for embeddings */
  pipelineTag?: 'text-generation' | 'feature-extraction'
  /** Additional CSS classes */
  className?: string
}

export function HuggingFaceModelSelector({
  selection,
  onSelect,
  pipelineTag = 'text-generation',
  className = '',
}: HuggingFaceModelSelectorProps) {
  // UI state
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Data state
  const [recommended, setRecommended] = useState<HFModelSearchResult[]>([])
  const [searchResults, setSearchResults] = useState<HFModelSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Model selection state (before provider selection)
  const [selectedModel, setSelectedModel] = useState<HFModelSearchResult | null>(null)
  const [modelInfo, setModelInfo] = useState<HFModelInfo | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<HFInferenceProvider | null>(null)

  // Load initial recommended models
  useEffect(() => {
    loadModels()
  }, [pipelineTag])

  // Debounced search
  useEffect(() => {
    if (!isOpen) return

    const timer = setTimeout(() => {
      loadModels(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, isOpen, pipelineTag])

  // Load models from API
  const loadModels = useCallback(async (query?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        pipelineTag,
        limit: '20',
      })
      if (query) {
        params.set('query', query)
      }

      const response = await fetch(`/api/huggingface/models?${params}`)
      const data: HFModelsResponse = await response.json()

      if (data.error) {
        setError(data.error)
        setRecommended([])
        setSearchResults([])
      } else {
        setRecommended(data.recommended)
        setSearchResults(data.models)
      }
    } catch (err) {
      console.error('Error loading HF models:', err)
      setError('Unable to load HuggingFace models. Check your connection.')
      setRecommended([])
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }, [pipelineTag])

  // Load model providers when a model is selected
  const loadModelProviders = useCallback(async (model: HFModelSearchResult) => {
    setLoadingProviders(true)
    setModelInfo(null)
    setSelectedProvider(null)

    try {
      const encodedId = encodeURIComponent(model.id)
      const response = await fetch(`/api/huggingface/models/${encodedId}`)
      const data: HFModelInfoResponse = await response.json()

      if (data.error) {
        setError(data.error)
      } else {
        setModelInfo(data.model)

        // Auto-select preferred provider: Groq > Fireworks > first available (if only one)
        const providers = data.model.inferenceProviders
        if (providers.length > 0) {
          // Try to find Groq first (preferred for speed)
          const groqProvider = providers.find(p => p.id === 'groq')
          if (groqProvider) {
            handleProviderSelect(groqProvider, model)
            return
          }

          // Try Fireworks as second choice
          const fireworksProvider = providers.find(p => p.id === 'fireworks-ai')
          if (fireworksProvider) {
            handleProviderSelect(fireworksProvider, model)
            return
          }

          // Auto-select first provider if only one available
          if (providers.length === 1) {
            handleProviderSelect(providers[0], model)
          }
        }
      }
    } catch (err) {
      console.error('Error loading model providers:', err)
      setError('Failed to load providers for this model.')
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  // Handle model selection (first step)
  const handleModelSelect = (model: HFModelSearchResult) => {
    setSelectedModel(model)
    loadModelProviders(model)
  }

  // Handle provider selection (second step) - completes the selection
  const handleProviderSelect = (provider: HFInferenceProvider, model?: HFModelSearchResult) => {
    const finalModel = model || selectedModel
    if (!finalModel) return

    setSelectedProvider(provider)

    const selection: HuggingFaceModelSelection = {
      modelId: finalModel.id,
      modelName: finalModel.name,
      providerId: provider.id,
      providerName: provider.name,
      providerModelId: provider.providerModelId,
    }

    onSelect(selection)
    setIsOpen(false)
    setSearchQuery('')
    // Reset intermediate state
    setSelectedModel(null)
    setModelInfo(null)
    setSelectedProvider(null)
  }

  // Go back to model selection
  const handleBack = () => {
    setSelectedModel(null)
    setModelInfo(null)
    setSelectedProvider(null)
  }

  // Toggle dropdown
  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen && recommended.length === 0) {
      loadModels()
    }
    // Reset state when opening
    if (!isOpen) {
      setSelectedModel(null)
      setModelInfo(null)
      setSelectedProvider(null)
    }
  }

  // Retry loading
  const handleRetry = () => {
    setError(null)
    loadModels(searchQuery)
  }

  return (
    <div className={`relative ${className}`}>
      {/* Selected Display / Trigger */}
      <div
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 cursor-pointer hover:border-gray-400 dark:hover:border-gray-600"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          {selection ? (
            <>
              <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                {selection.modelId}
              </span>
              <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                {selection.providerName}
              </span>
            </>
          ) : (
            <span className="flex-1 text-sm text-gray-500">
              Search HuggingFace models...
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-[400px] overflow-hidden">
          {/* Show provider selection if model is selected */}
          {selectedModel && (
            <div className="flex flex-col h-full">
              {/* Header with back button */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <button
                  onClick={handleBack}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
                >
                  ← Back to models
                </button>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {selectedModel.id}
                </div>
                {selectedModel.parameterCountFormatted && (
                  <span className="text-xs text-gray-500">
                    {selectedModel.parameterCountFormatted} parameters
                  </span>
                )}
              </div>

              {/* Provider list */}
              <div className="flex-1 overflow-y-auto max-h-72">
                {loadingProviders && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading providers...</span>
                  </div>
                )}

                {!loadingProviders && modelInfo && modelInfo.inferenceProviders.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    No inference providers available for this model.
                  </div>
                )}

                {!loadingProviders && modelInfo && modelInfo.inferenceProviders.length > 0 && (
                  <>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Select Provider ({modelInfo.inferenceProviders.length} available)
                        </span>
                      </div>
                    </div>

                    {modelInfo.inferenceProviders.map((provider) => (
                      <div
                        key={provider.id}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between"
                        onClick={() => handleProviderSelect(provider)}
                      >
                        <div className="flex-1">
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {provider.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {provider.providerModelId}
                          </div>
                        </div>
                        {selectedProvider?.id === provider.id && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Show model search/list if no model selected */}
          {!selectedModel && (
            <>
              {/* Search Input */}
              <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search HuggingFace models..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Model List */}
              <div className="max-h-72 overflow-y-auto">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading models...</span>
                  </div>
                )}

                {error && (
                  <div className="p-4 text-center">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                    <div className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</div>
                    <button
                      onClick={handleRetry}
                      className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try again
                    </button>
                  </div>
                )}

                {!loading && !error && recommended.length === 0 && searchResults.length === 0 && (
                  <div className="p-4 text-center text-sm text-gray-500">
                    {searchQuery ? 'No models found matching your search' : 'No models available'}
                  </div>
                )}

                {/* Recommended Section */}
                {!loading && !error && recommended.length > 0 && (
                  <div className="border-b border-gray-50 dark:border-gray-800">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Recommended
                        </span>
                      </div>
                    </div>
                    {recommended.map((model) => (
                      <ModelRow
                        key={model.id}
                        model={model}
                        isSelected={selection?.modelId === model.id}
                        onClick={() => handleModelSelect(model)}
                      />
                    ))}
                  </div>
                )}

                {/* Search Results / All Models Section */}
                {!loading && !error && searchResults.length > 0 && (
                  <div>
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {searchQuery ? 'Search Results' : 'All Models'}
                        </span>
                      </div>
                    </div>
                    {searchResults.map((model) => (
                      <ModelRow
                        key={model.id}
                        model={model}
                        isSelected={selection?.modelId === model.id}
                        onClick={() => handleModelSelect(model)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Individual model row component
 */
function ModelRow({
  model,
  isSelected,
  onClick,
}: {
  model: HFModelSearchResult
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      className="px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-between group"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {model.id}
        </div>
        {model.description && (
          <div className="text-xs text-gray-500 truncate mt-0.5">
            {model.description}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        {model.parameterCountFormatted && (
          <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
            {model.parameterCountFormatted}
          </span>
        )}
        {model.inferenceProviderCount > 0 && (
          <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
            +{model.inferenceProviderCount}
          </span>
        )}
        {isSelected && (
          <Check className="w-4 h-4 text-blue-600" />
        )}
      </div>
    </div>
  )
}

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { ChevronDown, Check, AlertCircle } from 'lucide-react'
import { ModelProvider } from '@/types/models'
import { loadProviderSettings, getEnabledProviders, getProviderApiKey, PROVIDER_META, type ProviderKey } from '@/config/provider-settings'

interface ProviderSelectorProps {
  selectedProvider?: ModelProvider
  onProviderSelect: (provider: ModelProvider) => void
  className?: string
  /** Filter to only show these provider IDs */
  filterProviders?: string[]
}

export function ProviderSelector({
  selectedProvider,
  onProviderSelect,
  className = "",
  filterProviders
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [availableProviders, setAvailableProviders] = useState<ModelProvider[]>([])
  const [loading, setLoading] = useState(false)

  // Load available providers from config when component mounts
  useEffect(() => {
    async function loadProviders() {
      setLoading(true)
      try {
        const config = await loadProviderSettings()
        const enabledProviderKeys = getEnabledProviders(config)

        // Convert enabled providers to ModelProvider format
        const providers: ModelProvider[] = enabledProviderKeys
          .map(key => {
            const meta = PROVIDER_META[key as ProviderKey]
            const apiKey = getProviderApiKey(config, key as ProviderKey)

            return {
              id: key,
              name: key,
              displayName: meta.label,
              apiKey: apiKey || undefined,
              supportsStreaming: true, // Assume all providers support streaming
            } as ModelProvider
          })

        setAvailableProviders(providers)

        // Auto-select first provider if none selected
        if (!selectedProvider && providers.length > 0) {
          onProviderSelect(providers[0])
        }
      } catch (error) {
        console.error('Error loading providers:', error)
        setAvailableProviders([])
      } finally {
        setLoading(false)
      }
    }

    loadProviders()
  }, [])

  const handleProviderSelect = (provider: ModelProvider) => {
    onProviderSelect(provider)
    setIsOpen(false)
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  // Filter providers based on filterProviders prop
  const filteredProviders = useMemo(() => {
    if (!filterProviders || filterProviders.length === 0) {
      return availableProviders
    }
    return availableProviders.filter(provider => filterProviders.includes(provider.id))
  }, [availableProviders, filterProviders])

  return (
    <div className={`relative ${className}`}>
      {/* Selected Provider Display */}
      <div className="relative">
        <div
          className="w-full px-3 py-2 border cursor-pointer transition-colors"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E5E7EB',
            borderRadius: '6px',
            height: '36px',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={handleToggle}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#9CA3AF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#E5E7EB';
          }}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm" style={{ color: selectedProvider ? '#374151' : '#9CA3AF' }}>
              {selectedProvider ? selectedProvider.displayName : 'Select provider'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              style={{ color: '#9CA3AF' }}
            />
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 max-h-64 overflow-hidden" style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '6px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2" style={{ borderColor: '#8B5CF6' }}></div>
              <span className="ml-2 text-sm" style={{ color: '#9CA3AF' }}>Loading providers...</span>
            </div>
          )}

          {!loading && filteredProviders.length === 0 && (
            <div className="p-4 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <div className="text-sm mb-1" style={{ color: '#9CA3AF' }}>
                {filterProviders ? 'No matching providers available' : 'No providers configured'}
              </div>
              <div className="text-xs" style={{ color: '#9CA3AF' }}>
                {filterProviders
                  ? 'Configure a provider that supports this feature'
                  : 'Please configure at least one provider with text capability'}
              </div>
            </div>
          )}

          {!loading && filteredProviders.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {/* Provider Header */}
              <div className="px-3 py-2 border-b" style={{ backgroundColor: '#F8F9FA', borderColor: '#E5E7EB' }}>
                <div className="text-sm font-medium" style={{ color: '#374151' }}>
                  {filterProviders ? 'Compatible Providers' : 'Configured Providers'} ({filteredProviders.length})
                </div>
              </div>

              {/* Providers List */}
              <div className="py-1">
                {filteredProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="px-3 py-2 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => handleProviderSelect(provider)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F8F9FA';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span className="text-sm" style={{ color: '#374151' }}>
                      {provider.displayName}
                    </span>
                    {selectedProvider?.id === provider.id && (
                      <Check className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, Check, Zap, Activity, AlertCircle } from 'lucide-react'
import { ModelProvider } from '@/types/models'
import { getCompatibleProviders, formatProviderWithCount, getProviderCountForModel } from '@/lib/providers'

interface ProviderSelectorProps {
  selectedProvider?: ModelProvider
  selectedModelId?: string
  onProviderSelect: (provider: ModelProvider) => void
  className?: string
}

export function ProviderSelector({
  selectedProvider,
  selectedModelId,
  onProviderSelect,
  className = ""
}: ProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [compatibleProviders, setCompatibleProviders] = useState<ModelProvider[]>([])
  const [loading, setLoading] = useState(false)

  // Update compatible providers when model changes
  useEffect(() => {
    if (selectedModelId) {
      setLoading(true)
      const providers = getCompatibleProviders(selectedModelId)
      setCompatibleProviders(providers)

      // Auto-select first compatible provider if none selected
      if (!selectedProvider && providers.length > 0) {
        onProviderSelect(providers[0])
      }
      setLoading(false)
    }
  }, [selectedModelId, selectedProvider, onProviderSelect])

  const handleProviderSelect = (provider: ModelProvider) => {
    onProviderSelect(provider)
    setIsOpen(false)
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
  }

  const totalProviderCount = getProviderCountForModel(selectedModelId || '')

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
            {selectedProvider ? (
              <>
                <span className="text-lg">{selectedProvider.icon}</span>
                <span className="flex-1 text-sm" style={{ color: '#374151' }}>
                  {formatProviderWithCount(selectedProvider, totalProviderCount)}
                </span>
                {selectedProvider.supportsStreaming && (
                  <Zap className="w-3 h-3" style={{ color: '#F59E0B' }} title="Supports streaming" />
                )}
                <Activity className="w-3 h-3" style={{ color: '#10B981' }} title="Active" />
              </>
            ) : (
              <>
                <span className="flex-1 text-sm" style={{ color: '#9CA3AF' }}>
                  {selectedModelId ? 'Select inference provider' : 'Select model first'}
                </span>
                {!selectedModelId && (
                  <AlertCircle className="w-4 h-4" style={{ color: '#9CA3AF' }} />
                )}
              </>
            )}
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

          {!loading && !selectedModelId && (
            <div className="p-4 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <div className="text-sm mb-1" style={{ color: '#9CA3AF' }}>No model selected</div>
              <div className="text-xs" style={{ color: '#9CA3AF' }}>Please select a model first to see compatible providers</div>
            </div>
          )}

          {!loading && selectedModelId && compatibleProviders.length === 0 && (
            <div className="p-4 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: '#9CA3AF' }} />
              <div className="text-sm mb-1" style={{ color: '#9CA3AF' }}>No compatible providers</div>
              <div className="text-xs" style={{ color: '#9CA3AF' }}>This model may not be supported by available providers</div>
            </div>
          )}

          {!loading && compatibleProviders.length > 0 && (
            <div className="max-h-60 overflow-y-auto">
              {/* Provider Header */}
              <div className="px-3 py-2 border-b" style={{ backgroundColor: '#F8F9FA', borderColor: '#E5E7EB' }}>
                <div className="text-sm font-medium" style={{ color: '#374151' }}>
                  Inference Providers ({compatibleProviders.length})
                </div>
              </div>

              {/* Providers List */}
              <div className="py-1">
                {compatibleProviders.map((provider) => (
                  <div
                    key={provider.id}
                    className="px-3 py-2 cursor-pointer flex items-center justify-between group transition-colors"
                    style={{ height: '32px' }}
                    onClick={() => handleProviderSelect(provider)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#F8F9FA';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {/* Provider Icon */}
                      <span className="text-lg flex-shrink-0">{provider.icon}</span>

                      {/* Provider Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: '#374151' }}>
                            {provider.displayName}
                          </span>
                          {selectedProvider?.id === provider.id && (
                            <Check className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                          )}
                        </div>

                        {/* Provider Features */}
                        <div className="flex items-center gap-3 mt-1">
                          {provider.supportsStreaming && (
                            <div className="flex items-center gap-1">
                              <Zap className="w-3 h-3" style={{ color: '#F59E0B' }} />
                              <span className="text-xs" style={{ color: '#9CA3AF' }}>Streaming</span>
                            </div>
                          )}

                          {provider.maxContextLength && (
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>
                              {provider.maxContextLength.toLocaleString()} tokens
                            </span>
                          )}

                          {provider.pricing && (
                            <span className="text-xs" style={{ color: '#9CA3AF' }}>
                              ${provider.pricing.input}/{provider.pricing.unit}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Indicator */}
                      <div className="flex-shrink-0">
                        <Activity className="w-3 h-3" style={{ color: '#10B981' }} title="Available" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer with total count */}
              {totalProviderCount > compatibleProviders.length && (
                <div className="px-3 py-2 border-t" style={{ backgroundColor: '#F8F9FA', borderColor: '#E5E7EB' }}>
                  <div className="text-xs text-center" style={{ color: '#9CA3AF' }}>
                    +{totalProviderCount - compatibleProviders.length} more providers available
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
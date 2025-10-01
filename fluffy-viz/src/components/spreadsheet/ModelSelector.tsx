'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Search, ChevronDown, Check, Loader2, Sparkles, Globe } from 'lucide-react'
import { Model, ModelCategory } from '@/types/models'
import { searchModels } from '@/lib/models'

interface ModelSelectorProps {
  selectedModel?: Model
  onModelSelect: (model: Model) => void
  placeholder?: string
  className?: string
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  placeholder = "Search models...",
  className = ""
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<ModelCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load initial models
  useEffect(() => {
    loadModels()
  }, [])

  // Search models when query changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || isOpen) {
        loadModels(searchQuery)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, isOpen])

  const loadModels = async (query?: string) => {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const results = await searchModels({
        query,
        limit: query ? 50 : 20
      })
      setCategories(results)
    } catch (err) {
      console.error('Error loading models:', err)
      setError('Failed to load models')
      // Fallback to empty categories
      setCategories([])
    } finally {
      setLoading(false)
    }
  }

  const handleModelSelect = (model: Model) => {
    onModelSelect(model)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen && categories.length === 0) {
      loadModels()
    }
  }

  // Memoized filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchQuery) return categories

    return categories.map(category => ({
      ...category,
      models: category.models.filter(model =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    })).filter(category => category.models.length > 0)
  }, [categories, searchQuery])

  return (
    <div className={`relative ${className}`}>
      {/* Selected Model Display / Search Input */}
      <div className="relative">
        <div
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white cursor-pointer hover:border-gray-400 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500"
          onClick={handleToggle}
        >
          <div className="flex items-center gap-2">
            {selectedModel ? (
              <>
                {selectedModel.avatar && (
                  <img
                    src={selectedModel.avatar}
                    alt={selectedModel.name}
                    className="w-5 h-5 rounded"
                  />
                )}
                <span className="flex-1 text-sm text-gray-900 truncate">
                  {selectedModel.name}
                </span>
                {selectedModel.parameters && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                    {selectedModel.parameters}
                  </span>
                )}
              </>
            ) : (
              <span className="flex-1 text-sm text-gray-500">
                {placeholder}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </div>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-96 overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search models..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Model Categories */}
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">Loading models...</span>
              </div>
            )}

            {error && (
              <div className="p-4 text-center">
                <div className="text-sm text-red-600 mb-2">{error}</div>
                <button
                  onClick={() => loadModels(searchQuery)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  Try again
                </button>
              </div>
            )}

            {!loading && !error && filteredCategories.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                {searchQuery ? 'No models found matching your search' : 'No models available'}
              </div>
            )}

            {!loading && !error && filteredCategories.map((category) => (
              <div key={category.id} className="border-b border-gray-50 last:border-b-0">
                {/* Category Header */}
                <div className="px-3 py-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    {category.id === 'recommended' ? (
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Globe className="w-4 h-4 text-blue-500" />
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {category.name}
                    </span>
                  </div>
                </div>

                {/* Models List */}
                <div className="max-h-48 overflow-y-auto">
                  {category.models.map((model) => (
                    <div
                      key={model.id}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between group"
                      onClick={() => handleModelSelect(model)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {model.avatar && (
                          <img
                            src={model.avatar}
                            alt={model.name}
                            className="w-5 h-5 rounded flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-gray-900 truncate">
                            {model.name}
                          </div>
                          {model.tags && model.tags.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {model.tags.slice(0, 3).map((tag, index) => (
                                <span
                                  key={index}
                                  className="inline-block text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                              {model.tags.length > 3 && (
                                <span className="text-xs text-gray-500">+{model.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {model.parameters && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {model.parameters}
                          </span>
                        )}
                        {selectedModel?.id === model.id && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
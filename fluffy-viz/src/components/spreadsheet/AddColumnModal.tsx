'use client'

import { useState, useEffect } from 'react'
import { X, Search } from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { ProviderSelector } from './ProviderSelector'
import { Model, ModelProvider } from '@/types/models'
import { getDefaultProviderForModel } from '@/lib/providers'
import { loadPromptTemplate, interpolatePrompt } from '@/config/ai-column-templates'

interface AddColumnModalProps {
  isOpen: boolean
  onClose: () => void
  onAddColumn: (data: {
    name: string
    prompt: string
    model: Model
    provider: ModelProvider
    searchWeb?: boolean
  }) => void
  template: string | null
  availableColumns: string[]
}

// Template prompts are now loaded from ai-column-templates.ts

export function AddColumnModal({
  isOpen,
  onClose,
  onAddColumn,
  template,
  availableColumns
}: AddColumnModalProps) {
  const [columnName, setColumnName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [selectedModel, setSelectedModel] = useState<Model | undefined>(undefined)
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | undefined>(undefined)
  const [searchWeb, setSearchWeb] = useState(false)
  const [selectedColumn, setSelectedColumn] = useState(availableColumns[0] || '')

  useEffect(() => {
    if (template) {
      // Load prompt template asynchronously
      loadPromptTemplate(template).then(templatePrompt => {
        // Replace {input} placeholder with selected column reference
        const promptWithColumn = templatePrompt.replace(/{input}/g, `{{${selectedColumn}}}`)
        setPrompt(promptWithColumn)
        setColumnName(`${template}_column`)
      })
    }
  }, [template, selectedColumn])

  useEffect(() => {
    if (availableColumns.length > 0) {
      setSelectedColumn(availableColumns[0])
    }
  }, [availableColumns])

  // Handler for model selection
  const handleModelSelect = (model: Model) => {
    setSelectedModel(model)

    // Auto-select compatible provider when model changes
    const defaultProvider = getDefaultProviderForModel(model.id)
    if (defaultProvider) {
      setSelectedProvider(defaultProvider)
    } else {
      setSelectedProvider(undefined)
    }
  }

  // Handler for provider selection
  const handleProviderSelect = (provider: ModelProvider) => {
    setSelectedProvider(provider)
  }


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!columnName.trim() || !prompt.trim() || !selectedModel || !selectedProvider) return

    onAddColumn({
      name: columnName.trim(),
      prompt: prompt.trim(),
      model: selectedModel,
      provider: selectedProvider,
      searchWeb
    })

    // Reset form
    setColumnName('')
    setPrompt('')
    setSelectedModel(undefined)
    setSelectedProvider(undefined)
    setSearchWeb(false)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4">
      <div className="bg-white w-96 max-h-[90vh] rounded-lg shadow-xl overflow-y-auto mt-16 mr-4 ml-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Instructions to generate cells</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Column Name */}
          <div>
            <label htmlFor="columnName" className="block text-sm font-medium text-gray-700 mb-2">
              Column Name
            </label>
            <input
              type="text"
              id="columnName"
              value={columnName}
              onChange={(e) => setColumnName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter column name..."
              required
            />
          </div>

          {/* Prompt */}
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 mb-2">
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
              placeholder="Enter your prompt here..."
              required
            />
          </div>

          {/* Variable Selection */}
          <div>
            <label htmlFor="columnSelect" className="block text-sm font-medium text-gray-700 mb-2">
              Reference Column
            </label>
            <select
              id="columnSelect"
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>

          {/* Search Web Toggle */}
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => setSearchWeb(!searchWeb)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md border transition-colors ${
                searchWeb
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search the web</span>
            </button>
          </div>

          {/* Model Selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <ModelSelector
                selectedModel={selectedModel}
                onModelSelect={handleModelSelect}
                placeholder="Search and select a model..."
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Inference Provider
              </label>
              <ProviderSelector
                selectedProvider={selectedProvider}
                selectedModelId={selectedModel?.id}
                onProviderSelect={handleProviderSelect}
                className="w-full"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col space-y-2 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={!selectedModel || !selectedProvider}
              className="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              Add Column
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
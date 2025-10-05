'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { ProviderSelector } from './ProviderSelector'
import { Model, ModelProvider } from '@/types/models'
import { getDefaultProviderForModel } from '@/lib/providers'
import { loadPromptTemplate } from '@/config/ai-column-templates'

interface AddColumnModalProps {
  isOpen: boolean
  onClose: () => void
  onAddColumn: (data: {
    name: string
    prompt: string
    model: Model
    provider: ModelProvider
  }) => void
  template: string | null
  availableColumns: string[]
}

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
  const [selectedColumn, setSelectedColumn] = useState(availableColumns[0] || '')

  useEffect(() => {
    if (template) {
      loadPromptTemplate(template).then(templatePrompt => {
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

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model)
    const defaultProvider = getDefaultProviderForModel(model.id)
    if (defaultProvider) {
      setSelectedProvider(defaultProvider)
    } else {
      setSelectedProvider(undefined)
    }
  }

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
      provider: selectedProvider
    })

    // Reset form
    setColumnName('')
    setPrompt('')
    setSelectedModel(undefined)
    setSelectedProvider(undefined)
  }

  return (
    <div
      className={`absolute top-0 right-0 h-full w-[440px] bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Instructions to generate cells
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Column Name */}
            <div>
              <label htmlFor="columnName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Column Name
              </label>
              <input
                type="text"
                id="columnName"
                value={columnName}
                onChange={(e) => setColumnName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Enter column name..."
                required
              />
            </div>

            {/* Prompt */}
            <div>
              <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prompt
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[150px] resize-y bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                placeholder="Enter your prompt here..."
                required
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
          </form>
        </div>

        {/* Footer with buttons */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={!selectedModel || !selectedProvider || !columnName.trim() || !prompt.trim()}
            className="w-full px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Add Column
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
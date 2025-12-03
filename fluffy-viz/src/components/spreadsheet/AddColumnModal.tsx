'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { ModelSelector } from './ModelSelector'
import { ProviderSelector } from './ProviderSelector'
import { PromptComposer } from './PromptComposer'
import { SchemaBuilder } from './SchemaBuilder'
import { ConversationalHistoryConfig, ConversationalHistoryConfigData } from './ConversationalHistoryConfig'
import { Model, ModelProvider } from '@/types/models'
import { getDefaultProviderForModel } from '@/lib/providers'
import { loadPromptConfig, PromptConfig } from '@/config/ai-column-templates'
import { ColumnMeta } from '@/lib/prompt-serializer'
import { loadProviderSettings, getEnabledProviders, type ProviderSettings } from '@/config/provider-settings'
import type { FieldSchema, OutputSchema, ColumnExpansionMode } from '@/types/structured-output'
import { schemaToPromptFormat, isValidOutputSchema } from '@/lib/schema-utils'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'

interface ColumnInfo {
  id: string
  name: string
}

interface AddColumnModalProps {
  isOpen: boolean
  onClose: () => void
  onAddColumn: (data: {
    name: string
    prompt: string
    model: Model
    provider: ModelProvider
    outputSchema?: OutputSchema
  }) => void
  template: string | null
  availableColumns: ColumnInfo[]
  dataRows: any[]
  existingColumnNames?: string[]
}

export function AddColumnModal({
  isOpen,
  onClose,
  onAddColumn,
  template,
  availableColumns,
  dataRows,
  existingColumnNames = []
}: AddColumnModalProps) {
  const [columnName, setColumnName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [promptValid, setPromptValid] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | undefined>(undefined)
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | undefined>(undefined)
  const [templateConfig, setTemplateConfig] = useState<PromptConfig | null>(null)
  const [providerConfig, setProviderConfig] = useState<ProviderSettings | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [convHistoryConfig, setConvHistoryConfig] = useState<ConversationalHistoryConfigData | null>(null)

  // Structured output state
  const [outputMode, setOutputMode] = useState<'text' | 'structured'>('text')
  const [schemaFields, setSchemaFields] = useState<FieldSchema[]>([])
  const [expansionMode, setExpansionMode] = useState<'single' | 'expanded' | 'both'>('expanded')

  // Validate output schema
  const outputSchema: OutputSchema = {
    mode: outputMode,
    fields: schemaFields,
    expansionMode: outputMode === 'structured' ? expansionMode : undefined
  }
  const isSchemaValid = outputMode === 'text' || isValidOutputSchema(outputSchema)

  // Check if current template is conversational history
  const isConversationalHistory = template === 'conversational_history'

  // Check for duplicate column name
  const isDuplicateName = columnName.trim() !== '' &&
    existingColumnNames.some(name => name.toLowerCase() === columnName.trim().toLowerCase())

  // Load provider configuration on mount
  useEffect(() => {
    loadProviderSettings()
      .then(setProviderConfig)
      .catch(error => {
        console.error('Failed to load provider config:', error)
        setProviderConfig(null)
      })
      .finally(() => setLoadingConfig(false))
  }, [])

  // Check if any providers are enabled
  const enabledProviders = providerConfig ? getEnabledProviders(providerConfig) : []
  const hasEnabledProviders = enabledProviders.length > 0

  // Convert available columns to ColumnMeta format
  const columnsMeta: ColumnMeta[] = useMemo(() => {
    const firstRow = dataRows[0] ?? {}

    const toTitleCase = (value: string) =>
      value
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())

    return availableColumns.map((column) => {
      // Use column.id to look up data, but column.name for display
      const exampleValue = firstRow?.[column.id]

      return {
        id: column.id,
        slug: column.id,
        displayName: column.name,
        label: toTitleCase(column.name),
        preview: exampleValue == null ? '' : String(exampleValue),
      }
    })
  }, [availableColumns, dataRows])

  useEffect(() => {
    if (template) {
      // Conversational history doesn't use a prompt template - it's client-side only
      if (template === 'conversational_history') {
        setTemplateConfig(null)
        setColumnName(`${template}_column`)
        setOutputMode('text')
        setSchemaFields([])
      } else {
        loadPromptConfig(template).then(config => {
          setTemplateConfig(config)
          setColumnName(`${template}_column`)

          // Pre-populate output schema from template
          if (config.output_schema?.mode === 'structured' && config.output_schema.fields?.length > 0) {
            setOutputMode('structured')
            setSchemaFields(config.output_schema.fields.map(field => ({
              id: field.id,
              name: field.name,
              type: field.type as FieldSchema['type'],
              description: field.description,
              required: field.required,
              enumOptions: field.enumOptions,
              minItems: field.minItems,
              maxItems: field.maxItems
            })))
          } else {
            setOutputMode('text')
            setSchemaFields([])
          }
        }).catch(err => {
          console.error('Error loading template config:', err)
          toast.error(`Failed to load template "${template}"`, {
            description: 'Please try again or select a different template.'
          })
        })
      }
    } else {
      setTemplateConfig(null)
      setOutputMode('text')
      setSchemaFields([])
    }
  }, [template])

  const handleProviderSelect = (provider: ModelProvider) => {
    setSelectedProvider(provider)
    // Clear model selection when provider changes
    setSelectedModel(undefined)
  }

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model)
  }

  const handlePromptChange = (newPrompt: string, isValid: boolean) => {
    setPrompt(newPrompt)
    setPromptValid(isValid)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // For conversational history, validation is different
    if (isConversationalHistory) {
      if (!columnName.trim() || !convHistoryConfig) return

      // Build a special prompt that contains the config
      const convPrompt = JSON.stringify(convHistoryConfig)

      onAddColumn({
        name: columnName.trim(),
        prompt: convPrompt, // Store config as JSON in prompt
        model: selectedModel || { id: 'none', name: 'N/A', provider: 'none' } as Model,
        provider: selectedProvider || { id: 'none', name: 'none', displayName: 'N/A', models: [] } as ModelProvider
      })
    } else {
      // Regular column validation
      if (!columnName.trim() || !prompt.trim() || !promptValid || !selectedModel || !selectedProvider || !isSchemaValid) return

      onAddColumn({
        name: columnName.trim(),
        prompt: prompt.trim(),
        model: selectedModel,
        provider: selectedProvider,
        outputSchema: outputMode === 'structured' ? outputSchema : undefined
      })
    }

    // Reset form
    setColumnName('')
    setPrompt('')
    setPromptValid(false)
    setSelectedModel(undefined)
    setSelectedProvider(undefined)
    setConvHistoryConfig(null)
    setOutputMode('text')
    setSchemaFields([])
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

        {/* Loading State */}
        {loadingConfig && (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Loading configuration...</p>
          </div>
        )}

        {/* Empty State - No Providers Configured */}
        {!loadingConfig && !hasEnabledProviders && (
          <div className="flex flex-col items-center justify-center p-8 text-center flex-1">
            <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
              No LLM Provider Configured
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
              To use AI-powered columns, you need to configure at least one LLM provider
              with an API key in your environment variables (.env.local file).
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-3 max-w-md">
              Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or other provider keys.
            </p>
          </div>
        )}

        {/* Scrollable content */}
        {!loadingConfig && hasEnabledProviders && (
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
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 ${
                  isDuplicateName
                    ? 'border-red-500 dark:border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-700 focus:ring-blue-500'
                }`}
                placeholder="Enter column name..."
                required
              />
              {isDuplicateName && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  A column with this name already exists. Please choose a different name.
                </p>
              )}
            </div>

            {/* Conditional content based on template type */}
            {isConversationalHistory ? (
              /* Conversational History Configuration */
              <ConversationalHistoryConfig
                availableColumns={availableColumns}
                dataRows={dataRows}
                onConfigChange={setConvHistoryConfig}
              />
            ) : (
              <>
                {/* Prompt Composer */}
                <PromptComposer
                  availableColumns={columnsMeta}
                  initialTemplate={templateConfig ?? undefined}
                  onPromptChange={handlePromptChange}
                />

                {/* Output Format Toggle */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Output Format
                  </Label>
                  <RadioGroup
                    value={outputMode}
                    onValueChange={(value: 'text' | 'structured') => setOutputMode(value)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="text" id="output-text" />
                      <Label htmlFor="output-text" className="text-sm cursor-pointer">
                        Text
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="structured" id="output-structured" />
                      <Label htmlFor="output-structured" className="text-sm cursor-pointer">
                        Structured Data
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Schema Builder (shown when structured mode selected) */}
                {outputMode === 'structured' && (
                  <div className="space-y-3">
                    <SchemaBuilder
                      fields={schemaFields}
                      onChange={setSchemaFields}
                      expansionMode={expansionMode}
                      onExpansionModeChange={setExpansionMode}
                      baseColumnName={columnName}
                    />

                    {/* Schema Preview */}
                    {schemaFields.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-500 dark:text-gray-400">
                          Expected Output Format
                        </Label>
                        <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono overflow-x-auto">
                          {schemaToPromptFormat(schemaFields)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Provider and Model Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Provider ({enabledProviders.length} available)
                    </label>
                    <ProviderSelector
                      selectedProvider={selectedProvider}
                      onProviderSelect={handleProviderSelect}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Model {selectedProvider ? `(filtered by ${selectedProvider.displayName})` : ''}
                    </label>
                    <ModelSelector
                      selectedModel={selectedModel}
                      onModelSelect={handleModelSelect}
                      placeholder="Search and select a model..."
                      className="w-full"
                      filterByProvider={selectedProvider?.id}
                    />
                  </div>
                </div>
              </>
            )}
          </form>
          </div>
        )}

        {/* Footer with buttons */}
        {!loadingConfig && hasEnabledProviders && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={
              isDuplicateName ||
              (isConversationalHistory
                ? !columnName.trim() || !convHistoryConfig
                : !selectedModel || !selectedProvider || !columnName.trim() || !prompt.trim() || !promptValid || !isSchemaValid)
            }
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
        )}
      </div>
    </div>
  )
}

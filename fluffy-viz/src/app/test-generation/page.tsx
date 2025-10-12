'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { loadProviderSettings, getEnabledProviders, hasCapability, getProviderApiKey, PROVIDER_META, type ProviderKey } from '@/config/provider-settings'
import { loadModelRegistry, getTextModelsForEnabledProviders, getEmbeddingModelsForEnabledProviders, type ModelConfig } from '@/config/model-registry'

// Static texts for embeddings
const STATIC_TEXTS = [
  "The quick brown fox jumps over the lazy dog",
  "Artificial intelligence is transforming the world",
  "Machine learning models require large datasets",
  "Natural language processing enables computers to understand text",
  "Neural networks are inspired by the human brain",
  "Deep learning has revolutionized computer vision",
  "Large language models can generate human-like text",
  "Data science combines statistics and programming"
]

export default function TestGenerationPage() {
  // Text generation state
  const [prompt, setPrompt] = useState('Write a haiku about artificial intelligence')
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [availableProviders, setAvailableProviders] = useState<Array<{ id: string; name: string; apiKey: string }>>([])
  const [availableModels, setAvailableModels] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(500)

  // Embeddings state
  const [embeddingProvider, setEmbeddingProvider] = useState<string>('')
  const [embeddingModel, setEmbeddingModel] = useState<string>('')
  const [availableEmbeddingProviders, setAvailableEmbeddingProviders] = useState<Array<{ id: string; name: string; apiKey: string }>>([])
  const [availableEmbeddingModels, setAvailableEmbeddingModels] = useState<ModelConfig[]>([])
  const [queryText, setQueryText] = useState('AI and machine learning')
  const [embeddingLoading, setEmbeddingLoading] = useState(false)
  const [embeddingError, setEmbeddingError] = useState<string>('')
  const [similarities, setSimilarities] = useState<Array<{ text: string; similarity: number }>>([])
  const [embeddingDimension, setEmbeddingDimension] = useState<number>(0)

  // Load providers and models on mount
  useEffect(() => {
    async function loadConfiguration() {
      try {
        setLoadingConfig(true)

        // Load provider config
        const config = await loadProviderSettings()

        // Text generation providers
        const textProviderKeys = getEnabledProviders(config)
          .filter(provider => hasCapability(config, provider as ProviderKey, 'text'))

        const textProviders = textProviderKeys.map(key => {
          const meta = PROVIDER_META[key as ProviderKey]
          const apiKey = getProviderApiKey(config, key as ProviderKey)
          return {
            id: key,
            name: meta.label,
            apiKey: apiKey || ''
          }
        })

        setAvailableProviders(textProviders)

        // Auto-select first text provider
        if (textProviders.length > 0) {
          setSelectedProvider(textProviders[0].id)
        }

        // Embedding providers
        const embeddingProviderKeys = getEnabledProviders(config)
          .filter(provider => hasCapability(config, provider as ProviderKey, 'embedding'))

        const embeddingProviders = embeddingProviderKeys.map(key => {
          const meta = PROVIDER_META[key as ProviderKey]
          const apiKey = getProviderApiKey(config, key as ProviderKey)
          return {
            id: key,
            name: meta.label,
            apiKey: apiKey || ''
          }
        })

        setAvailableEmbeddingProviders(embeddingProviders)

        // Auto-select first embedding provider
        if (embeddingProviders.length > 0) {
          setEmbeddingProvider(embeddingProviders[0].id)
        }

        // Load model registry
        await loadModelRegistry()
        const textModels = getTextModelsForEnabledProviders(textProviderKeys)
        setAvailableModels(textModels)

        // Auto-select first text model
        if (textModels.length > 0) {
          setSelectedModel(textModels[0].id)
        }

        // Get embedding models from enabled providers
        const embeddingModels = getEmbeddingModelsForEnabledProviders(embeddingProviderKeys)

        // Debug: log embedding models and their providers
        console.log('[Embeddings] Enabled provider keys:', embeddingProviderKeys)
        console.log('[Embeddings] Total embedding models loaded:', embeddingModels.length)
        console.log('[Embeddings] Sample models:', embeddingModels.slice(0, 3).map(m => ({
          id: m.id,
          name: m.name,
          provider: (m as any).provider
        })))

        setAvailableEmbeddingModels(embeddingModels)

        // Auto-select first embedding model
        if (embeddingModels.length > 0) {
          setEmbeddingModel(embeddingModels[0].id)
        }

      } catch (err) {
        setError(`Failed to load configuration: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setLoadingConfig(false)
      }
    }

    loadConfiguration()
  }, [])

  // Filter models when provider changes
  const filteredModels = availableModels.filter(model => {
    const modelProvider = (model as any).provider
    return modelProvider === selectedProvider
  })

  const filteredEmbeddingModels = availableEmbeddingModels.filter(model => {
    const modelProvider = (model as any).provider
    const matches = modelProvider === embeddingProvider

    // Debug first few models
    if (availableEmbeddingModels.indexOf(model) < 3) {
      console.log('[Embeddings Filter]', {
        modelId: model.id,
        modelProvider,
        selectedProvider: embeddingProvider,
        matches
      })
    }

    return matches
  })

  // Auto-select first model when provider changes
  useEffect(() => {
    if (filteredModels.length > 0 && (!selectedModel || !filteredModels.find(m => m.id === selectedModel))) {
      setSelectedModel(filteredModels[0].id)
    }
  }, [selectedProvider, filteredModels, selectedModel])

  useEffect(() => {
    if (filteredEmbeddingModels.length > 0 && (!embeddingModel || !filteredEmbeddingModels.find(m => m.id === embeddingModel))) {
      setEmbeddingModel(filteredEmbeddingModels[0].id)
    }
  }, [embeddingProvider, filteredEmbeddingModels, embeddingModel])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!prompt.trim()) {
      setError('Please enter a prompt')
      return
    }

    if (!selectedProvider || !selectedModel) {
      setError('Please select a provider and model')
      return
    }

    setLoading(true)
    setError('')
    setResult('')

    try {
      const response = await fetch('/api/test-generation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          providerId: selectedProvider,
          modelId: selectedModel,
          temperature,
          maxTokens
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      setResult(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleEmbeddingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!queryText.trim()) {
      setEmbeddingError('Please enter a query text')
      return
    }

    if (!embeddingProvider || !embeddingModel) {
      setEmbeddingError('Please select a provider and model')
      return
    }

    setEmbeddingLoading(true)
    setEmbeddingError('')
    setSimilarities([])

    try {
      const response = await fetch('/api/test-embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: embeddingProvider,
          modelId: embeddingModel,
          texts: STATIC_TEXTS,
          queryText
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`)
      }

      setSimilarities(data.similarities)
      setEmbeddingDimension(data.embeddingDimension)
    } catch (err) {
      setEmbeddingError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setEmbeddingLoading(false)
    }
  }

  if (loadingConfig) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading configuration...</p>
          </div>
        </div>
      </div>
    )
  }

  if (availableProviders.length === 0) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertCircle className="h-5 w-5" />
              No Providers Configured
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 mb-4">
              Please configure at least one LLM provider with an API key and enable text generation capability.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Go to Configuration
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Testing Suite</h1>
        <p className="text-gray-600">Test text generation and embeddings</p>
      </div>

      <Tabs defaultValue="generation" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="generation">Text Generation</TabsTrigger>
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
        </TabsList>

        <TabsContent value="generation">
          <div className="grid gap-6">
        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Select your provider and model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Provider Selector */}
            <div>
              <Label htmlFor="provider">Provider ({availableProviders.length} available)</Label>
              <select
                id="provider"
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {availableProviders.map(provider => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Model Selector */}
            <div>
              <Label htmlFor="model">Model ({filteredModels.length} available for {PROVIDER_META[selectedProvider as ProviderKey]?.label})</Label>
              <select
                id="model"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={filteredModels.length === 0}
              >
                {filteredModels.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} {model.contextWindow ? `(${(model.contextWindow / 1000).toFixed(0)}K ctx)` : ''}
                  </option>
                ))}
              </select>
              {filteredModels.length === 0 && (
                <p className="text-sm text-red-600 mt-1">No models available for this provider</p>
              )}
            </div>

            {/* Advanced Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="temperature">Temperature: {temperature}</Label>
                <input
                  id="temperature"
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full mt-1"
                />
              </div>
              <div>
                <Label htmlFor="maxTokens">Max Tokens: {maxTokens}</Label>
                <input
                  id="maxTokens"
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prompt Card */}
        <Card>
          <CardHeader>
            <CardTitle>Prompt</CardTitle>
            <CardDescription>Enter your prompt to test generation</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  rows={4}
                  className="w-full"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !selectedProvider || !selectedModel || filteredModels.length === 0}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Result Card */}
        {result && (
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="h-5 w-5" />
                Generated Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-white border border-green-200 rounded-md p-4">
                <pre className="whitespace-pre-wrap font-sans text-gray-900">{result}</pre>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">Integration Test Info</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-700 space-y-2">
            <p><strong>✅ Step 1:</strong> Loads enabled providers from <code>provider-config.json</code></p>
            <p><strong>✅ Step 2:</strong> Filters models from <code>model-registry.yaml</code> by selected provider</p>
            <p><strong>✅ Step 3:</strong> Passes API key from config to AI SDK for generation</p>
            <p className="pt-2 border-t border-blue-200">
              <strong>Current Selection:</strong> {PROVIDER_META[selectedProvider as ProviderKey]?.label} → {filteredModels.find(m => m.id === selectedModel)?.name || 'No model'}
            </p>
          </CardContent>
        </Card>
          </div>
        </TabsContent>

        <TabsContent value="embeddings">
          <div className="grid gap-6">
            {/* Embedding Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle>Embedding Configuration</CardTitle>
                <CardDescription>Select provider and embedding model</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Provider Selector */}
                <div>
                  <Label htmlFor="embedding-provider">Provider ({availableEmbeddingProviders.length} available)</Label>
                  <select
                    id="embedding-provider"
                    value={embeddingProvider}
                    onChange={(e) => setEmbeddingProvider(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {availableEmbeddingProviders.length === 0 && (
                      <option value="">No embedding providers available</option>
                    )}
                    {availableEmbeddingProviders.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Model Selector */}
                <div>
                  <Label htmlFor="embedding-model">Model ({filteredEmbeddingModels.length} available for {embeddingProvider ? PROVIDER_META[embeddingProvider as ProviderKey]?.label : 'N/A'})</Label>
                  <select
                    id="embedding-model"
                    value={embeddingModel}
                    onChange={(e) => setEmbeddingModel(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={filteredEmbeddingModels.length === 0}
                  >
                    {filteredEmbeddingModels.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  {filteredEmbeddingModels.length === 0 && (
                    <p className="text-sm text-red-600 mt-1">No embedding models available for this provider</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Static Texts Card */}
            <Card>
              <CardHeader>
                <CardTitle>Static Texts</CardTitle>
                <CardDescription>These texts will be compared against your query</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {STATIC_TEXTS.map((text, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded-md border border-gray-200">
                      <span className="text-sm font-mono text-gray-700">{index + 1}. {text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Query Card */}
            <Card>
              <CardHeader>
                <CardTitle>Your Query</CardTitle>
                <CardDescription>Enter text to find similar static texts</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmbeddingSubmit} className="space-y-4">
                  <div>
                    <Textarea
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      placeholder="Enter your query text..."
                      rows={3}
                      className="w-full"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={embeddingLoading || !embeddingProvider || !embeddingModel || filteredEmbeddingModels.length === 0}
                    className="w-full"
                  >
                    {embeddingLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Computing Embeddings...
                      </>
                    ) : (
                      'Compute Similarity'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Error Alert */}
            {embeddingError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{embeddingError}</AlertDescription>
              </Alert>
            )}

            {/* Similarity Results Card */}
            {similarities.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="h-5 w-5" />
                    Similarity Results
                  </CardTitle>
                  <CardDescription className="text-green-700">
                    Query: &quot;{queryText}&quot; | Embedding dimension: {embeddingDimension}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {similarities.map((item, index) => (
                      <div
                        key={index}
                        className="bg-white border border-green-200 rounded-md p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-mono text-gray-900">{item.text}</p>
                          </div>
                          <div className="flex-shrink-0">
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-700">
                                {(item.similarity * 100).toFixed(1)}%
                              </div>
                              <div className="text-xs text-gray-500">similarity</div>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${item.similarity * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info Card */}
            {availableEmbeddingProviders.length === 0 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <AlertCircle className="h-5 w-5" />
                    No Embedding Providers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-orange-700 mb-4">
                    Please configure at least one provider with embedding capability enabled.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export interface Model {
  id: string
  name: string
  description?: string
  avatar?: string
  parameters?: string
  tags?: string[]
  likes?: number
  downloads?: number
  category?: 'recommended' | 'all'
  provider?: string
  contextLength?: number
  createdAt?: string
  updatedAt?: string
}

export interface ModelProvider {
  id: string
  name: string
  displayName: string
  icon?: string
  url?: string
  apiKey?: string
  models?: string[]
  maxContextLength?: number
  supportsStreaming?: boolean
  pricing?: {
    input: number
    output: number
    unit: string
  }
}

export interface ModelCategory {
  id: string
  name: string
  description?: string
  models: Model[]
}

export interface ModelSearchResponse {
  models: Model[]
  totalCount: number
  nextCursor?: string
}

export interface ModelSearchParams {
  query?: string
  category?: string
  provider?: string
  tags?: string[]
  sort?: 'popular' | 'recent' | 'name'
  limit?: number
  cursor?: string
}

export interface InferenceRequest {
  model: string
  provider: string
  prompt: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface InferenceResponse {
  id: string
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  model: string
  provider: string
  timestamp: string
}

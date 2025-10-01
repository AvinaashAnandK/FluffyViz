export type TaskType = 'text-generation' | 'image-generation' | 'embedding'

export interface TaskOption {
  id: TaskType
  name: string
  displayName: string
  description: string
  icon: string
  color: string
  isDefault?: boolean
  supportedModels?: string[]
  promptTemplate?: string
  examples?: string[]
}

export interface TaskSelection {
  type: TaskType
  option: TaskOption
}

export const TASK_OPTIONS: TaskOption[] = [
  {
    id: 'text-generation',
    name: 'text-generation',
    displayName: 'Text Generation',
    description: 'Generate, analyze, transform, or process text content',
    icon: '📝',
    color: 'blue',
    isDefault: true,
    supportedModels: ['gpt', 'claude', 'gemini', 'llama', 'mistral'],
    promptTemplate: 'Process the following text:\n\n{{input}}',
    examples: [
      'Summarize this content',
      'Translate to French',
      'Extract key insights',
      'Rewrite professionally',
      'Generate response'
    ]
  },
  {
    id: 'image-generation',
    name: 'image-generation',
    displayName: 'Image Generation',
    description: 'Create images, diagrams, or visual content from text descriptions',
    icon: '🎨',
    color: 'purple',
    supportedModels: ['dall-e', 'midjourney', 'stable-diffusion'],
    promptTemplate: 'Generate an image of: {{input}}',
    examples: [
      'Create a diagram based on data',
      'Generate visualization',
      'Create illustration',
      'Design logo concept',
      'Generate chart'
    ]
  },
  {
    id: 'embedding',
    name: 'embedding',
    displayName: 'Embeddings',
    description: 'Convert text into vector embeddings for similarity, search, and analysis',
    icon: '🔗',
    color: 'green',
    supportedModels: ['text-embedding', 'sentence-transformers', 'openai-embedding'],
    promptTemplate: 'Create embedding for: {{input}}',
    examples: [
      'Semantic similarity search',
      'Content clustering',
      'Recommendation systems',
      'Duplicate detection',
      'Text classification'
    ]
  }
]

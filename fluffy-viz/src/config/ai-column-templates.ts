import { Languages, Tags, FileText, TrendingUp, FolderOpen, Wand2, MessageSquare } from 'lucide-react'

export interface TemplateVariable {
  id: string
  display_name: string
  slug: string
  tooltip: string
  required: boolean
  default?: string
}

export interface PromptConfigOutputSchema {
  mode: 'text' | 'structured'
  fields: {
    id: string
    name: string
    type: string
    description?: string
    required: boolean
    enumOptions?: string[]
    minItems?: number
    maxItems?: number
  }[]
}

export interface PromptConfig {
  category: string
  title: string
  description: string
  prompt_params: {
    system_instruction: string
    prompt_template: string
  }
  template_variables: TemplateVariable[]
  response_format: string
  output_schema?: PromptConfigOutputSchema
  inference_config: {
    generation: {
      max_new_tokens: number
      temperature: number
    }
  }
}

export interface AIColumnTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'default' | 'single-column-custom' | 'multi-column-custom' | 'conversational-history'
  promptFile: string
  variables?: string[]
  examples?: string[]
}

export interface TemplateGroup {
  heading: string
  templates: AIColumnTemplate[]
}

export const COLUMN_TEMPLATES: Record<string, AIColumnTemplate> = {
  translate: {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text to different languages',
    icon: 'Languages',
    category: 'default',
    promptFile: '/config/prompts/translate.yaml',
    variables: ['input', 'language'],
    examples: [
      'Translate customer feedback to English',
      'Translate product descriptions to Spanish',
      'Multi-language content localization'
    ]
  },
  extract_keywords: {
    id: 'extract_keywords',
    name: 'Extract Keywords',
    description: 'Extract important keywords and phrases',
    icon: 'Tags',
    category: 'default',
    promptFile: '/config/prompts/extract-keywords.yaml',
    variables: ['input'],
    examples: [
      'Extract keywords from customer reviews',
      'Identify main topics in conversations',
      'Tag content automatically'
    ]
  },
  summarize: {
    id: 'summarize',
    name: 'Summarize',
    description: 'Create concise summaries',
    icon: 'FileText',
    category: 'default',
    promptFile: '/config/prompts/summarize.yaml',
    variables: ['input'],
    examples: [
      'Summarize long customer messages',
      'Create brief descriptions',
      'Condense detailed reports'
    ]
  },
  sentiment: {
    id: 'sentiment',
    name: 'Sentiment Analysis',
    description: 'Analyze sentiment (positive/negative/neutral)',
    icon: 'TrendingUp',
    category: 'default',
    promptFile: '/config/prompts/sentiment-analysis.yaml',
    variables: ['input'],
    examples: [
      'Analyze customer feedback sentiment',
      'Detect negative reviews',
      'Track sentiment trends'
    ]
  },
  classify: {
    id: 'classify',
    name: 'Classify',
    description: 'Classify text into categories',
    icon: 'FolderOpen',
    category: 'default',
    promptFile: '/config/prompts/classify.yaml',
    variables: ['input', 'categories'],
    examples: [
      'Categorize support tickets',
      'Classify product types',
      'Route messages to teams'
    ]
  },
  single_column_custom: {
    id: 'single_column_custom',
    name: 'Bring Your Own Prompt',
    description: 'Create a custom transformation for a single column',
    icon: 'Wand2',
    category: 'single-column-custom',
    promptFile: '/config/prompts/custom.yaml',
    variables: ['input'],
    examples: [
      'Custom data transformation',
      'Specialized analysis',
      'Domain-specific processing'
    ]
  },
  multi_column_custom: {
    id: 'multi_column_custom',
    name: 'Bring Your Own Prompt',
    description: 'Create a custom transformation using multiple columns',
    icon: 'Wand2',
    category: 'multi-column-custom',
    promptFile: '/config/prompts/custom.yaml',
    variables: ['input'],
    examples: [
      'Combine data from multiple columns',
      'Cross-reference information',
      'Complex multi-field analysis'
    ]
  },
  conversational_history: {
    id: 'conversational_history',
    name: 'Add Conversational History',
    description: 'Aggregate conversation turns into formatted history',
    icon: 'MessageSquare',
    category: 'conversational-history',
    promptFile: '/config/prompts/conversational-history.yaml',
    variables: [],
    examples: [
      'Build conversation context for each turn',
      'Create full conversation history',
      'Format multi-turn dialogues'
    ]
  }
}

/**
 * Load a prompt configuration from YAML file via API route
 */
export async function loadPromptConfig(templateId: string): Promise<PromptConfig> {
  const template = COLUMN_TEMPLATES[templateId]
  if (!template) {
    throw new Error(`Template ${templateId} not found`)
  }

  try {
    const response = await fetch(`/api/prompts/${templateId}`)
    if (!response.ok) {
      throw new Error(`Failed to load prompt config: ${response.statusText}`)
    }
    const config = await response.json()
    return config
  } catch (error) {
    console.error(`Error loading prompt config ${templateId}:`, error)
    throw error
  }
}

/**
 * Get all templates grouped by category with headings
 */
export function getTemplateGroups(): TemplateGroup[] {
  return [
    {
      heading: 'Default Augmentations',
      templates: Object.values(COLUMN_TEMPLATES).filter(t => t.category === 'default')
    },
    {
      heading: 'Conversational History',
      templates: Object.values(COLUMN_TEMPLATES).filter(t => t.category === 'conversational-history')
    },
    {
      heading: 'Single Column Custom Augmentations',
      templates: Object.values(COLUMN_TEMPLATES).filter(t => t.category === 'single-column-custom')
    }
  ]
}

/**
 * Get all templates by category
 */
export function getTemplatesByCategory(category: string): AIColumnTemplate[] {
  return Object.values(COLUMN_TEMPLATES).filter(t => t.category === category)
}

/**
 * Get template by ID
 */
export function getTemplate(templateId: string): AIColumnTemplate | undefined {
  return COLUMN_TEMPLATES[templateId]
}

/**
 * Interpolate variables in a prompt template
 */
export function interpolatePrompt(
  prompt: string,
  variables: Record<string, string>
): string {
  let result = prompt
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value)
  }
  return result
}

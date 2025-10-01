import { Languages, Tags, FileText, TrendingUp, FolderOpen, Wand2 } from 'lucide-react'

export interface AIColumnTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: 'augmentation' | 'analysis' | 'custom'
  promptFile: string
  variables?: string[]
  examples?: string[]
}

export const COLUMN_TEMPLATES: Record<string, AIColumnTemplate> = {
  translate: {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text to different languages',
    icon: 'Languages',
    category: 'augmentation',
    promptFile: '/config/prompts/translate.md',
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
    category: 'augmentation',
    promptFile: '/config/prompts/extract-keywords.md',
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
    category: 'augmentation',
    promptFile: '/config/prompts/summarize.md',
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
    category: 'analysis',
    promptFile: '/config/prompts/sentiment-analysis.md',
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
    category: 'analysis',
    promptFile: '/config/prompts/classify.md',
    variables: ['input', 'categories'],
    examples: [
      'Categorize support tickets',
      'Classify product types',
      'Route messages to teams'
    ]
  },
  custom: {
    id: 'custom',
    name: 'Custom Processing',
    description: 'Define your own processing logic',
    icon: 'Wand2',
    category: 'custom',
    promptFile: '/config/prompts/custom.md',
    variables: ['input'],
    examples: [
      'Custom data transformation',
      'Specialized analysis',
      'Domain-specific processing'
    ]
  }
}

/**
 * Load a prompt template from markdown file
 * In development, we'll use static imports
 * In production, this could load from API or bundled assets
 */
export async function loadPromptTemplate(templateId: string): Promise<string> {
  const template = COLUMN_TEMPLATES[templateId]
  if (!template) {
    throw new Error(`Template ${templateId} not found`)
  }

  try {
    // For now, return the prompt content directly
    // In a real implementation, you would read from the .md files
    const prompts: Record<string, string> = {
      translate: `Translate the following text to {language}, ensuring grammatical accuracy and natural, human-like phrasing.\n\nMaintain original meaning, context, and formatting. Adapt cultural references and review carefully.\n\nOriginal text: {input}`,
      extract_keywords: `Identify and extract the most salient keywords or key phrases representing the core topics from the provided text.\n\nReturn these as a single, comma-separated string. Prioritize relevance and conciseness, avoiding common stop words.\n\nText for keyword extraction: {input}`,
      summarize: `Condense the provided text, capturing its essential meaning and key points accurately and coherently.\n\nIf the text is already very short, return it as is. Use your own words where possible (abstractive summary).\n\nText to summarize: {input}`,
      sentiment: `Analyze the sentiment of the following text and classify it as one of: Positive, Negative, or Neutral.\n\nProvide a brief explanation (1-2 sentences) for your classification.\n\nText to analyze: {input}`,
      classify: `Classify the following text into one of these categories: {categories}\n\nProvide only the category name without additional explanation.\n\nText to classify: {input}`,
      custom: `Process the following text according to your specific requirements:\n\n{input}`
    }

    return prompts[templateId] || prompts.custom
  } catch (error) {
    console.error(`Error loading prompt template ${templateId}:`, error)
    return '{input}'
  }
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

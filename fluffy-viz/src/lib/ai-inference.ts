import { Model, ModelProvider } from '@/types/models'

export interface InferenceOptions {
  model: Model
  provider: ModelProvider
  prompt: string
  temperature?: number
  maxTokens?: number
}

export interface InferenceResult {
  content: string
  error?: string
}

/**
 * Interpolate prompt template with row data using {{column_slug}} syntax
 */
export function interpolatePromptForRow(
  template: string,
  row: Record<string, any>
): string {
  let result = template

  // Replace {{column_slug}} with actual row values
  const regex = /\{\{(\w+)\}\}/g
  result = result.replace(regex, (match, columnSlug) => {
    const value = row[columnSlug]
    if (value === null || value === undefined) {
      return '(empty)'
    }
    return String(value)
  })

  return result
}

/**
 * Simple AI inference function
 * This is a placeholder - in production, you would:
 * 1. Use actual API keys from provider configuration
 * 2. Make real API calls to the selected provider
 * 3. Handle streaming, retries, and error cases
 */
export async function generateCompletion(
  options: InferenceOptions
): Promise<InferenceResult> {
  const { model, provider, prompt, temperature = 0.7, maxTokens = 500 } = options

  try {
    // For now, return a mock response
    // In production, this would call the actual provider API
    console.log('AI Inference Request:', {
      model: model.name,
      provider: provider.displayName,
      prompt: prompt.substring(0, 100) + '...',
      temperature,
      maxTokens
    })

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Return mock response
    return {
      content: `[AI Generated: ${model.name}]`
    }
  } catch (error) {
    console.error('AI inference error:', error)
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Generate column data for multiple rows
 */
export async function generateColumnData(
  rows: any[],
  columnId: string,
  prompt: string,
  model: Model,
  provider: ModelProvider,
  referenceColumns: string[],
  onProgress?: (current: number, total: number) => void
): Promise<Map<number, InferenceResult>> {
  const results = new Map<number, InferenceResult>()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    // Interpolate prompt with row data using {{column_slug}} syntax
    const interpolatedPrompt = interpolatePromptForRow(prompt, row)

    // Generate completion
    const result = await generateCompletion({
      model,
      provider,
      prompt: interpolatedPrompt
    })

    results.set(i, result)

    // Report progress
    if (onProgress) {
      onProgress(i + 1, rows.length)
    }
  }

  return results
}

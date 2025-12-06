/**
 * Utilities for prompt formatting and display
 */

export interface ColumnReference {
  id: string
  name: string
}

/**
 * Format a prompt for display by replacing column IDs with friendly display names
 *
 * Converts: "Analyze {{conversation_text}} and {{user_id}}"
 * To: "Analyze {{Conversation Text}} and {{User ID}}"
 *
 * @param prompt - The prompt template with {{column_id}} placeholders
 * @param columns - Array of column objects with id and name properties
 * @returns The formatted prompt with human-readable column names
 */
export function formatPromptForDisplay(
  prompt: string,
  columns: ColumnReference[]
): string {
  // Build a map of column ID -> display name for fast lookup
  const idToName = new Map<string, string>(
    columns.map(col => [col.id, col.name])
  )

  // Replace {{column_id}} with {{Display Name}}
  return prompt.replace(/\{\{(\w+)\}\}/g, (match, columnId) => {
    const displayName = idToName.get(columnId)
    // If we find a matching column, use its display name; otherwise keep the original
    return displayName ? `{{${displayName}}}` : match
  })
}

/**
 * Extract all column references from a prompt template
 *
 * @param prompt - The prompt template with {{column_id}} placeholders
 * @returns Array of column IDs referenced in the prompt
 */
export function extractColumnReferences(prompt: string): string[] {
  const matches = prompt.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []
  return matches.map(m => m.replace(/\{\{|\}\}/g, '').trim())
}

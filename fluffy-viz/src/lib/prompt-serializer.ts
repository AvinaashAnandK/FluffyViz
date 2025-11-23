import { JSONContent } from '@tiptap/core'
import { VariableNodeAttributes } from './tiptap/variable-node'

export interface ColumnMeta {
  id: string
  slug: string
  displayName: string
  label?: string
  preview: string
}

export interface SerializedPromptResult {
  prompt: string
  previewPrompt: string // Human-readable version with display names
  unmappedVariables: { id: string; displayName: string }[]
  isValid: boolean
  mappedVariableCount: number
  totalVariableCount: number
}

/**
 * Serialize TipTap document to interpolated prompt string with {{column_slug}} syntax
 */
export function serializePrompt(
  doc: JSONContent,
  mappings: Record<string, ColumnMeta>
): SerializedPromptResult {
  const unmappedVariables: { id: string; displayName: string }[] = []
  let prompt = ''
  let previewPrompt = ''
  let mappedVariableCount = 0
  let totalVariableCount = 0

  function traverseNode(node: JSONContent) {
    if (node.type === 'text') {
      prompt += node.text || ''
      previewPrompt += node.text || ''
    } else if (node.type === 'variableNode') {
      const attrs = node.attrs as VariableNodeAttributes
      const mapping = mappings[attrs.id]

      totalVariableCount += 1

      if (mapping && attrs.mappedColumnId) {
        // Mapped variable - use {{column_slug}} syntax for actual prompt
        prompt += `{{${mapping.slug}}}`
        // Use display name for preview
        previewPrompt += `{{${mapping.displayName}}}`
        mappedVariableCount += 1
      } else if (attrs.defaultValue != null) {
        // Optional variable with default text
        prompt += attrs.defaultValue
        previewPrompt += attrs.defaultValue
      } else {
        // Unmapped variable - track for validation
        if (attrs.required !== false) {
          unmappedVariables.push({
            id: attrs.id,
            displayName: attrs.displayName,
          })
        }
        prompt += `{{${attrs.displayName}}}`
        previewPrompt += `{{${attrs.displayName}}}`
      }
    } else if (node.type === 'hardBreak') {
      prompt += '\n'
      previewPrompt += '\n'
    } else if (node.type === 'paragraph') {
      // Process paragraph content
      if (node.content) {
        node.content.forEach(traverseNode)
      }
      // Add newline after paragraph (except for last one)
      prompt += '\n'
      previewPrompt += '\n'
    } else if (node.type === 'doc') {
      // Process document content
      if (node.content) {
        node.content.forEach(traverseNode)
      }
    } else if (node.content) {
      // Process other nodes with content
      node.content.forEach(traverseNode)
    }
  }

  if (doc.content) {
    doc.content.forEach(traverseNode)
  }

  // Trim trailing newlines
  prompt = prompt.trim()
  previewPrompt = previewPrompt.trim()

  return {
    prompt,
    previewPrompt,
    unmappedVariables,
    isValid: unmappedVariables.length === 0,
    mappedVariableCount,
    totalVariableCount,
  }
}

/**
 * Hydrate TipTap document from template configuration
 */
export function hydrateDocumentFromTemplate(
  templateText: string,
  templateVariables: Array<{
    id: string
    display_name: string
    slug: string
    tooltip: string
    required: boolean
    default?: string
  }>
): JSONContent {
  const content: JSONContent[] = []

  if (!templateText) {
    // Empty template (BYO mode)
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [],
        },
      ],
    }
  }

  // Parse template text and replace {{variable}} with variable nodes
  const lines = templateText.split('\n')

  lines.forEach((line) => {
    const paragraphContent: JSONContent[] = []
    let lastIndex = 0

    // Find all {{variable}} patterns in the line
    const variableRegex = /\{\{(\w+)\}\}/g
    let match

    while ((match = variableRegex.exec(line)) !== null) {
      const [fullMatch, variableName] = match
      const matchIndex = match.index

      // Add text before the variable
      if (matchIndex > lastIndex) {
        paragraphContent.push({
          type: 'text',
          text: line.substring(lastIndex, matchIndex),
        })
      }

      // Find template variable definition
      const templateVar = templateVariables.find(
        v => v.slug === variableName || v.id === variableName
      )

      if (templateVar) {
        // Add variable node
        paragraphContent.push({
          type: 'variableNode',
          attrs: {
            id: templateVar.id,
            displayName: templateVar.display_name,
            tooltip: templateVar.tooltip,
            required: templateVar.required,
            defaultValue: templateVar.default ?? null,
            mappedColumnId: null,
            mappedColumnName: templateVar.default ?? null,
            mappedColumnSlug: null,
          },
        })
      } else {
        // Unknown variable - add as text
        paragraphContent.push({
          type: 'text',
          text: fullMatch,
        })
      }

      lastIndex = matchIndex + fullMatch.length
    }

    // Add remaining text after last variable
    if (lastIndex < line.length) {
      paragraphContent.push({
        type: 'text',
        text: line.substring(lastIndex),
      })
    }

    // Create paragraph node
    content.push({
      type: 'paragraph',
      content: paragraphContent.length > 0 ? paragraphContent : undefined,
    })
  })

  return {
    type: 'doc',
    content,
  }
}

/**
 * Get all variable nodes from document
 */
export function extractVariables(doc: JSONContent): VariableNodeAttributes[] {
  const variables: VariableNodeAttributes[] = []

  function traverseNode(node: JSONContent) {
    if (node.type === 'variableNode') {
      variables.push(node.attrs as VariableNodeAttributes)
    }
    if (node.content) {
      node.content.forEach(traverseNode)
    }
  }

  if (doc.content) {
    doc.content.forEach(traverseNode)
  }

  return variables
}

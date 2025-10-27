/**
 * Conversational history generation utilities
 * Aggregates conversation turns based on configuration
 */

import { ConversationalHistoryConfigData } from '@/components/spreadsheet/ConversationalHistoryConfig'

export interface ConversationTurn {
  [key: string]: any
}

/**
 * Generate conversational history for each row
 * @param data Array of all rows
 * @param config Conversation configuration
 * @returns Array of formatted conversation histories (one per row)
 */
export function generateConversationalHistory(
  data: ConversationTurn[],
  config: ConversationalHistoryConfigData
): string[] {
  const {
    conversationIdColumn,
    sequenceIdColumn,
    aggregationStrategy,
    turnPlusN,
    selectedFormatColumns
  } = config

  // Group rows by conversation ID
  const conversations = new Map<string, ConversationTurn[]>()
  data.forEach((row, rowIndex) => {
    const convId = String(row[conversationIdColumn] || '')
    if (!conversations.has(convId)) {
      conversations.set(convId, [])
    }
    conversations.get(convId)!.push({ ...row, __originalIndex: rowIndex })
  })

  // Sort each conversation by sequence
  conversations.forEach((turns) => {
    turns.sort((a, b) => {
      const aSeq = a[sequenceIdColumn]
      const bSeq = b[sequenceIdColumn]
      if (typeof aSeq === 'number' && typeof bSeq === 'number') {
        return aSeq - bSeq
      }
      return String(aSeq).localeCompare(String(bSeq))
    })
  })

  // Generate history for each row
  const results: string[] = new Array(data.length).fill('')

  conversations.forEach((turns) => {
    turns.forEach((currentTurn, turnIndex) => {
      const originalIndex = currentTurn.__originalIndex

      // Determine which turns to include based on strategy
      let relevantTurns: ConversationTurn[] = []

      switch (aggregationStrategy) {
        case 'turn_only':
          relevantTurns = [currentTurn]
          break

        case 'history_until_turn':
          relevantTurns = turns.slice(0, turnIndex + 1)
          break

        case 'turn_plus_n':
          const startIdx = Math.max(0, turnIndex - turnPlusN + 1)
          relevantTurns = turns.slice(startIdx, turnIndex + 1)
          break

        case 'full_conversation':
          relevantTurns = turns
          break
      }

      // Format the conversation history
      const formattedHistory = formatConversationHistory(
        relevantTurns,
        selectedFormatColumns,
        turnIndex
      )

      results[originalIndex] = formattedHistory
    })
  })

  return results
}

/**
 * Format conversation turns into a readable string
 */
function formatConversationHistory(
  turns: ConversationTurn[],
  formatColumns: string[],
  currentTurnIndex: number
): string {
  const lines: string[] = []

  turns.forEach((turn, idx) => {
    // Add turn header
    const isCurrent = idx === turns.length - 1 && idx === currentTurnIndex
    lines.push(`[Turn ${idx + 1}]${isCurrent ? ' ← CURRENT' : ''}`)

    // Add formatted columns
    formatColumns.forEach(col => {
      const value = turn[col]
      const displayValue = value != null ? String(value) : ''
      lines.push(`${col}: ${displayValue}`)
    })

    // Add separator between turns
    if (idx < turns.length - 1) {
      lines.push('---')
    }
  })

  return lines.join('\n')
}

/**
 * Check if a prompt string is a conversational history configuration
 */
export function isConversationalHistoryPrompt(prompt: string): boolean {
  try {
    const parsed = JSON.parse(prompt)
    return (
      typeof parsed === 'object' &&
      'conversationIdColumn' in parsed &&
      'sequenceIdColumn' in parsed &&
      'aggregationStrategy' in parsed
    )
  } catch {
    return false
  }
}

/**
 * Parse conversational history configuration from prompt string
 */
export function parseConversationalHistoryConfig(
  prompt: string
): ConversationalHistoryConfigData | null {
  try {
    const parsed = JSON.parse(prompt)
    if (isConversationalHistoryPrompt(prompt)) {
      return parsed as ConversationalHistoryConfigData
    }
    return null
  } catch {
    return null
  }
}

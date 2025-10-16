/**
 * Text composition utilities for embedding generation
 * Handles single column, multi-column, and conversational composition modes
 */

import type {
  CompositionConfig,
  SingleCompositionConfig,
  MultiCompositionConfig,
  ConversationalCompositionConfig,
} from '@/types/embedding';

export interface ComposedResult {
  composedTexts: string[];
  sourceRowIndices: number[][]; // For each composed text, which source rows it came from
  labels?: string[]; // For conversational mode: conversation IDs
}

// Helper to safely get column value from row
function getColumnValue(row: Record<string, unknown>, columnName: string): string {
  const value = row[columnName];
  if (value === null || value === undefined) return '';
  return String(value);
}

// Single column composition (1:1 mapping)
export function composeSingleColumn(
  rows: Record<string, unknown>[],
  config: SingleCompositionConfig
): ComposedResult {
  const composedTexts = rows.map(row => getColumnValue(row, config.sourceColumn));
  const sourceRowIndices = rows.map((_, idx) => [idx]);

  return { composedTexts, sourceRowIndices };
}

// Multi-column composition (1:1 mapping)
export function composeMultiColumn(
  rows: Record<string, unknown>[],
  config: MultiCompositionConfig
): ComposedResult {
  const composedTexts = rows.map(row => {
    const parts = config.columns.map(col => getColumnValue(row, col));
    return parts.join(config.separator);
  });
  const sourceRowIndices = rows.map((_, idx) => [idx]);

  return { composedTexts, sourceRowIndices };
}

// Conversational composition (many:1 mapping)
export function composeConversational(
  rows: Record<string, unknown>[],
  config: ConversationalCompositionConfig
): ComposedResult {
  // Group rows by conversation ID
  const conversations = new Map<string, number[]>();

  rows.forEach((row, idx) => {
    const conversationId = getColumnValue(row, config.conversationIdColumn);
    if (!conversationId) return; // Skip rows without conversation ID

    if (!conversations.has(conversationId)) {
      conversations.set(conversationId, []);
    }
    conversations.get(conversationId)!.push(idx);
  });

  // Sort turns within each conversation by sequence
  for (const [, indices] of conversations) {
    indices.sort((a, b) => {
      const seqA = rows[a][config.sequenceColumn];
      const seqB = rows[b][config.sequenceColumn];

      // Try to compare as numbers first, then as strings
      const numA = Number(seqA);
      const numB = Number(seqB);

      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }

      return String(seqA).localeCompare(String(seqB));
    });
  }

  const composedTexts: string[] = [];
  const sourceRowIndices: number[][] = [];
  const labels: string[] = [];

  // Compose text based on strategy
  for (const [conversationId, indices] of conversations) {
    let turnsToInclude: number[];

    switch (config.strategy) {
      case 'turn-only':
        // Create one embedding per turn
        for (const idx of indices) {
          const turnText = formatTurn(rows[idx], config.turnFormatColumns);
          composedTexts.push(turnText);
          sourceRowIndices.push([idx]);
          labels.push(conversationId);
        }
        continue; // Skip to next conversation

      case 'history-until':
        // Create one embedding per turn, including all history up to that turn
        for (let i = 0; i < indices.length; i++) {
          const turnsUpTo = indices.slice(0, i + 1);
          const text = turnsUpTo
            .map(idx => formatTurn(rows[idx], config.turnFormatColumns))
            .join('\n---\n');
          composedTexts.push(text);
          sourceRowIndices.push(turnsUpTo);
          labels.push(conversationId);
        }
        continue;

      case 'turn-plus-n':
        // Create one embedding per turn, including current + N previous turns
        const contextSize = config.contextSize || 3;
        for (let i = 0; i < indices.length; i++) {
          const startIdx = Math.max(0, i - contextSize + 1);
          const turnsInContext = indices.slice(startIdx, i + 1);
          const text = turnsInContext
            .map(idx => formatTurn(rows[idx], config.turnFormatColumns))
            .join('\n---\n');
          composedTexts.push(text);
          sourceRowIndices.push(turnsInContext);
          labels.push(conversationId);
        }
        continue;

      case 'full-conversation':
        // Create one embedding per conversation
        turnsToInclude = indices;
        break;

      default:
        turnsToInclude = indices;
    }

    // For full-conversation, create single embedding
    const text = turnsToInclude
      .map(idx => formatTurn(rows[idx], config.turnFormatColumns))
      .join('\n---\n');

    composedTexts.push(text);
    sourceRowIndices.push(turnsToInclude);
    labels.push(conversationId);
  }

  return { composedTexts, sourceRowIndices, labels };
}

// Format a single turn based on selected columns
function formatTurn(row: Record<string, unknown>, columns: string[]): string {
  const parts = columns.map(col => {
    const value = getColumnValue(row, col);
    return `${col}: ${value}`;
  });
  return parts.join('\n');
}

// Main composition function that dispatches based on mode
export function composeText(
  rows: Record<string, unknown>[],
  config: CompositionConfig
): ComposedResult {
  switch (config.mode) {
    case 'single':
      return composeSingleColumn(rows, config.config);
    case 'multi':
      return composeMultiColumn(rows, config.config);
    case 'conversational':
      return composeConversational(rows, config.config);
    default:
      throw new Error(`Unknown composition mode: ${(config as CompositionConfig).mode}`);
  }
}

// Helper to add composed text column to spreadsheet data
export function addComposedTextColumn(
  rows: Record<string, unknown>[],
  composedTexts: string[],
  sourceRowIndices: number[][],
  columnName: string
): Record<string, unknown>[] {
  // Clone rows to avoid mutating DuckDB Proxy objects
  const clonedRows = rows.map(row => ({ ...row }));

  // For each composed text, add it to the corresponding source rows
  composedTexts.forEach((text, i) => {
    const rowIndices = sourceRowIndices[i];
    rowIndices.forEach(rowIdx => {
      if (rowIdx < clonedRows.length) {
        clonedRows[rowIdx][columnName] = text;
      }
    });
  });

  return clonedRows;
}

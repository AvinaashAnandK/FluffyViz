/**
 * TypeScript type definitions for DuckDB operations
 */

import type { OutputSchema } from '@/types/structured-output'

/**
 * File metadata stored in the 'files' table
 */
export interface FileMetadata {
  id: string;
  name: string;
  format: string;
  last_modified: Date;
  size: number;
  version: number;
}

/**
 * Options for querying file data
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  where?: string;
  columns?: string[];
}

/**
 * Embedding layer metadata
 */
export interface EmbeddingLayerMetadata {
  id: string;
  file_id: string;
  name: string;
  provider: string;
  model: string;
  dimension: number;
  composition_mode: string;
  composition_config: Record<string, unknown>;
  created_at: Date;
  last_accessed_at: Date;
  is_active: boolean;
}

/**
 * Embedding point data
 */
export interface EmbeddingPointData {
  layer_id: string;
  point_id: string;
  embedding: number[];
  coordinates_2d: [number, number];
  composed_text: string;
  label?: string;
  source_row_indices: number[];
}

/**
 * Result of a count query
 * Note: DuckDB returns BigInt for COUNT(*), so we accept both
 */
export interface CountResult {
  count: number | bigint;
}

/**
 * Schema information for a column
 */
export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/**
 * Result of a batch operation
 */
export interface BatchOperationResult {
  success: boolean;
  rowsAffected: number;
  error?: string;
}

/**
 * Configuration for creating a file data table
 */
export interface FileTableConfig {
  fileId: string;
  columns: Array<{
    name: string;
    type: 'TEXT' | 'INTEGER' | 'FLOAT' | 'BOOLEAN' | 'TIMESTAMP';
  }>;
}

/**
 * Generic row data (for file_data_{id} tables)
 */
export type RowData = Record<string, unknown>;

/**
 * Column type classification
 */
export type ColumnType = 'data' | 'ai-generated' | 'computed';

/**
 * Web search configuration stored with column metadata
 */
export interface StoredWebSearchConfig {
  enabled: boolean;
  contextSize: 'low' | 'medium' | 'high';
  userLocation?: {
    type: 'approximate';
    city?: string;
    region?: string;
    country?: string;
  };
}

/**
 * Column metadata for AI-generated or computed columns
 */
export interface ColumnMetadata {
  fileId: string;
  columnId: string;
  columnName?: string;  // User-friendly column name
  columnType: ColumnType;
  model?: string;
  provider?: string;
  prompt?: string;
  createdAt?: number;
  outputSchema?: OutputSchema;  // Schema for structured output
  webSearchEnabled?: boolean;   // Whether web search was enabled for this column
  webSearchConfig?: StoredWebSearchConfig;  // Full web search configuration
  temperature?: number;         // Generation temperature
  maxTokens?: number;           // Max tokens for generation
}

/**
 * Error types for AI generation failures
 */
export type FailureType =
  | 'rate_limit'
  | 'network'
  | 'auth'
  | 'invalid_request'
  | 'server_error';

/**
 * Cell status for AI-generated cells
 */
export type CellStatus = 'pending' | 'success' | 'failed';

/**
 * Search source from web search
 */
export interface StoredSearchSource {
  url: string;
  title?: string;
  snippet?: string;
}

/**
 * Cell metadata for AI-generated cells
 */
export interface CellMetadata {
  fileId: string;
  columnId: string;
  rowIndex: number;
  status: CellStatus;
  error?: string;
  errorType?: FailureType;
  edited: boolean;
  originalValue?: string;
  lastEditTime?: number;
  sources?: StoredSearchSource[];  // Web search sources used for this cell
}

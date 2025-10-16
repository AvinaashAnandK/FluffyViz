/**
 * TypeScript type definitions for DuckDB operations
 */

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
 */
export interface CountResult {
  count: number;
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

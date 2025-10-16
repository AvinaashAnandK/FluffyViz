/**
 * DuckDB WASM integration - Main export file
 */

// Client
export { getDuckDB, getConnection, executeQuery, resetDatabase } from './client';

// Schema
export { initializeSchema, isSchemaInitialized, getSchemaVersion, dropAllTables } from './schema';

// Operations
export {
  createFileTable,
  queryFileData,
  getFileRowCount,
  updateCellValue,
  addColumn,
  batchUpdateColumn,
  deleteFileTable,
  getTableColumns,
  tableExists,
} from './operations';

// Query builders
export { QueryBuilder, InsertBuilder, UpdateBuilder, escapeIdentifier, escapeString } from './query-builder';

// Types
export type {
  FileMetadata,
  QueryOptions,
  RowData,
  ColumnInfo,
  CountResult,
  EmbeddingLayerMetadata,
  EmbeddingPointData,
  BatchOperationResult,
  FileTableConfig,
} from './types';

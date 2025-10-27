/**
 * DuckDB WASM integration - Main export file
 */

// Client
export { getDuckDB, getConnection, executeQuery, resetDatabase, persistDatabase } from './client';

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

// File storage
export {
  saveFileToDuckDB,
  getAllFiles,
  getFileMetadata,
  getFileData,
  renameFile,
  deleteFile,
  clearAllFiles,
  fileExists,
  MAX_FILE_SIZE,
  WARN_FILE_SIZE,
} from './file-storage';

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

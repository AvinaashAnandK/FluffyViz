/**
 * DuckDB WASM integration - Main export file
 */

// Client
export { getDuckDB, getConnection, executeQuery, resetDatabase, persistDatabase, completelyResetDatabase } from './client';

// Schema
export { initializeSchema, isSchemaInitialized, getSchemaVersion, dropAllTables } from './schema';

// Operations
export {
  createFileTable,
  queryFileData,
  queryFileDataWithMetadata,
  getFileRowCount,
  getAllFileRows,
  updateCellValue,
  addColumn,
  removeColumn,
  batchUpdateColumn,
  deleteFileTable,
  getTableColumns,
  tableExists,
  saveColumnMetadata,
  getColumnMetadata,
  getAllColumnMetadata,
  deleteColumnMetadata,
  updateColumnWidth,
  batchUpdateColumnWidths,
  getColumnWidths,
  saveCellMetadata,
  getCellMetadata,
  getColumnCellMetadata,
  getAllCellMetadata,
  batchSaveCellMetadata,
  deleteCellMetadata,
  deleteColumnCellMetadata,
  deleteFileMetadata,
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
  ColumnType,
  ColumnMetadata,
  FailureType,
  CellStatus,
  CellMetadata,
} from './types';

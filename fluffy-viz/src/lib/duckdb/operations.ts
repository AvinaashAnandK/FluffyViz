/**
 * Core CRUD operations for DuckDB file data management
 *
 * Handles creating, querying, updating, and deleting file data tables
 */

import { getConnection, executeQuery } from './client';
import type { QueryOptions, RowData, ColumnInfo, CountResult, ColumnMetadata, CellMetadata } from './types';

/**
 * Create a dynamic file_data table for parsed file content
 * @param fileId Unique file identifier
 * @param parsedData Array of row objects
 */
export async function createFileTable(
  fileId: string,
  parsedData: RowData[]
): Promise<void> {
  if (parsedData.length === 0) {
    throw new Error('Cannot create table from empty data');
  }

  const tableName = `file_data_${fileId}`;
  console.log(`[DuckDB Operations] Creating table ${tableName}`);

  const conn = await getConnection();

  try {
    // Collect all unique columns from all rows (handles sparse data)
    const allColumns = new Map<string, string>();

    for (const row of parsedData) {
      for (const [key, value] of Object.entries(row)) {
        const sanitizedKey = sanitizeColumnName(key);
        if (!allColumns.has(sanitizedKey)) {
          const columnType = inferColumnType(value);
          allColumns.set(sanitizedKey, columnType);
        }
      }
    }

    const columns = Array.from(allColumns.entries()).map(
      ([name, type]) => `"${name}" ${type}`
    );

    // Create table with row_index as primary key
    await conn.query(`
      CREATE TABLE "${tableName}" (
        row_index INTEGER PRIMARY KEY,
        ${columns.join(',\n        ')}
      )
    `);

    console.log(`[DuckDB Operations] Table ${tableName} created with ${columns.length} columns`);

    // Insert data in batches
    const columnNames = Array.from(allColumns.keys());
    const batchSize = 1000;
    for (let i = 0; i < parsedData.length; i += batchSize) {
      const batch = parsedData.slice(i, i + batchSize);
      await insertBatch(conn, tableName, batch, i, columnNames);

      if (i % 5000 === 0 && i > 0) {
        console.log(`[DuckDB Operations] Inserted ${i}/${parsedData.length} rows`);
      }
    }

    console.log(`[DuckDB Operations] ✓ Inserted ${parsedData.length} rows into ${tableName}`);

  } finally {
    await conn.close();
  }
}

/**
 * Insert a batch of rows into a table
 */
async function insertBatch(
  conn: Awaited<ReturnType<typeof getConnection>>,
  tableName: string,
  batch: RowData[],
  startIndex: number,
  allColumnNames: string[]
): Promise<void> {
  // Build VALUES clause - handle sparse data by checking each column
  const values: string[] = [];

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i];
    const rowIndex = startIndex + i;
    const rowValues: string[] = [rowIndex.toString()];

    // For each expected column, get value or NULL
    for (const colName of allColumnNames) {
      // Find the original key that maps to this sanitized column name
      const originalKey = Object.keys(row).find(
        k => sanitizeColumnName(k) === colName
      );

      const value = originalKey !== undefined ? row[originalKey] : null;
      rowValues.push(formatValue(value));
    }

    values.push(`(${rowValues.join(', ')})`);
  }

  // Build full column list
  const fullColumnNames = ['row_index', ...allColumnNames];

  await conn.query(`
    INSERT INTO "${tableName}" (${fullColumnNames.map(c => `"${c}"`).join(', ')})
    VALUES ${values.join(',\n')}
  `);
}

/**
 * Query file data with pagination and filtering
 */
export async function queryFileData(
  fileId: string,
  options: QueryOptions = {}
): Promise<RowData[]> {
  const {
    limit = 100,
    offset = 0,
    orderBy = 'row_index ASC',
    where,
    columns = ['*']
  } = options;

  const tableName = `file_data_${fileId}`;
  const columnList = columns.map(c => c === '*' ? '*' : `"${c}"`).join(', ');

  let query = `SELECT ${columnList} FROM "${tableName}"`;

  if (where) {
    query += ` WHERE ${where}`;
  }

  query += ` ORDER BY ${orderBy}`;
  query += ` LIMIT ${limit} OFFSET ${offset}`;

  return await executeQuery<RowData>(query);
}

/**
 * Query file data enriched with cell metadata for AI columns
 * Returns rows with metadata attached as `{columnId}__meta` properties
 */
export async function queryFileDataWithMetadata(
  fileId: string,
  options: QueryOptions = {}
): Promise<RowData[]> {
  // First get the raw data
  const rows = await queryFileData(fileId, options);

  if (rows.length === 0) return rows;

  // Get all cell metadata for this file
  const allCellMetadata = await getAllCellMetadata(fileId);

  // Build a map for fast lookups: `${columnId}:${rowIndex}` -> metadata
  const metadataMap = new Map<string, CellMetadata>();
  for (const meta of allCellMetadata) {
    const key = `${meta.columnId}:${meta.rowIndex}`;
    metadataMap.set(key, meta);
  }

  // Get AI column metadata to know which columns need metadata
  const columnMetadata = await getAllColumnMetadata(fileId);
  const aiColumns = new Set(
    columnMetadata
      .filter(col => col.columnType === 'ai-generated')
      .map(col => col.columnId)
  );

  // Enrich rows with metadata
  const enrichedRows = rows.map(row => {
    const enriched: RowData = { ...row };

    // For each AI column, attach metadata if it exists
    for (const columnId of aiColumns) {
      const rowIndex = row.row_index as number;
      const key = `${columnId}:${rowIndex}`;
      const meta = metadataMap.get(key);

      if (meta) {
        enriched[`${columnId}__meta`] = {
          status: meta.status,
          error: meta.error,
          errorType: meta.errorType,
          edited: meta.edited,
          originalValue: meta.originalValue,
          lastEditTime: meta.lastEditTime,
        };
      }
    }

    return enriched;
  });

  return enrichedRows;
}

/**
 * Get total row count for a file
 */
export async function getFileRowCount(fileId: string): Promise<number> {
  const tableName = `file_data_${fileId}`;
  const result = await executeQuery<CountResult>(`SELECT COUNT(*) as count FROM "${tableName}"`);
  const count = result[0]?.count || 0;
  // Convert BigInt to Number (DuckDB returns BigInt for COUNT(*))
  return typeof count === 'bigint' ? Number(count) : count;
}

/**
 * Update a single cell value
 */
export async function updateCellValue(
  fileId: string,
  rowIndex: number,
  columnName: string,
  value: unknown
): Promise<void> {
  const tableName = `file_data_${fileId}`;
  const sanitizedColumn = sanitizeColumnName(columnName);

  await executeQuery(
    `UPDATE "${tableName}" SET "${sanitizedColumn}" = ? WHERE row_index = ?`,
    [value, rowIndex]
  );
}

/**
 * Add a new column to a file table
 */
export async function addColumn(
  fileId: string,
  columnName: string,
  columnType: string = 'TEXT',
  defaultValue: unknown = null
): Promise<void> {
  const tableName = `file_data_${fileId}`;
  const sanitizedColumn = sanitizeColumnName(columnName);

  // DuckDB doesn't allow parameterized DEFAULT values in ALTER TABLE
  // So we add the column without DEFAULT, then UPDATE all rows
  await executeQuery(
    `ALTER TABLE "${tableName}" ADD COLUMN "${sanitizedColumn}" ${columnType}`,
    []
  );

  // If a default value is provided, update all existing rows
  if (defaultValue !== null && defaultValue !== undefined) {
    await executeQuery(
      `UPDATE "${tableName}" SET "${sanitizedColumn}" = ?`,
      [defaultValue]
    );
  }

  console.log(`[DuckDB Operations] Added column "${sanitizedColumn}" to ${tableName}`);
}

/**
 * Batch update column values
 */
export async function batchUpdateColumn(
  fileId: string,
  columnName: string,
  updates: Array<{ rowIndex: number; value: unknown }>
): Promise<void> {
  const tableName = `file_data_${fileId}`;
  const sanitizedColumn = sanitizeColumnName(columnName);

  const conn = await getConnection();

  try {
    // Create temporary table with updates
    const tempTable = `temp_updates_${Date.now()}`;

    await conn.query(`
      CREATE TEMPORARY TABLE "${tempTable}" (
        row_index INTEGER,
        value TEXT
      )
    `);

    // Insert update values
    const values = updates.map(u =>
      `(${u.rowIndex}, ${formatValue(u.value)})`
    ).join(',\n');

    await conn.query(`
      INSERT INTO "${tempTable}" VALUES ${values}
    `);

    // Perform batch update
    await conn.query(`
      UPDATE "${tableName}"
      SET "${sanitizedColumn}" = "${tempTable}".value
      FROM "${tempTable}"
      WHERE "${tableName}".row_index = "${tempTable}".row_index
    `);

    console.log(`[DuckDB Operations] Batch updated ${updates.length} rows in ${tableName}`);

  } finally {
    await conn.close();
  }
}

/**
 * Delete a file data table
 */
export async function deleteFileTable(fileId: string): Promise<void> {
  const tableName = `file_data_${fileId}`;
  await executeQuery(`DROP TABLE IF EXISTS "${tableName}"`);
  console.log(`[DuckDB Operations] Dropped table ${tableName}`);
}

/**
 * Get column information for a file table
 */
export async function getTableColumns(fileId: string): Promise<ColumnInfo[]> {
  const tableName = `file_data_${fileId}`;
  return await executeQuery<ColumnInfo>(`PRAGMA table_info("${tableName}")`);
}

/**
 * Check if a file table exists
 */
export async function tableExists(fileId: string): Promise<boolean> {
  const tableName = `file_data_${fileId}`;

  const result = await executeQuery<{ exists: boolean }>(`
    SELECT COUNT(*) > 0 as exists
    FROM information_schema.tables
    WHERE table_schema = 'main' AND table_name = ?
  `, [tableName]);

  return result[0]?.exists || false;
}

// ============================================================================
// Column Metadata Operations
// ============================================================================

/**
 * Save column metadata for an AI-generated or computed column
 */
export async function saveColumnMetadata(metadata: ColumnMetadata): Promise<void> {
  await executeQuery(
    `INSERT OR REPLACE INTO column_metadata
     (file_id, column_id, column_name, column_type, model, provider, prompt, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      metadata.fileId,
      metadata.columnId,
      metadata.columnName || null,
      metadata.columnType,
      metadata.model || null,
      metadata.provider || null,
      metadata.prompt || null,
      metadata.createdAt || Date.now()
    ]
  );

  console.log(`[DuckDB Operations] Saved metadata for column ${metadata.columnId}`);
}

/**
 * Get column metadata for a specific column
 */
export async function getColumnMetadata(
  fileId: string,
  columnId: string
): Promise<ColumnMetadata | null> {
  const result = await executeQuery<{
    file_id: string;
    column_id: string;
    column_name: string | null;
    column_type: string;
    model: string | null;
    provider: string | null;
    prompt: string | null;
    created_at: number | null;
  }>(
    `SELECT * FROM column_metadata WHERE file_id = ? AND column_id = ?`,
    [fileId, columnId]
  );

  if (result.length === 0) return null;

  const row = result[0];
  return {
    fileId: row.file_id,
    columnId: row.column_id,
    columnName: row.column_name || undefined,
    columnType: row.column_type as 'data' | 'ai-generated' | 'computed',
    model: row.model || undefined,
    provider: row.provider || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at || undefined,
  };
}

/**
 * Get all column metadata for a file
 */
export async function getAllColumnMetadata(fileId: string): Promise<ColumnMetadata[]> {
  const result = await executeQuery<{
    file_id: string;
    column_id: string;
    column_name: string | null;
    column_type: string;
    model: string | null;
    provider: string | null;
    prompt: string | null;
    created_at: number | null;
  }>(
    `SELECT * FROM column_metadata WHERE file_id = ? ORDER BY created_at`,
    [fileId]
  );

  return result.map(row => ({
    fileId: row.file_id,
    columnId: row.column_id,
    columnName: row.column_name || undefined,
    columnType: row.column_type as 'data' | 'ai-generated' | 'computed',
    model: row.model || undefined,
    provider: row.provider || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at || undefined,
  }));
}

/**
 * Delete column metadata
 */
export async function deleteColumnMetadata(
  fileId: string,
  columnId: string
): Promise<void> {
  await executeQuery(
    `DELETE FROM column_metadata WHERE file_id = ? AND column_id = ?`,
    [fileId, columnId]
  );

  console.log(`[DuckDB Operations] Deleted metadata for column ${columnId}`);
}

// ============================================================================
// Cell Metadata Operations
// ============================================================================

/**
 * Save cell metadata
 */
export async function saveCellMetadata(metadata: CellMetadata): Promise<void> {
  await executeQuery(
    `INSERT OR REPLACE INTO cell_metadata
     (file_id, column_id, row_index, status, error, error_type, edited, original_value, last_edit_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      metadata.fileId,
      metadata.columnId,
      metadata.rowIndex,
      metadata.status,
      metadata.error || null,
      metadata.errorType || null,
      metadata.edited,
      metadata.originalValue || null,
      metadata.lastEditTime || null
    ]
  );
}

/**
 * Get cell metadata for a specific cell
 */
export async function getCellMetadata(
  fileId: string,
  columnId: string,
  rowIndex: number
): Promise<CellMetadata | null> {
  const result = await executeQuery<{
    file_id: string;
    column_id: string;
    row_index: number;
    status: string;
    error: string | null;
    error_type: string | null;
    edited: boolean;
    original_value: string | null;
    last_edit_time: number | null;
  }>(
    `SELECT * FROM cell_metadata WHERE file_id = ? AND column_id = ? AND row_index = ?`,
    [fileId, columnId, rowIndex]
  );

  if (result.length === 0) return null;

  const row = result[0];
  return {
    fileId: row.file_id,
    columnId: row.column_id,
    rowIndex: row.row_index,
    status: row.status as 'pending' | 'success' | 'failed',
    error: row.error || undefined,
    errorType: row.error_type as 'rate_limit' | 'network' | 'auth' | 'invalid_request' | 'server_error' | undefined,
    edited: row.edited,
    originalValue: row.original_value || undefined,
    lastEditTime: row.last_edit_time || undefined,
  };
}

/**
 * Get all cell metadata for a column
 */
export async function getColumnCellMetadata(
  fileId: string,
  columnId: string
): Promise<CellMetadata[]> {
  const result = await executeQuery<{
    file_id: string;
    column_id: string;
    row_index: number;
    status: string;
    error: string | null;
    error_type: string | null;
    edited: boolean;
    original_value: string | null;
    last_edit_time: number | null;
  }>(
    `SELECT * FROM cell_metadata WHERE file_id = ? AND column_id = ? ORDER BY row_index`,
    [fileId, columnId]
  );

  return result.map(row => ({
    fileId: row.file_id,
    columnId: row.column_id,
    rowIndex: row.row_index,
    status: row.status as 'pending' | 'success' | 'failed',
    error: row.error || undefined,
    errorType: row.error_type as 'rate_limit' | 'network' | 'auth' | 'invalid_request' | 'server_error' | undefined,
    edited: row.edited,
    originalValue: row.original_value || undefined,
    lastEditTime: row.last_edit_time || undefined,
  }));
}

/**
 * Get all cell metadata for a file
 */
export async function getAllCellMetadata(fileId: string): Promise<CellMetadata[]> {
  const result = await executeQuery<{
    file_id: string;
    column_id: string;
    row_index: number;
    status: string;
    error: string | null;
    error_type: string | null;
    edited: boolean;
    original_value: string | null;
    last_edit_time: number | null;
  }>(
    `SELECT * FROM cell_metadata WHERE file_id = ? ORDER BY column_id, row_index`,
    [fileId]
  );

  return result.map(row => ({
    fileId: row.file_id,
    columnId: row.column_id,
    rowIndex: row.row_index,
    status: row.status as 'pending' | 'success' | 'failed',
    error: row.error || undefined,
    errorType: row.error_type as 'rate_limit' | 'network' | 'auth' | 'invalid_request' | 'server_error' | undefined,
    edited: row.edited,
    originalValue: row.original_value || undefined,
    lastEditTime: row.last_edit_time || undefined,
  }));
}

/**
 * Batch save cell metadata
 */
export async function batchSaveCellMetadata(
  metadata: CellMetadata[]
): Promise<void> {
  if (metadata.length === 0) return;

  const conn = await getConnection();

  try {
    // Build VALUES clause
    const values = metadata.map(m =>
      `(${formatValue(m.fileId)}, ${formatValue(m.columnId)}, ${m.rowIndex}, ${formatValue(m.status)}, ${formatValue(m.error || null)}, ${formatValue(m.errorType || null)}, ${m.edited ? 'TRUE' : 'FALSE'}, ${formatValue(m.originalValue || null)}, ${formatValue(m.lastEditTime || null)})`
    ).join(',\n');

    await conn.query(`
      INSERT OR REPLACE INTO cell_metadata
      (file_id, column_id, row_index, status, error, error_type, edited, original_value, last_edit_time)
      VALUES ${values}
    `);

    console.log(`[DuckDB Operations] Batch saved ${metadata.length} cell metadata entries`);

  } finally {
    await conn.close();
  }
}

/**
 * Delete cell metadata for a specific cell
 */
export async function deleteCellMetadata(
  fileId: string,
  columnId: string,
  rowIndex: number
): Promise<void> {
  await executeQuery(
    `DELETE FROM cell_metadata WHERE file_id = ? AND column_id = ? AND row_index = ?`,
    [fileId, columnId, rowIndex]
  );
}

/**
 * Delete all cell metadata for a column
 */
export async function deleteColumnCellMetadata(
  fileId: string,
  columnId: string
): Promise<void> {
  await executeQuery(
    `DELETE FROM cell_metadata WHERE file_id = ? AND column_id = ?`,
    [fileId, columnId]
  );

  console.log(`[DuckDB Operations] Deleted all cell metadata for column ${columnId}`);
}

/**
 * Delete all cell and column metadata for a file
 */
export async function deleteFileMetadata(fileId: string): Promise<void> {
  await executeQuery(`DELETE FROM cell_metadata WHERE file_id = ?`, [fileId]);
  await executeQuery(`DELETE FROM column_metadata WHERE file_id = ?`, [fileId]);

  console.log(`[DuckDB Operations] Deleted all metadata for file ${fileId}`);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Infer DuckDB column type from JavaScript value
 */
function inferColumnType(value: unknown): string {
  if (value === null || value === undefined) {
    return 'TEXT'; // Default to TEXT for nulls
  }

  const type = typeof value;

  switch (type) {
    case 'number':
      return Number.isInteger(value) ? 'INTEGER' : 'DOUBLE';
    case 'boolean':
      return 'BOOLEAN';
    case 'object':
      if (value instanceof Date) {
        return 'TIMESTAMP';
      }
      // Arrays and objects stored as JSON
      return 'JSON';
    case 'string':
    default:
      return 'TEXT';
  }
}

/**
 * Format a value for SQL insertion
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (typeof value === 'string') {
    // Escape single quotes
    return `'${value.replace(/'/g, "''")}'`;
  }

  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  if (typeof value === 'number') {
    return value.toString();
  }

  if (value instanceof Date) {
    return `'${value.toISOString()}'`;
  }

  if (typeof value === 'object') {
    // Stringify objects/arrays
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }

  return `'${String(value)}'`;
}

/**
 * Sanitize column name for SQL safety
 */
function sanitizeColumnName(name: string): string {
  // Remove or replace problematic characters
  return name
    .replace(/[^\w.-]/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/^(\d)/, '_$1');   // Prefix with underscore if starts with number
}

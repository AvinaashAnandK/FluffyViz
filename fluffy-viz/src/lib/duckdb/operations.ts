/**
 * Core CRUD operations for DuckDB file data management
 *
 * Handles creating, querying, updating, and deleting file data tables
 */

import { getConnection, executeQuery } from './client';
import type { QueryOptions, RowData, ColumnInfo, CountResult } from './types';

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
 * Get total row count for a file
 */
export async function getFileRowCount(fileId: string): Promise<number> {
  const tableName = `file_data_${fileId}`;
  const result = await executeQuery<CountResult>(`SELECT COUNT(*) as count FROM "${tableName}"`);
  return result[0]?.count || 0;
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

  await executeQuery(
    `ALTER TABLE "${tableName}" ADD COLUMN "${sanitizedColumn}" ${columnType} DEFAULT ?`,
    [defaultValue]
  );

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

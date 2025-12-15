/**
 * Saved Filters Storage
 *
 * CRUD operations for saved embedding view filters.
 * Filters store a set of row indices that can be applied to the spreadsheet.
 */

import { executeQuery, getConnection } from '@/lib/duckdb/client';

/**
 * Saved filter metadata
 */
export interface SavedFilter {
  id: string;
  fileId: string;
  name: string;
  layerId: string;
  rowIndices: number[];
  createdAt: string;
}

/**
 * Saved filter metadata (without row indices for listing)
 */
export interface SavedFilterMetadata {
  id: string;
  name: string;
  layerId: string;
  rowCount: number;
  createdAt: string;
}

/**
 * Generate a unique filter ID
 */
export function generateFilterId(): string {
  return `filter_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper to format SQL values
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.join(',')}]`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Save a new filter
 */
export async function saveFilter(filter: Omit<SavedFilter, 'createdAt'>): Promise<void> {
  console.log(`[Filter Storage] Saving filter ${filter.id}: "${filter.name}" with ${filter.rowIndices.length} rows`);

  const conn = await getConnection();

  try {
    const rowIndicesArray = formatValue(filter.rowIndices);

    await conn.query(`
      INSERT INTO saved_filters (id, file_id, name, layer_id, row_indices, created_at)
      VALUES (
        ${formatValue(filter.id)},
        ${formatValue(filter.fileId)},
        ${formatValue(filter.name)},
        ${formatValue(filter.layerId)},
        ${rowIndicesArray},
        CURRENT_TIMESTAMP
      )
    `);

    console.log(`[Filter Storage] ✓ Filter ${filter.id} saved`);
  } catch (error) {
    console.error('[Filter Storage] Error saving filter:', error);
    throw error;
  } finally {
    await conn.close();
  }
}

/**
 * Get a filter by ID
 */
export async function getFilter(filterId: string): Promise<SavedFilter | null> {
  try {
    const results = await executeQuery<{
      id: string;
      file_id: string;
      name: string;
      layer_id: string;
      row_indices: number[];
      created_at: string;
    }>(`
      SELECT *
      FROM saved_filters
      WHERE id = ${formatValue(filterId)}
      LIMIT 1
    `);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id,
      fileId: row.file_id,
      name: row.name,
      layerId: row.layer_id,
      rowIndices: row.row_indices,
      createdAt: row.created_at,
    };
  } catch (error) {
    console.error('[Filter Storage] Error getting filter:', error);
    return null;
  }
}

/**
 * Get all filters for a file
 */
export async function getFiltersForFile(fileId: string): Promise<SavedFilterMetadata[]> {
  try {
    const results = await executeQuery<{
      id: string;
      name: string;
      layer_id: string;
      row_indices: number[];
      created_at: string;
    }>(`
      SELECT id, name, layer_id, row_indices, created_at
      FROM saved_filters
      WHERE file_id = ${formatValue(fileId)}
      ORDER BY created_at DESC
    `);

    return results.map(row => ({
      id: row.id,
      name: row.name,
      layerId: row.layer_id,
      rowCount: row.row_indices.length,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('[Filter Storage] Error getting filters for file:', error);
    return [];
  }
}

/**
 * Delete a filter by ID
 */
export async function deleteFilter(filterId: string): Promise<void> {
  try {
    await executeQuery(`
      DELETE FROM saved_filters
      WHERE id = ${formatValue(filterId)}
    `);
    console.log(`[Filter Storage] ✓ Filter ${filterId} deleted`);
  } catch (error) {
    console.error('[Filter Storage] Error deleting filter:', error);
    throw error;
  }
}

/**
 * Delete all filters for a file
 */
export async function deleteFiltersForFile(fileId: string): Promise<void> {
  try {
    await executeQuery(`
      DELETE FROM saved_filters
      WHERE file_id = ${formatValue(fileId)}
    `);
    console.log(`[Filter Storage] ✓ All filters for file ${fileId} deleted`);
  } catch (error) {
    console.error('[Filter Storage] Error deleting filters:', error);
    throw error;
  }
}

/**
 * Update filter name
 */
export async function updateFilterName(filterId: string, newName: string): Promise<void> {
  try {
    await executeQuery(`
      UPDATE saved_filters
      SET name = ${formatValue(newName)}
      WHERE id = ${formatValue(filterId)}
    `);
    console.log(`[Filter Storage] ✓ Filter ${filterId} renamed to "${newName}"`);
  } catch (error) {
    console.error('[Filter Storage] Error updating filter name:', error);
    throw error;
  }
}

/**
 * Get row indices for a filter (for applying to spreadsheet queries)
 */
export async function getFilterRowIndices(filterId: string): Promise<number[]> {
  const filter = await getFilter(filterId);
  return filter?.rowIndices ?? [];
}

/**
 * Build a SQL WHERE clause for filtering by row indices
 */
export function buildFilterWhereClause(rowIndices: number[]): string {
  if (rowIndices.length === 0) {
    return 'FALSE'; // No matches
  }

  // Use array contains for efficiency with large arrays
  if (rowIndices.length > 100) {
    // For large arrays, use a temporary table approach
    return `row_index = ANY([${rowIndices.join(',')}])`;
  }

  // For smaller arrays, use IN clause
  return `row_index IN (${rowIndices.join(',')})`;
}

/**
 * File storage operations using DuckDB
 * Replaces IndexedDB for file metadata and data storage
 */

import { executeQuery, persistDatabase } from './client';
import { createFileTable, deleteFileTable } from './operations';
import type { FileMetadata } from './types';
import { parseFileContent } from '../format-parser';
import type { SupportedFormat } from '@/types/agent-data';

// File size limits (same as IndexedDB implementation)
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Save a file to DuckDB (metadata + parsed data)
 * @param fileContent Raw file content string
 * @param fileName File name
 * @param format Detected format
 * @param mimeType MIME type
 * @param existingId Optional existing file ID for updates
 * @returns File ID
 */
export async function saveFileToDuckDB(
  fileContent: string,
  fileName: string,
  format: string,
  mimeType: string,
  existingId?: string
): Promise<string> {
  const size = new Blob([fileContent]).size;

  // Validate file size
  if (size > MAX_FILE_SIZE) {
    throw new Error(
      `File "${fileName}" is too large (${(size / 1024 / 1024).toFixed(2)}MB). ` +
      `Maximum allowed size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    );
  }

  // Warn about large files
  if (size > WARN_FILE_SIZE) {
    console.warn(
      `Warning: File "${fileName}" is large (${(size / 1024 / 1024).toFixed(2)}MB). ` +
      `This may impact browser performance.`
    );
  }

  const id = existingId ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[DuckDB File Storage] Saving file ${id}: ${fileName}`);

  try {
    // Parse file content
    const parsedData = await parseFileContent(fileContent, format as SupportedFormat);

    if (parsedData.length === 0) {
      throw new Error('File parsing resulted in no data rows');
    }

    console.log(`[DuckDB File Storage] Parsed ${parsedData.length} rows`);

    // If updating, delete old table first
    if (existingId) {
      try {
        await deleteFileTable(existingId);
        // Delete old column metadata
        await executeQuery('DELETE FROM column_metadata WHERE file_id = ?', [existingId]);
      } catch (error) {
        console.warn('[DuckDB File Storage] No existing table to delete:', error);
      }
    }

    // Generate IDs for all columns and create metadata
    const { transformedData, columnMetadata } = generateColumnIdsAndTransformData(
      parsedData,
      id
    );

    console.log(`[DuckDB File Storage] Generated IDs for ${columnMetadata.length} columns`);

    // Create data table with transformed data
    await createFileTable(id, transformedData);

    // Store column metadata for all uploaded columns
    const { saveColumnMetadata } = await import('./operations');
    for (const meta of columnMetadata) {
      await saveColumnMetadata(meta);
    }

    console.log(`[DuckDB File Storage] Saved metadata for ${columnMetadata.length} columns`);

    // Store file metadata
    const now = new Date();
    const version = existingId ? await getFileVersion(existingId) + 1 : 1;

    if (existingId) {
      // Update existing metadata
      await executeQuery(
        `UPDATE files
         SET name = ?,
             format = ?,
             last_modified = ?,
             size = ?,
             version = ?
         WHERE id = ?`,
        [fileName, format, now, size, version, id]
      );
    } else {
      // Insert new metadata
      await executeQuery(
        `INSERT INTO files (id, name, format, last_modified, size, version)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, fileName, format, now, size, version]
      );
    }

    console.log(`[DuckDB File Storage] ✓ File saved successfully: ${id}`);

    // Persist database to OPFS
    await persistDatabase();

    return id;

  } catch (error) {
    console.error('[DuckDB File Storage] Error saving file:', error);
    // Clean up on error
    try {
      await deleteFileTable(id);
      if (!existingId) {
        await executeQuery('DELETE FROM files WHERE id = ?', [id]);
        await executeQuery('DELETE FROM column_metadata WHERE file_id = ?', [id]);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Generate unique IDs for all columns and transform data to use IDs as keys
 */
function generateColumnIdsAndTransformData(
  parsedData: Record<string, any>[],
  fileId: string
): {
  transformedData: Record<string, any>[];
  columnMetadata: Array<{
    fileId: string;
    columnId: string;
    columnName: string;
    columnType: 'data' | 'ai-generated' | 'computed';
    createdAt: number;
  }>;
} {
  if (parsedData.length === 0) {
    return { transformedData: [], columnMetadata: [] };
  }

  // Collect all unique column names from all rows (handles sparse data)
  const originalColumnNames = new Set<string>();
  for (const row of parsedData) {
    for (const key of Object.keys(row)) {
      originalColumnNames.add(key);
    }
  }

  const columnNames = Array.from(originalColumnNames);
  const timestamp = Date.now();

  // Generate ID for each column
  const columnIdMap = new Map<string, string>();
  const columnMetadata: Array<{
    fileId: string;
    columnId: string;
    columnName: string;
    columnType: 'data' | 'ai-generated' | 'computed';
    createdAt: number;
  }> = [];

  columnNames.forEach((originalName, index) => {
    const columnId = `col_${timestamp}_${index}`;
    columnIdMap.set(originalName, columnId);

    columnMetadata.push({
      fileId,
      columnId,
      columnName: originalName,
      columnType: 'data',
      createdAt: timestamp,
    });
  });

  // Transform all rows to use column IDs instead of original names
  const transformedData = parsedData.map((row) => {
    const transformedRow: Record<string, any> = {};

    for (const [originalName, value] of Object.entries(row)) {
      const columnId = columnIdMap.get(originalName);
      if (columnId) {
        transformedRow[columnId] = value;
      }
    }

    return transformedRow;
  });

  return { transformedData, columnMetadata };
}

/**
 * Get all file metadata
 */
export async function getAllFiles(): Promise<FileMetadata[]> {
  const files = await executeQuery<FileMetadata>(`
    SELECT id, name, format, last_modified, size, version
    FROM files
    ORDER BY last_modified DESC
  `);
  return files;
}

/**
 * Get single file metadata
 */
export async function getFileMetadata(id: string): Promise<FileMetadata | null> {
  const files = await executeQuery<FileMetadata>(
    'SELECT id, name, format, last_modified, size, version FROM files WHERE id = ?',
    [id]
  );
  return files[0] || null;
}

/**
 * Get file version for optimistic concurrency control
 */
async function getFileVersion(id: string): Promise<number> {
  const result = await executeQuery<{ version: number }>(
    'SELECT version FROM files WHERE id = ?',
    [id]
  );
  return result[0]?.version || 0;
}

/**
 * Rename a file
 */
export async function renameFile(id: string, newName: string): Promise<void> {
  const now = new Date();
  await executeQuery(
    'UPDATE files SET name = ?, last_modified = ? WHERE id = ?',
    [newName, now, id]
  );
  console.log(`[DuckDB File Storage] File renamed: ${id} -> ${newName}`);
}

/**
 * Delete a file (metadata + data table)
 */
export async function deleteFile(id: string): Promise<void> {
  // Delete data table
  await deleteFileTable(id);

  // Delete metadata
  await executeQuery('DELETE FROM files WHERE id = ?', [id]);

  console.log(`[DuckDB File Storage] File deleted: ${id}`);
}

/**
 * Clear all files
 */
export async function clearAllFiles(): Promise<void> {
  // Get all file IDs
  const files = await getAllFiles();

  // Delete each file's data table
  for (const file of files) {
    try {
      await deleteFileTable(file.id);
    } catch (error) {
      console.warn(`[DuckDB File Storage] Failed to delete table for ${file.id}:`, error);
    }
  }

  // Delete all metadata
  await executeQuery('DELETE FROM files');

  console.log('[DuckDB File Storage] All files cleared');
}

/**
 * Check if file exists
 */
export async function fileExists(id: string): Promise<boolean> {
  const result = await executeQuery<{ exists: boolean }>(
    'SELECT COUNT(*) > 0 as exists FROM files WHERE id = ?',
    [id]
  );
  return result[0]?.exists || false;
}

/**
 * Get all data rows for a file from its DuckDB table
 */
export async function getFileData(id: string): Promise<Record<string, any>[]> {
  const { queryFileData } = await import('./operations');
  return await queryFileData(id, { limit: 10000 }); // Large limit for all data
}

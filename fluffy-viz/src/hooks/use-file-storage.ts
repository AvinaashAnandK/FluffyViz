/**
 * File storage hook using DuckDB WASM
 * Migrated from IndexedDB to DuckDB for better query capabilities
 */

import { useState, useEffect, useCallback } from 'react';
import { initializeSchema, isSchemaInitialized } from '@/lib/duckdb/schema';
import {
  saveFileToDuckDB,
  getAllFiles,
  renameFile as renameFileInDB,
  deleteFile as deleteFileInDB,
  clearAllFiles as clearAllFilesInDB,
  MAX_FILE_SIZE,
  WARN_FILE_SIZE,
} from '@/lib/duckdb/file-storage';
import type { FileMetadata } from '@/lib/duckdb/types';

/**
 * StoredFile interface - DuckDB version (no raw content stored)
 */
export interface StoredFile {
  id: string;
  name: string;
  format: string;
  lastModified: number;
  size: number;
  mimeType: string;
  version?: number;
}

// Re-export file size limits for compatibility
export { MAX_FILE_SIZE, WARN_FILE_SIZE };

// Global event system for synchronizing all hook instances
const filesChangedEvent = 'filesStorageChanged';

const notifyFilesChanged = () => {
  window.dispatchEvent(new CustomEvent(filesChangedEvent));
};

// Track schema initialization
let schemaInitialized = false;
let schemaInitializing: Promise<void> | null = null;

/**
 * Ensure DuckDB schema is initialized before operations
 */
async function ensureSchemaInitialized(): Promise<void> {
  if (schemaInitialized) return;

  if (schemaInitializing) {
    await schemaInitializing;
    return;
  }

  schemaInitializing = (async () => {
    try {
      const initialized = await isSchemaInitialized();
      if (!initialized) {
        console.log('[useFileStorage] Initializing DuckDB schema...');
        await initializeSchema();
      }
      schemaInitialized = true;
      console.log('[useFileStorage] DuckDB schema ready');
    } catch (error) {
      console.error('[useFileStorage] Failed to initialize schema:', error);
      throw error;
    } finally {
      schemaInitializing = null;
    }
  })();

  await schemaInitializing;
}

/**
 * Convert FileMetadata to StoredFile for compatibility
 */
function fileMetadataToStoredFile(metadata: FileMetadata): StoredFile {
  return {
    id: metadata.id,
    name: metadata.name,
    format: metadata.format,
    lastModified: new Date(metadata.last_modified).getTime(),
    size: metadata.size,
    mimeType: getMimeType(metadata.format),
    version: metadata.version,
  };
}

/**
 * Get MIME type from format
 */
function getMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    'csv': 'text/csv',
    'json': 'application/json',
    'jsonl': 'application/jsonl',
    'message-centric': 'application/jsonl',
    'langfuse': 'application/json',
    'langsmith': 'application/json',
    'arize': 'application/json',
    'turn-level': 'text/csv',
  };
  return mimeTypes[format] || 'text/plain';
}

/**
 * File storage hook - DuckDB version
 */
export function useFileStorage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      await ensureSchemaInitialized();
      const fileMetadata = await getAllFiles();
      const storedFiles = fileMetadata.map(fileMetadataToStoredFile);
      setFiles(storedFiles);
    } catch (error) {
      console.error('[useFileStorage] Error loading files:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();

    // Listen for changes from other hook instances
    const handleFilesChanged = () => {
      loadFiles();
    };

    window.addEventListener(filesChangedEvent, handleFilesChanged);

    return () => {
      window.removeEventListener(filesChangedEvent, handleFilesChanged);
    };
  }, [loadFiles]);

  const saveFile = useCallback(async (
    fileContent: string,
    fileName: string,
    format: string,
    mimeType: string,
    existingId?: string
  ) => {
    try {
      await ensureSchemaInitialized();
      const id = await saveFileToDuckDB(fileContent, fileName, format, mimeType, existingId);
      await loadFiles();
      notifyFilesChanged();
      return id;
    } catch (error) {
      console.error('[useFileStorage] Error saving file:', error);
      throw error;
    }
  }, [loadFiles]);

  const renameFile = useCallback(async (id: string, newName: string) => {
    try {
      await ensureSchemaInitialized();
      await renameFileInDB(id, newName);
      await loadFiles();
      notifyFilesChanged();
    } catch (error) {
      console.error('[useFileStorage] Error renaming file:', error);
      throw error;
    }
  }, [loadFiles]);

  const deleteFile = useCallback(async (id: string) => {
    try {
      await ensureSchemaInitialized();
      await deleteFileInDB(id);
      await loadFiles();
      notifyFilesChanged();
    } catch (error) {
      console.error('[useFileStorage] Error deleting file:', error);
      throw error;
    }
  }, [loadFiles]);

  const clearAllFiles = useCallback(async () => {
    try {
      await ensureSchemaInitialized();
      await clearAllFilesInDB();
      await loadFiles();
      notifyFilesChanged();
    } catch (error) {
      console.error('[useFileStorage] Error clearing files:', error);
      throw error;
    }
  }, [loadFiles]);

  const getFile = useCallback((id: string): StoredFile | undefined => {
    // Synchronous lookup from loaded files (same as original behavior)
    return files.find(f => f.id === id);
  }, [files]);

  return {
    files,
    fileCount: files.length,
    loading,
    saveFile,
    renameFile,
    deleteFile,
    clearAllFiles,
    getFile,
    refreshFiles: loadFiles,
  };
}

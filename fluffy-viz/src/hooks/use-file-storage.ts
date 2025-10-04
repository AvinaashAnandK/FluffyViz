import { useState, useEffect, useCallback } from 'react';

export interface StoredFile {
  id: string;
  name: string;
  content: string;
  format: string;
  lastModified: number;
  size: number;
  mimeType: string;
  version?: number; // For optimistic concurrency control
}

const DB_NAME = 'FluffyVizDB';
const DB_VERSION = 2;
const STORE_NAME = 'files';

// File size limits (50MB max for safety)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const WARN_FILE_SIZE = 10 * 1024 * 1024; // 10MB warning threshold

// Operation queue for preventing race conditions
class OperationQueue {
  private queue: Array<() => Promise<void>> = [];
  private processing = false;

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    while (this.queue.length > 0) {
      const operation = this.queue.shift();
      if (operation) {
        await operation();
      }
    }
    this.processing = false;
  }
}

const operationQueue = new OperationQueue();

class FileStorageDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('lastModified', 'lastModified', { unique: false });
        }

        // Migration for version 2: add version field for existing files
        if (oldVersion < 2) {
          const transaction = (event.target as IDBOpenDBRequest).transaction;
          if (transaction) {
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (e) => {
              const cursor = (e.target as IDBRequest).result;
              if (cursor) {
                const file = cursor.value;
                if (file.version === undefined) {
                  file.version = 1;
                  cursor.update(file);
                }
                cursor.continue();
              }
            };
          }
        }
      };
    });
  }

  async getAllFiles(): Promise<StoredFile[]> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<StoredFile[]>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const files = request.result.sort((a, b) => b.lastModified - a.lastModified);
          resolve(files);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getFile(id: string): Promise<StoredFile | undefined> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<StoredFile | undefined>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async addFile(file: StoredFile): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      // Initialize version for optimistic concurrency control
      const fileWithVersion = { ...file, version: 1 };

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.add(fileWithVersion);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async updateFile(file: StoredFile): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Get current version for optimistic concurrency control
        const getRequest = store.get(file.id);

        getRequest.onsuccess = () => {
          const existingFile = getRequest.result;

          if (existingFile && file.version && existingFile.version !== file.version) {
            reject(new Error('File was modified by another process. Please refresh and try again.'));
            return;
          }

          // Increment version
          const updatedFile = {
            ...file,
            version: (existingFile?.version || 0) + 1
          };

          const putRequest = store.put(updatedFile);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };

        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  }

  async deleteFile(id: string): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  async clearAll(): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }
}

const db = new FileStorageDB();

// Global event system for synchronizing all hook instances
const filesChangedEvent = 'filesStorageChanged';

const notifyFilesChanged = () => {
  window.dispatchEvent(new CustomEvent(filesChangedEvent));
};

export function useFileStorage() {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      const storedFiles = await db.getAllFiles();
      setFiles(storedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
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
    const size = new Blob([fileContent]).size;

    // Check file size before processing
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

    try {
      let version: number | undefined;

      // Get current version if updating existing file
      if (existingId) {
        const existingFile = await db.getFile(existingId);
        version = existingFile?.version;
      }

      const storedFile: StoredFile = {
        id,
        name: fileName,
        content: fileContent,
        format,
        lastModified: Date.now(),
        size,
        mimeType,
        version
      };

      if (existingId) {
        await db.updateFile(storedFile);
      } else {
        await db.addFile(storedFile);
      }
      await loadFiles();
      notifyFilesChanged(); // Notify all instances
      return storedFile.id;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }, [loadFiles]);

  const renameFile = useCallback(async (id: string, newName: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    const updatedFile = { ...file, name: newName, lastModified: Date.now() };

    try {
      await db.updateFile(updatedFile);
      await loadFiles();
      notifyFilesChanged(); // Notify all instances
    } catch (error) {
      console.error('Error renaming file:', error);
      throw error;
    }
  }, [files, loadFiles]);

  const deleteFile = useCallback(async (id: string) => {
    try {
      await db.deleteFile(id);
      await loadFiles();
      notifyFilesChanged(); // Notify all instances
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }, [loadFiles]);

  const clearAllFiles = useCallback(async () => {
    try {
      await db.clearAll();
      await loadFiles();
      notifyFilesChanged(); // Notify all instances
    } catch (error) {
      console.error('Error clearing files:', error);
      throw error;
    }
  }, [loadFiles]);

  const getFile = useCallback((id: string) => {
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
    refreshFiles: loadFiles
  };
}

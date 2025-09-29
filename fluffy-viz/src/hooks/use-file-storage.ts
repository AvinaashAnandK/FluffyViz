import { useState, useEffect, useCallback } from 'react';

export interface StoredFile {
  id: string;
  name: string;
  content: string;
  format: string;
  lastModified: number;
  size: number;
  mimeType: string;
}

const DB_NAME = 'FluffyVizDB';
const DB_VERSION = 1;
const STORE_NAME = 'files';

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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('lastModified', 'lastModified', { unique: false });
        }
      };
    });
  }

  async getAllFiles(): Promise<StoredFile[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result.sort((a, b) => b.lastModified - a.lastModified);
        resolve(files);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addFile(file: StoredFile): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(file);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateFile(file: StoredFile): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(file);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteFile(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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
    const id = existingId ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const storedFile: StoredFile = {
      id,
      name: fileName,
      content: fileContent,
      format,
      lastModified: Date.now(),
      size: new Blob([fileContent]).size,
      mimeType
    };

    try {
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

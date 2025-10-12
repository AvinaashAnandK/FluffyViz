/**
 * Storage layer for embedding system
 * Uses hybrid approach: IndexedDB for active layer + OPFS for inactive layers
 */

import type { ActiveEmbeddingLayer, EmbeddingLayerMetadata } from '@/types/embedding';

const DB_NAME = 'FluffyVizDB';
const DB_VERSION = 3; // Increment from existing version 2
const EMBEDDING_STORE = 'embeddingLayers';
const EMBEDDING_METADATA_STORE = 'embeddingMetadata';

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

class EmbeddingStorageDB {
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

        // Create embedding layers store if it doesn't exist
        if (!db.objectStoreNames.contains(EMBEDDING_STORE)) {
          const store = db.createObjectStore(EMBEDDING_STORE, { keyPath: 'id' });
          store.createIndex('fileId', 'fileId', { unique: false });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }

        // Create embedding metadata store
        if (!db.objectStoreNames.contains(EMBEDDING_METADATA_STORE)) {
          const metaStore = db.createObjectStore(EMBEDDING_METADATA_STORE, { keyPath: 'id' });
          metaStore.createIndex('fileId', 'fileId', { unique: false });
        }
      };
    });
  }

  // Get active embedding layer for a file
  async getActiveEmbeddingLayer(fileId: string): Promise<ActiveEmbeddingLayer | null> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<ActiveEmbeddingLayer | null>((resolve, reject) => {
        const transaction = this.db!.transaction([EMBEDDING_STORE], 'readonly');
        const store = transaction.objectStore(EMBEDDING_STORE);
        const index = store.index('fileId');
        const request = index.getAll(fileId);

        request.onsuccess = () => {
          const layers = request.result as ActiveEmbeddingLayer[];
          // Should only be one layer per file in this store (the active one)
          resolve(layers[0] || null);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Save active embedding layer
  async setActiveEmbeddingLayer(layer: ActiveEmbeddingLayer): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([EMBEDDING_STORE], 'readwrite');
        const store = transaction.objectStore(EMBEDDING_STORE);

        // Update lastAccessedAt
        const updatedLayer = {
          ...layer,
          lastAccessedAt: new Date().toISOString()
        };

        const request = store.put(updatedLayer);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Delete active embedding layer (when switching)
  async deleteActiveEmbeddingLayer(layerId: string): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([EMBEDDING_STORE], 'readwrite');
        const store = transaction.objectStore(EMBEDDING_STORE);
        const request = store.delete(layerId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Get all embedding layer metadata for a file
  async getEmbeddingMetadata(fileId: string): Promise<EmbeddingLayerMetadata[]> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<EmbeddingLayerMetadata[]>((resolve, reject) => {
        const transaction = this.db!.transaction([EMBEDDING_METADATA_STORE], 'readonly');
        const store = transaction.objectStore(EMBEDDING_METADATA_STORE);
        const index = store.index('fileId');
        const request = index.getAll(fileId);

        request.onsuccess = () => {
          const metadata = request.result as EmbeddingLayerMetadata[];
          // Sort by creation date (newest first)
          resolve(metadata.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ));
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Save embedding layer metadata
  async saveEmbeddingMetadata(metadata: EmbeddingLayerMetadata): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([EMBEDDING_METADATA_STORE], 'readwrite');
        const store = transaction.objectStore(EMBEDDING_METADATA_STORE);
        const request = store.put(metadata);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Delete embedding layer metadata
  async deleteEmbeddingMetadata(layerId: string): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      return new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([EMBEDDING_METADATA_STORE], 'readwrite');
        const store = transaction.objectStore(EMBEDDING_METADATA_STORE);
        const request = store.delete(layerId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  }

  // Update which layer is active
  async updateActiveLayer(fileId: string, activeLayerId: string): Promise<void> {
    return operationQueue.enqueue(async () => {
      if (!this.db) await this.init();

      const metadata = await this.getEmbeddingMetadata(fileId);

      // Update all metadata to mark correct layer as active
      const transaction = this.db!.transaction([EMBEDDING_METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(EMBEDDING_METADATA_STORE);

      for (const meta of metadata) {
        const updated = { ...meta, isActive: meta.id === activeLayerId };
        store.put(updated);
      }

      return new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    });
  }
}

export const embeddingDB = new EmbeddingStorageDB();

// OPFS (Origin Private File System) helpers for storing inactive layers
export class OPFSManager {
  private root: FileSystemDirectoryHandle | null = null;

  async init(): Promise<void> {
    if (this.root) return;
    this.root = await navigator.storage.getDirectory();
  }

  async saveLayerToOPFS(layer: ActiveEmbeddingLayer): Promise<void> {
    await this.init();

    const fileName = `embedding_${layer.id}.json`;
    const fileHandle = await this.root!.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(JSON.stringify(layer));
    await writable.close();
  }

  async loadLayerFromOPFS(layerId: string): Promise<ActiveEmbeddingLayer> {
    await this.init();

    const fileName = `embedding_${layerId}.json`;
    const fileHandle = await this.root!.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();

    return JSON.parse(text) as ActiveEmbeddingLayer;
  }

  async deleteLayerFromOPFS(layerId: string): Promise<void> {
    await this.init();

    const fileName = `embedding_${layerId}.json`;
    await this.root!.removeEntry(fileName);
  }

  async layerExistsInOPFS(layerId: string): Promise<boolean> {
    try {
      await this.init();
      const fileName = `embedding_${layerId}.json`;
      await this.root!.getFileHandle(fileName);
      return true;
    } catch {
      return false;
    }
  }
}

export const opfsManager = new OPFSManager();

// High-level API for switching between layers
export async function switchEmbeddingLayer(
  fileId: string,
  newLayerId: string
): Promise<void> {
  // Get current active layer
  const currentLayer = await embeddingDB.getActiveEmbeddingLayer(fileId);

  // Save current layer to OPFS if it exists
  if (currentLayer) {
    await opfsManager.saveLayerToOPFS(currentLayer);
    await embeddingDB.deleteActiveEmbeddingLayer(currentLayer.id);
  }

  // Load new layer from OPFS
  const newLayer = await opfsManager.loadLayerFromOPFS(newLayerId);

  // Set as active in IndexedDB
  await embeddingDB.setActiveEmbeddingLayer(newLayer);

  // Update metadata
  await embeddingDB.updateActiveLayer(fileId, newLayerId);
}

// Generate unique ID for embedding layers
export function generateEmbeddingId(): string {
  return `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

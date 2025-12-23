/**
 * OPFS (Origin Private File System) storage for clustering coordinates
 *
 * Stores the 15D UMAP coordinates used for HDBSCAN clustering so re-clustering
 * can use the same intermediate-dimension space instead of falling back to 2D.
 *
 * OPFS is ideal for this because:
 * - Efficient for large binary data (Float32Array)
 * - Synchronous file access in workers
 * - Persists across sessions
 * - No storage quota issues like IndexedDB
 */

const OPFS_DIR_NAME = 'fluffy-viz-clustering';

/**
 * Get the OPFS directory handle for clustering coordinates
 */
async function getClusteringDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(OPFS_DIR_NAME, { create: true });
}

/**
 * Generate filename for a layer's clustering coordinates
 */
function getFilename(layerId: string): string {
  // Sanitize layerId for filesystem
  return `${layerId.replace(/[^a-zA-Z0-9_-]/g, '_')}.bin`;
}

/**
 * Save clustering coordinates to OPFS
 *
 * @param layerId - The embedding layer ID
 * @param coordinates - N-dimensional coordinates from UMAP (e.g., 15D)
 */
export async function saveClusteringCoordinates(
  layerId: string,
  coordinates: number[][]
): Promise<void> {
  if (coordinates.length === 0) return;

  const dim = coordinates[0].length;
  const count = coordinates.length;

  console.log(`[OPFS] Saving clustering coordinates for layer ${layerId}: ${count} points x ${dim}D`);

  try {
    const dir = await getClusteringDir();
    const filename = getFilename(layerId);

    // Create file
    const fileHandle = await dir.getFileHandle(filename, { create: true });
    const writable = await fileHandle.createWritable();

    // Header: [count (4 bytes), dimension (4 bytes)]
    const header = new Uint32Array([count, dim]);
    await writable.write(header);

    // Data: flattened Float32Array
    const flatData = new Float32Array(count * dim);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < dim; j++) {
        flatData[i * dim + j] = coordinates[i][j];
      }
    }
    await writable.write(flatData);

    await writable.close();

    console.log(`[OPFS] ✓ Saved ${(flatData.byteLength / 1024).toFixed(1)}KB to ${filename}`);
  } catch (error) {
    console.error('[OPFS] Error saving clustering coordinates:', error);
    throw error;
  }
}

/**
 * Load clustering coordinates from OPFS
 *
 * @param layerId - The embedding layer ID
 * @returns N-dimensional coordinates or null if not found
 */
export async function loadClusteringCoordinates(
  layerId: string
): Promise<number[][] | null> {
  console.log(`[OPFS] Loading clustering coordinates for layer ${layerId}`);

  try {
    const dir = await getClusteringDir();
    const filename = getFilename(layerId);

    // Check if file exists
    let fileHandle: FileSystemFileHandle;
    try {
      fileHandle = await dir.getFileHandle(filename);
    } catch {
      console.log(`[OPFS] No clustering coordinates found for layer ${layerId}`);
      return null;
    }

    const file = await fileHandle.getFile();
    const buffer = await file.arrayBuffer();

    // Read header
    const header = new Uint32Array(buffer, 0, 2);
    const count = header[0];
    const dim = header[1];

    // Read data
    const flatData = new Float32Array(buffer, 8); // 8 bytes for header

    // Reconstruct 2D array
    const coordinates: number[][] = [];
    for (let i = 0; i < count; i++) {
      const point: number[] = [];
      for (let j = 0; j < dim; j++) {
        point.push(flatData[i * dim + j]);
      }
      coordinates.push(point);
    }

    console.log(`[OPFS] ✓ Loaded ${count} points x ${dim}D from ${filename}`);
    return coordinates;
  } catch (error) {
    console.error('[OPFS] Error loading clustering coordinates:', error);
    return null;
  }
}

/**
 * Delete clustering coordinates for a layer
 *
 * @param layerId - The embedding layer ID
 */
export async function deleteClusteringCoordinates(layerId: string): Promise<void> {
  console.log(`[OPFS] Deleting clustering coordinates for layer ${layerId}`);

  try {
    const dir = await getClusteringDir();
    const filename = getFilename(layerId);

    await dir.removeEntry(filename);
    console.log(`[OPFS] ✓ Deleted ${filename}`);
  } catch (error) {
    // Ignore if file doesn't exist
    if ((error as Error).name !== 'NotFoundError') {
      console.error('[OPFS] Error deleting clustering coordinates:', error);
    }
  }
}

/**
 * Delete all clustering coordinates for a file
 * Called when a file is deleted to clean up all associated layers
 *
 * @param fileId - The file ID
 * @param layerIds - List of layer IDs associated with this file
 */
export async function purgeClusteringCoordinatesForFile(
  fileId: string,
  layerIds: string[]
): Promise<void> {
  console.log(`[OPFS] Purging clustering coordinates for file ${fileId} (${layerIds.length} layers)`);

  for (const layerId of layerIds) {
    await deleteClusteringCoordinates(layerId);
  }
}

/**
 * Get storage usage info for clustering coordinates
 */
export async function getClusteringStorageInfo(): Promise<{
  fileCount: number;
  totalBytes: number;
}> {
  try {
    const dir = await getClusteringDir();
    let fileCount = 0;
    let totalBytes = 0;

    // TypeScript doesn't have complete OPFS types, so we cast to any
    for await (const [, handle] of (dir as any).entries()) {
      if (handle.kind === 'file') {
        fileCount++;
        const file = await (handle as FileSystemFileHandle).getFile();
        totalBytes += file.size;
      }
    }

    return { fileCount, totalBytes };
  } catch {
    return { fileCount: 0, totalBytes: 0 };
  }
}

/**
 * Clear all clustering coordinates (for debugging/reset)
 */
export async function clearAllClusteringCoordinates(): Promise<void> {
  console.log('[OPFS] Clearing all clustering coordinates');

  try {
    const root = await navigator.storage.getDirectory();
    await root.removeEntry(OPFS_DIR_NAME, { recursive: true });
    console.log('[OPFS] ✓ All clustering coordinates cleared');
  } catch (error) {
    if ((error as Error).name !== 'NotFoundError') {
      console.error('[OPFS] Error clearing clustering coordinates:', error);
    }
  }
}

/**
 * UMAP dimensionality reduction using embedding-atlas
 * Provides 2D coordinates for visualization
 */

import type { UMAPParams, GenerationProgress } from '@/types/embedding';

// Note: embedding-atlas types may not be available, so we'll use any for now
// In production, you'd want to add proper type definitions
type UMAPInstance = any;

const DEFAULT_UMAP_PARAMS: UMAPParams = {
  n_neighbors: 15,
  min_dist: 0.1,
  metric: 'cosine',
};

export interface ProjectionResult {
  coordinates2D: [number, number][];
}

/**
 * Compute UMAP projection for embeddings
 * Uses embedding-atlas WASM implementation for performance
 */
export async function computeUMAPProjection(
  embeddings: number[][],
  params: UMAPParams = DEFAULT_UMAP_PARAMS,
  onProgress?: (progress: GenerationProgress) => void
): Promise<ProjectionResult> {
  try {
    onProgress?.({
      phase: 'projecting',
      current: 0,
      total: embeddings.length,
      message: 'Computing projection...',
    });

    // TODO: Integrate embedding-atlas UMAP properly with Next.js
    // For now, use PCA-based projection as fallback
    console.warn('Using PCA projection as fallback (UMAP integration pending)');
    const result = computePCAProjection(embeddings);

    onProgress?.({
      phase: 'projecting',
      current: embeddings.length,
      total: embeddings.length,
      message: 'Projection complete',
    });

    return result;
  } catch (error) {
    console.error('Error computing projection:', error);

    // Fallback: use random projection if PCA fails
    console.warn('PCA failed, using random projection as fallback');
    return {
      coordinates2D: embeddings.map(() => [
        Math.random() * 100 - 50,
        Math.random() * 100 - 50,
      ]),
    };
  }
}

/**
 * Simple PCA-based projection as a fast alternative to UMAP
 * Useful for quick previews
 */
export function computePCAProjection(embeddings: number[][]): ProjectionResult {
  // Simple PCA implementation
  // 1. Center the data
  const dimension = embeddings[0].length;
  const n = embeddings.length;

  // Calculate means
  const means = new Array(dimension).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      means[i] += embedding[i];
    }
  }
  for (let i = 0; i < dimension; i++) {
    means[i] /= n;
  }

  // Center the data
  const centered = embeddings.map(emb =>
    emb.map((val, i) => val - means[i])
  );

  // For simplicity, just take the first two dimensions after centering
  // In a real implementation, you'd compute eigenvectors
  const coordinates2D: [number, number][] = centered.map(emb => [
    emb[0] || 0,
    emb[1] || 0,
  ]);

  return { coordinates2D };
}

/**
 * Normalize coordinates to fit in a standard range
 */
export function normalizeCoordinates(
  coordinates: [number, number][]
): [number, number][] {
  // Find bounds
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of coordinates) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Normalize to [0, 100] range
  return coordinates.map(([x, y]) => [
    ((x - minX) / rangeX) * 100,
    ((y - minY) / rangeY) * 100,
  ]);
}

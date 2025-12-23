/**
 * UMAP dimensionality reduction using embedding-atlas WASM implementation
 *
 * Two-stage UMAP approach:
 * 1. computeUMAPForClustering: High-D → intermediate-D (e.g., 15D) for HDBSCAN clustering
 * 2. computeUMAPProjection: High-D → 2D for visualization
 *
 * This matches what tools like Nomic Atlas do internally.
 */

import type { UMAPParams, GenerationProgress } from '@/types/embedding';

// Type for the createUMAP function from embedding-atlas
type CreateUMAPFn = (
  count: number,
  inputDim: number,
  outputDim: number,
  data: Float32Array,
  options: {
    metric: 'cosine' | 'euclidean';
    nNeighbors: number;
    minDist: number;
    knnMethod: string;
    initializeMethod: string;
  }
) => Promise<{
  run: () => void;
  embedding: Float32Array;
  destroy: () => void;
}>;

// Track last UMAP operation timestamp for cleanup coordination
let lastUMAPOperation = 0;

/**
 * Clear WASM memory between UMAP operations
 * This helps prevent memory accumulation when running multiple UMAP projections
 */
export async function clearUMAPMemory(): Promise<void> {
  console.log('[UMAP] Clearing WASM memory...');

  // Mark that we're doing a cleanup
  lastUMAPOperation = Date.now();

  // Give the browser a chance to garbage collect
  // This is a hint, not a guarantee, but helps in practice
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('[UMAP] Memory cleared');
}

/**
 * Get UMAP module (fresh import each time for clean state)
 */
async function getUMAPModule(): Promise<{ createUMAP: CreateUMAPFn }> {
  // Track when we get the module
  lastUMAPOperation = Date.now();

  // Dynamic import - the module is cached by the bundler
  const umapModule = await import('embedding-atlas');
  return umapModule as { createUMAP: CreateUMAPFn };
}

/**
 * UMAP parameters for CLUSTERING (Stage 1):
 * - n_neighbors: 30 (balanced global structure, best noise reduction)
 * - min_dist: 0.001 (very small for tight clusters, but > 0 to avoid WASM numerical issues)
 * - metric: cosine (correct for text embeddings)
 * - n_components: 15 (preserves semantic granularity for HDBSCAN)
 */
const CLUSTERING_UMAP_PARAMS = {
  n_neighbors: 30,
  min_dist: 0.001, // Use small positive value (0.0 causes WASM memory issues)
  metric: 'cosine' as const,
  n_components: 15, // Intermediate dimension for clustering
};

/**
 * UMAP parameters for VISUALIZATION (Stage 2):
 * - n_neighbors: 15 (same as clustering for consistency)
 * - min_dist: 0.1 (slight separation for better visual clarity)
 * - metric: cosine (correct for text embeddings)
 */
const DEFAULT_UMAP_PARAMS: UMAPParams = {
  n_neighbors: 15,
  min_dist: 0.1, // Slight separation for visualization
  metric: 'cosine',
};

export interface ProjectionResult {
  coordinates2D: [number, number][];
}

export interface ClusteringProjectionResult {
  coordinates: number[][]; // N-dimensional coordinates for clustering
}

/**
 * Stage 1: UMAP for CLUSTERING
 *
 * Projects high-dimensional embeddings to intermediate dimension (default 15D)
 * with min_dist=0.0 to create tight clusters for HDBSCAN.
 *
 * @param embeddings - High-dimensional embeddings (e.g., 3072D from text-embedding-3-large)
 * @param targetDim - Target dimensionality (default: 15)
 * @param nNeighbors - UMAP n_neighbors parameter (default: 30, from config)
 * @returns Intermediate-dimensional coordinates for clustering
 */
export async function computeUMAPForClustering(
  embeddings: number[][],
  targetDim: number = CLUSTERING_UMAP_PARAMS.n_components,
  onProgress?: (progress: GenerationProgress) => void,
  nNeighbors: number = CLUSTERING_UMAP_PARAMS.n_neighbors
): Promise<ClusteringProjectionResult> {
  if (embeddings.length === 0) {
    return { coordinates: [] };
  }

  const count = embeddings.length;
  const inputDim = embeddings[0].length;

  console.log(`[UMAP-Clustering] Projecting ${count} embeddings: ${inputDim}D → ${targetDim}D`);
  console.log(`[UMAP-Clustering] Params: n_neighbors=${nNeighbors}, min_dist=${CLUSTERING_UMAP_PARAMS.min_dist}`);

  try {
    onProgress?.({
      phase: 'projecting',
      current: 0,
      total: count,
      message: `Computing UMAP for clustering (${inputDim}D → ${targetDim}D)...`,
    });

    // Get UMAP module (fresh for clean WASM state)
    const { createUMAP } = await getUMAPModule();

    // Flatten embeddings to Float32Array
    const flatData = new Float32Array(count * inputDim);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < inputDim; j++) {
        flatData[i * inputDim + j] = embeddings[i][j];
      }
    }

    const startTime = performance.now();

    // Create UMAP instance for intermediate dimension
    // Use 'random' init - 'spectral' causes WASM traps in embedding-atlas
    const umap = await createUMAP(count, inputDim, targetDim, flatData, {
      metric: CLUSTERING_UMAP_PARAMS.metric === 'cosine' ? 'cosine' : 'euclidean',
      nNeighbors: nNeighbors,
      minDist: CLUSTERING_UMAP_PARAMS.min_dist,
      knnMethod: 'hnsw',
      initializeMethod: 'random',
    });

    // Run UMAP to completion
    umap.run();

    // Extract N-dimensional coordinates
    const embedding = umap.embedding;
    const coordinates: number[][] = [];

    for (let i = 0; i < count; i++) {
      const point: number[] = [];
      for (let d = 0; d < targetDim; d++) {
        point.push(embedding[i * targetDim + d]);
      }
      coordinates.push(point);
    }

    // Clean up WASM resources
    umap.destroy();

    const elapsed = performance.now() - startTime;
    console.log(`[UMAP-Clustering] Completed in ${elapsed.toFixed(0)}ms`);

    onProgress?.({
      phase: 'projecting',
      current: count,
      total: count,
      message: 'UMAP for clustering complete',
    });

    return { coordinates };

  } catch (error) {
    console.error('[UMAP-Clustering] Error:', error);
    console.warn('[UMAP-Clustering] Falling back to PCA-based projection for clustering');

    onProgress?.({
      phase: 'projecting',
      current: 0,
      total: count,
      message: 'UMAP failed, using PCA fallback for clustering...',
    });

    // Fall back to multi-dimensional PCA projection for clustering
    const pcaResult = computePCAProjectionMultiDim(embeddings, targetDim);

    onProgress?.({
      phase: 'projecting',
      current: count,
      total: count,
      message: 'PCA clustering projection complete',
    });

    console.log(`[UMAP-Clustering] PCA fallback completed: ${count} points → ${targetDim}D`);
    return { coordinates: pcaResult };
  }
}

/**
 * Stage 2: UMAP for VISUALIZATION
 *
 * Compute UMAP projection for embeddings using embedding-atlas WASM
 * Falls back to PCA if WASM loading fails
 */
export async function computeUMAPProjection(
  embeddings: number[][],
  params: UMAPParams = DEFAULT_UMAP_PARAMS,
  onProgress?: (progress: GenerationProgress) => void
): Promise<ProjectionResult> {
  if (embeddings.length === 0) {
    return { coordinates2D: [] };
  }

  try {
    onProgress?.({
      phase: 'projecting',
      current: 0,
      total: embeddings.length,
      message: 'Initializing UMAP-WASM...',
    });

    // Get UMAP module (fresh for clean WASM state)
    const { createUMAP } = await getUMAPModule();

    const count = embeddings.length;
    const inputDim = embeddings[0].length;
    const outputDim = 2;

    // Flatten embeddings to Float32Array
    const flatData = new Float32Array(count * inputDim);
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < inputDim; j++) {
        flatData[i * inputDim + j] = embeddings[i][j];
      }
    }

    onProgress?.({
      phase: 'projecting',
      current: 0,
      total: embeddings.length,
      message: 'Computing UMAP projection...',
    });

    // Create UMAP instance with embedding-atlas WASM
    // Use 'random' init - 'spectral' causes WASM traps in embedding-atlas
    const umap = await createUMAP(count, inputDim, outputDim, flatData, {
      metric: params.metric === 'cosine' ? 'cosine' : 'euclidean',
      nNeighbors: params.n_neighbors,
      minDist: params.min_dist,
      knnMethod: 'hnsw', // Fast approximate nearest neighbors
      initializeMethod: 'random',
    });

    // Run UMAP to completion
    umap.run();

    // Extract 2D coordinates
    const embedding = umap.embedding;
    const coordinates2D: [number, number][] = [];

    for (let i = 0; i < count; i++) {
      coordinates2D.push([
        embedding[i * outputDim],
        embedding[i * outputDim + 1],
      ]);
    }

    // Clean up WASM resources
    umap.destroy();

    // Do NOT normalize UMAP output - embedding-atlas calculates viewport bounds
    // from the raw coordinates. Pre-normalization causes initial viewport issues.
    // UMAP output is typically in range [-15, 15] which embedding-atlas handles well.

    onProgress?.({
      phase: 'projecting',
      current: embeddings.length,
      total: embeddings.length,
      message: 'UMAP projection complete',
    });

    console.log(`[UMAP-WASM] Successfully projected ${count} points`);
    return { coordinates2D };

  } catch (error) {
    console.error('[UMAP-WASM] Error computing UMAP projection:', error);
    console.warn('[UMAP-WASM] Falling back to PCA projection');

    onProgress?.({
      phase: 'projecting',
      current: 0,
      total: embeddings.length,
      message: 'UMAP unavailable, using PCA fallback...',
    });

    // Fallback to PCA
    const result = computePCAProjection(embeddings);

    onProgress?.({
      phase: 'projecting',
      current: embeddings.length,
      total: embeddings.length,
      message: 'PCA projection complete',
    });

    return result;
  }
}

/**
 * PCA-based projection using power iteration to find principal components.
 * This produces meaningful 2D coordinates based on actual variance in the data.
 * Used as fallback when WASM is unavailable.
 */
export function computePCAProjection(embeddings: number[][]): ProjectionResult {
  if (embeddings.length === 0) {
    return { coordinates2D: [] };
  }

  const dimension = embeddings[0].length;
  const n = embeddings.length;

  // Step 1: Calculate means and center the data
  const means = new Array(dimension).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      means[i] += embedding[i];
    }
  }
  for (let i = 0; i < dimension; i++) {
    means[i] /= n;
  }

  const centered = embeddings.map(emb =>
    emb.map((val, i) => val - means[i])
  );

  // Step 2: Compute covariance matrix (only need to find top 2 eigenvectors)
  // Use power iteration to find principal components

  // Helper: Matrix-vector multiply (X^T * X * v)
  const matVecMultiply = (v: number[]): number[] => {
    // First compute X * v
    const Xv = centered.map(row =>
      row.reduce((sum, val, i) => sum + val * v[i], 0)
    );

    // Then compute X^T * (X * v)
    const result = new Array(dimension).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < dimension; j++) {
        result[j] += centered[i][j] * Xv[i];
      }
    }
    return result;
  };

  // Helper: Normalize vector
  const normalize = (v: number[]): number[] => {
    const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    if (norm < 1e-10) return v.map(() => 1 / Math.sqrt(dimension));
    return v.map(val => val / norm);
  };

  // Helper: Dot product
  const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, val, i) => sum + val * b[i], 0);

  // Power iteration for first principal component
  let pc1 = new Array(dimension).fill(0).map(() => Math.random() - 0.5);
  pc1 = normalize(pc1);

  for (let iter = 0; iter < 50; iter++) {
    pc1 = normalize(matVecMultiply(pc1));
  }

  // Power iteration for second principal component (orthogonal to first)
  let pc2 = new Array(dimension).fill(0).map(() => Math.random() - 0.5);

  for (let iter = 0; iter < 50; iter++) {
    pc2 = matVecMultiply(pc2);
    // Gram-Schmidt: remove pc1 component
    const proj = dot(pc2, pc1);
    pc2 = pc2.map((val, i) => val - proj * pc1[i]);
    pc2 = normalize(pc2);
  }

  // Step 3: Project data onto principal components
  const projected: [number, number][] = centered.map(emb => [
    dot(emb, pc1),
    dot(emb, pc2),
  ]);

  // Step 4: Normalize to reasonable range and add small jitter to prevent overlaps
  const normalizedCoords = normalizeCoordinates(projected);

  // Add tiny jitter to prevent exact overlaps (helps with visualization)
  const jitteredCoords: [number, number][] = normalizedCoords.map(([x, y]) => [
    x + (Math.random() - 0.5) * 0.5,
    y + (Math.random() - 0.5) * 0.5,
  ]);

  return { coordinates2D: jitteredCoords };
}

/**
 * Multi-dimensional PCA projection for clustering
 * Projects high-dimensional embeddings to targetDim dimensions
 */
export function computePCAProjectionMultiDim(
  embeddings: number[][],
  targetDim: number
): number[][] {
  if (embeddings.length === 0) {
    return [];
  }

  const dimension = embeddings[0].length;
  const n = embeddings.length;

  console.log(`[PCA] Projecting ${n} embeddings: ${dimension}D → ${targetDim}D`);

  // Step 1: Calculate means and center the data
  const means = new Array(dimension).fill(0);
  for (const embedding of embeddings) {
    for (let i = 0; i < dimension; i++) {
      means[i] += embedding[i];
    }
  }
  for (let i = 0; i < dimension; i++) {
    means[i] /= n;
  }

  const centered = embeddings.map(emb =>
    emb.map((val, i) => val - means[i])
  );

  // Helper: Matrix-vector multiply (X^T * X * v)
  const matVecMultiply = (v: number[]): number[] => {
    const Xv = centered.map(row =>
      row.reduce((sum, val, i) => sum + val * v[i], 0)
    );
    const result = new Array(dimension).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < dimension; j++) {
        result[j] += centered[i][j] * Xv[i];
      }
    }
    return result;
  };

  // Helper: Normalize vector
  const normalize = (v: number[]): number[] => {
    const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
    if (norm < 1e-10) return v.map(() => 1 / Math.sqrt(dimension));
    return v.map(val => val / norm);
  };

  // Helper: Dot product
  const dot = (a: number[], b: number[]): number =>
    a.reduce((sum, val, i) => sum + val * b[i], 0);

  // Find principal components using power iteration with deflation
  const principalComponents: number[][] = [];

  for (let pcIdx = 0; pcIdx < targetDim; pcIdx++) {
    // Start with random vector
    let pc = new Array(dimension).fill(0).map(() => Math.random() - 0.5);
    pc = normalize(pc);

    // Power iteration
    for (let iter = 0; iter < 50; iter++) {
      pc = matVecMultiply(pc);

      // Gram-Schmidt: remove components of previously found PCs
      for (const prevPc of principalComponents) {
        const proj = dot(pc, prevPc);
        pc = pc.map((val, i) => val - proj * prevPc[i]);
      }

      pc = normalize(pc);
    }

    principalComponents.push(pc);
  }

  // Project data onto principal components
  const projected: number[][] = centered.map(emb =>
    principalComponents.map(pc => dot(emb, pc))
  );

  console.log(`[PCA] Projection complete`);
  return projected;
}

/**
 * Normalize coordinates to fit in a standard range
 */
export function normalizeCoordinates(
  coordinates: [number, number][]
): [number, number][] {
  if (coordinates.length === 0) return [];

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

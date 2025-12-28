/**
 * K-Means clustering with silhouette scoring for optimal k selection
 *
 * Uses ml-kmeans library for K-Means implementation.
 *
 * Hybrid clustering pipeline:
 * 1. HDBSCAN discovers natural cluster count (k_estimate) on 15D UMAP
 * 2. K-Means tests k in [k_estimate - 2, k_estimate + 5] on original embeddings
 * 3. Silhouette score picks optimal k
 * 4. Final K-Means assigns 100% of points (no outliers)
 */

import { kmeans as mlKmeans } from 'ml-kmeans';

export interface KMeansResult {
  labels: number[];           // Cluster assignment per point (0 to k-1)
  centroids: number[][];      // Final centroid positions
  iterations: number;         // Iterations until convergence
}

export interface KMeansConfig {
  k: number;                  // Number of clusters
  maxIterations?: number;     // Max iterations (default: 100)
  tolerance?: number;         // Convergence threshold (default: 1e-4)
  seed?: number;             // Random seed for reproducibility
}

/**
 * L2-normalize embeddings (unit vectors)
 * After normalization, Euclidean distance ≈ cosine distance
 */
export function normalizeEmbeddings(embeddings: number[][]): number[][] {
  return embeddings.map(embedding => {
    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return embedding;
    return embedding.map(v => v / norm);
  });
}

/**
 * Euclidean distance
 */
function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Run K-Means clustering using ml-kmeans library
 *
 * @param data - Input data points (should be L2-normalized for text embeddings)
 * @param config - K-Means configuration
 * @returns Clustering result
 */
export function kmeans(data: number[][], config: KMeansConfig): KMeansResult {
  const {
    k,
    maxIterations = 100,
    tolerance = 1e-4,
    seed = Date.now()
  } = config;

  if (data.length === 0) {
    return { labels: [], centroids: [], iterations: 0 };
  }

  if (k <= 0 || k > data.length) {
    throw new Error(`Invalid k=${k} for ${data.length} data points`);
  }

  console.log(`[K-Means] Running with k=${k}, max ${maxIterations} iterations`);
  const startTime = performance.now();

  const result = mlKmeans(data, k, {
    initialization: 'kmeans++',
    maxIterations,
    tolerance,
    seed,
  });

  const elapsed = performance.now() - startTime;
  console.log(`[K-Means] Completed in ${elapsed.toFixed(0)}ms, iterations: ${result.iterations}`);

  return {
    labels: result.clusters,
    centroids: result.centroids,
    iterations: result.iterations,
  };
}

/**
 * Compute silhouette score for clustering quality
 *
 * Higher is better: -1 (worst) to +1 (best)
 *
 * For each point:
 * - a = mean distance to points in same cluster
 * - b = mean distance to points in nearest other cluster
 * - silhouette = (b - a) / max(a, b)
 *
 * @param data - Data points
 * @param labels - Cluster assignments
 * @returns Average silhouette score
 */
export function silhouetteScore(data: number[][], labels: number[]): number {
  const n = data.length;
  if (n < 2) return 0;

  // Get unique labels and their counts
  const labelSet = new Set(labels);
  const k = labelSet.size;

  if (k <= 1) return 0; // Need at least 2 clusters

  // Group points by cluster
  const clusters: Map<number, number[]> = new Map();
  for (let i = 0; i < n; i++) {
    const label = labels[i];
    if (!clusters.has(label)) {
      clusters.set(label, []);
    }
    clusters.get(label)!.push(i);
  }

  // For large datasets, sample points for efficiency
  const maxSampleSize = 1000;
  const sampleIndices = n > maxSampleSize
    ? sampleWithoutReplacement(n, maxSampleSize)
    : Array.from({ length: n }, (_, i) => i);

  // Compute silhouette for sampled points
  let totalSilhouette = 0;

  for (const i of sampleIndices) {
    const myLabel = labels[i];
    const myCluster = clusters.get(myLabel)!;

    // a = mean distance to same cluster (excluding self)
    let a = 0;
    if (myCluster.length > 1) {
      for (const j of myCluster) {
        if (j !== i) {
          a += distance(data[i], data[j]);
        }
      }
      a /= (myCluster.length - 1);
    }

    // b = mean distance to nearest other cluster
    let b = Infinity;
    for (const [label, clusterPoints] of clusters) {
      if (label === myLabel) continue;

      let meanDist = 0;
      for (const j of clusterPoints) {
        meanDist += distance(data[i], data[j]);
      }
      meanDist /= clusterPoints.length;

      if (meanDist < b) {
        b = meanDist;
      }
    }

    // Silhouette for this point
    const s = (b - a) / Math.max(a, b);
    totalSilhouette += isNaN(s) ? 0 : s;
  }

  return totalSilhouette / sampleIndices.length;
}

/**
 * Sample indices without replacement
 */
function sampleWithoutReplacement(n: number, sampleSize: number): number[] {
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, sampleSize);
}

/**
 * Find optimal k using silhouette score
 *
 * Tests k values in given range and returns k with highest silhouette
 *
 * @param data - Data points (should be L2-normalized)
 * @param kMin - Minimum k to test
 * @param kMax - Maximum k to test
 * @returns Optimal k and silhouette scores for each tested k
 */
export function findOptimalK(
  data: number[][],
  kMin: number,
  kMax: number
): { optimalK: number; scores: Map<number, number>; labels: number[] } {
  const n = data.length;

  // Clamp range to valid values
  kMin = Math.max(2, kMin);
  kMax = Math.min(Math.floor(n / 2), kMax); // k shouldn't be more than n/2

  if (kMin > kMax) {
    console.warn(`[K-Means] Invalid k range [${kMin}, ${kMax}], using k=2`);
    const result = kmeans(data, { k: 2 });
    return { optimalK: 2, scores: new Map([[2, 0]]), labels: result.labels };
  }

  console.log(`[K-Means] Testing k in range [${kMin}, ${kMax}]`);
  const startTime = performance.now();

  const scores: Map<number, number> = new Map();
  let bestK = kMin;
  let bestScore = -Infinity;
  let bestLabels: number[] = [];

  for (let k = kMin; k <= kMax; k++) {
    const result = kmeans(data, { k });
    const score = silhouetteScore(data, result.labels);

    scores.set(k, score);
    console.log(`[K-Means] k=${k}: silhouette=${score.toFixed(4)}`);

    if (score > bestScore) {
      bestScore = score;
      bestK = k;
      bestLabels = result.labels;
    }
  }

  const elapsed = performance.now() - startTime;
  console.log(`[K-Means] Optimal k=${bestK} with silhouette=${bestScore.toFixed(4)} (${elapsed.toFixed(0)}ms total)`);

  return { optimalK: bestK, scores, labels: bestLabels };
}

/**
 * Compute cluster statistics from K-Means result
 */
export function computeKMeansStats(
  labels: number[]
): { clusterCount: number; clusterSizes: Map<number, number> } {
  const clusterSizes: Map<number, number> = new Map();

  for (const label of labels) {
    clusterSizes.set(label, (clusterSizes.get(label) || 0) + 1);
  }

  return {
    clusterCount: clusterSizes.size,
    clusterSizes
  };
}

/**
 * HDBSCAN clustering for UMAP-reduced embeddings
 *
 * Two-stage UMAP approach (matching Nomic Atlas):
 * 1. UMAP projects high-D embeddings → intermediate-D (e.g., 15D) with min_dist=0.0
 * 2. HDBSCAN clusters in the intermediate space where density gradients exist
 *
 * This works because:
 * - UMAP with min_dist=0.0 creates tight, dense clusters
 * - Intermediate dimension (15D) preserves more semantic info than 2D
 * - HDBSCAN excels at finding density-based clusters in lower dimensions
 */

import { HDBSCAN } from 'hdbscan-ts';

export interface ClusterConfig {
  minClusterSize: number;  // Minimum points to form a cluster (default: 10)
  minSamples: number;      // Core point threshold (default: 5)
  nNeighbors: number;      // UMAP n_neighbors for clustering projection (default: 30)
}

export interface ClusterResult {
  labels: number[];                    // Cluster ID per point (-1 = noise/outlier)
  clusterCount: number;                // Number of clusters (excluding noise)
  noiseCount: number;                  // Points labeled as noise
  noisePercentage: number;             // Percentage of noise points
  clusterSizes: Map<number, number>;   // Cluster ID → point count
}

export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  minClusterSize: 10,  // Reasonable default for most datasets
  minSamples: 5,       // Core point threshold
  nNeighbors: 30,      // UMAP neighborhood size for clustering
};

/**
 * Cluster coordinates using HDBSCAN
 *
 * Accepts coordinates in any dimensionality (typically 15D from UMAP or 2D for re-clustering)
 *
 * @param coordinates - UMAP-projected coordinates (N-dimensional)
 * @param config - Clustering configuration
 * @returns Cluster labels and statistics
 */
export async function clusterEmbeddings(
  coordinates: number[][],
  config: ClusterConfig = DEFAULT_CLUSTER_CONFIG
): Promise<ClusterResult> {
  if (coordinates.length === 0) {
    return {
      labels: [],
      clusterCount: 0,
      noiseCount: 0,
      noisePercentage: 0,
      clusterSizes: new Map(),
    };
  }

  const dim = coordinates[0].length;
  console.log(`[Clustering] Running HDBSCAN on ${coordinates.length} points (${dim}D)`);
  console.log(`[Clustering] Config: minClusterSize=${config.minClusterSize}, minSamples=${config.minSamples}`);

  // Run HDBSCAN
  const hdbscan = new HDBSCAN({
    minClusterSize: config.minClusterSize,
    minSamples: config.minSamples,
    debugMode: false,
  });

  console.log(`[Clustering] Fitting HDBSCAN on ${dim}D coordinates...`);
  const startTime = performance.now();
  const labels = hdbscan.fit(coordinates);
  const elapsed = performance.now() - startTime;
  console.log(`[Clustering] HDBSCAN completed in ${elapsed.toFixed(0)}ms`);

  // Compute statistics
  const clusterSizes = new Map<number, number>();
  let noiseCount = 0;

  for (const label of labels) {
    if (label === -1) {
      noiseCount++;
    } else {
      clusterSizes.set(label, (clusterSizes.get(label) || 0) + 1);
    }
  }

  const clusterCount = clusterSizes.size;
  const noisePercentage = coordinates.length > 0
    ? (noiseCount / coordinates.length) * 100
    : 0;

  console.log(`[Clustering] Found ${clusterCount} clusters`);
  console.log(`[Clustering] Noise points: ${noiseCount} (${noisePercentage.toFixed(1)}%)`);

  // Log cluster sizes
  const sortedClusters = Array.from(clusterSizes.entries())
    .sort((a, b) => b[1] - a[1]);
  console.log('[Clustering] Cluster sizes:', sortedClusters.slice(0, 10).map(([id, size]) => `#${id}: ${size}`).join(', '));

  return {
    labels,
    clusterCount,
    noiseCount,
    noisePercentage,
    clusterSizes,
  };
}

/**
 * Re-cluster with new parameters
 *
 * For re-clustering, we use the 2D visualization coordinates since we don't
 * store the intermediate UMAP coordinates. This is a trade-off between storage
 * and clustering quality - visual clusters will match HDBSCAN clusters.
 */
export async function reclusterEmbeddings(
  coordinates2D: [number, number][],
  config: ClusterConfig
): Promise<ClusterResult> {
  return clusterEmbeddings(coordinates2D, config);
}

/**
 * Generate distinct colors for clusters
 * Uses a perceptually uniform color palette
 */
export function generateClusterColors(clusterCount: number): string[] {
  // Base colors - distinct and colorblind-friendly
  const baseColors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#22c55e', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#a855f7', // purple
    '#eab308', // yellow
    '#0ea5e9', // sky
    '#d946ef', // fuchsia
    '#10b981', // emerald
  ];

  const colors: string[] = [];
  for (let i = 0; i < clusterCount; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }

  return colors;
}

/**
 * Get a color for a specific cluster ID
 * Returns gray for noise points (clusterId === -1)
 */
export function getClusterColor(clusterId: number, colors: string[]): string {
  if (clusterId === -1) {
    return '#9ca3af'; // gray-400 for noise
  }
  return colors[clusterId % colors.length];
}

// ============================================================================
// DEPRECATED APPROACHES (kept for reference)
// ============================================================================
//
// 1. PCA-based clustering (original approach):
//    - Used PCA to reduce 3072D → 50D before HDBSCAN
//    - Failed due to curse of dimensionality (95%+ outliers)
//    - PCA is linear and doesn't preserve local neighborhood structure
//
// 2. Direct 2D clustering (first revision):
//    - Clustered on 2D UMAP visualization coordinates
//    - Works but loses semantic information in the 2D projection
//
// Current approach (two-stage UMAP):
//    - Stage 1: UMAP 3072D → 15D with min_dist=0.0 (for clustering)
//    - Stage 2: UMAP 3072D → 2D with min_dist=0.1 (for visualization)
//    - HDBSCAN runs on 15D intermediate space
//    - Best of both worlds: semantic clustering + clear visualization

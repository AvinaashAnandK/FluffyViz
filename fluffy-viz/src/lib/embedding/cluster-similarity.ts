/**
 * Cluster similarity utilities for exploring cluster relationships
 *
 * Usage (browser console):
 *   // First, get the layer ID from the URL or UI
 *   const layerId = 'your-layer-id';
 *
 *   // Compute similarity between two clusters
 *   await window.clusterSim.similarity(layerId, 9, 13)
 *
 *   // Find top neighbors of a cluster
 *   await window.clusterSim.neighbors(layerId, 9)
 *
 *   // Find all pairs above a threshold
 *   await window.clusterSim.findSimilar(layerId, 0.85)
 *
 *   // Get full similarity matrix (sorted)
 *   await window.clusterSim.allSimilarities(layerId)
 *
 *   // Agglomerative clustering (threshold, linkage: 'average'|'single'|'complete')
 *   await window.clusterSim.agglomerate(layerId, 0.80)                    // average linkage (default)
 *   await window.clusterSim.agglomerate(layerId, 0.80, 'single')          // single linkage
 *   await window.clusterSim.agglomerate(layerId, 0.80, 'complete')        // complete linkage
 *
 *   // Label clusters using LLM (default: gpt-5.2)
 *   await window.clusterSim.labelCluster(layerId, 9)                      // label single cluster
 *   await window.clusterSim.labelCluster(layerId, 9, { modelId: 'gpt-4o' })
 *   await window.clusterSim.labelAllClusters(layerId)                     // label all clusters
 *   await window.clusterSim.labelAllClusters(layerId, { concurrency: 5 }) // with custom concurrency
 */

import { executeQuery } from '@/lib/duckdb/client';

// Cache for computed centroids
let centroidCache: {
  layerId: string;
  centroids: Map<number, number[]>;
} | null = null;

/**
 * Compute cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (normA * normB);
}

/**
 * Compute centroid (mean embedding) for a cluster
 */
export function computeCentroid(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];

  const dim = embeddings[0].length;
  const centroid = new Array(dim).fill(0);

  for (const embedding of embeddings) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += embedding[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= embeddings.length;
  }

  return centroid;
}

interface PointRow {
  cluster_id: number;
  embedding_json: string; // JSON string of the embedding array
}

/**
 * Compute centroids for all clusters in a layer
 */
export async function computeAllCentroids(
  layerId: string
): Promise<Map<number, number[]>> {
  // Check cache
  if (centroidCache && centroidCache.layerId === layerId) {
    console.log('[Cluster Similarity] Using cached centroids');
    return centroidCache.centroids;
  }

  console.log(`[Cluster Similarity] Computing centroids for layer ${layerId}...`);

  // Query points with embeddings as JSON strings (most reliable way to get array data from DuckDB)
  const points = await executeQuery<PointRow>(`
    SELECT cluster_id, to_json(embedding)::VARCHAR as embedding_json
    FROM embedding_points
    WHERE layer_id = '${layerId.replace(/'/g, "''")}'
  `);

  if (points.length === 0) {
    throw new Error('No points found in layer');
  }

  console.log(`[Cluster Similarity] Found ${points.length} points`);

  // Debug: Check embedding format from first point
  if (points.length > 0) {
    const firstJson = points[0].embedding_json;
    console.log(`[Cluster Similarity] First embedding JSON preview: ${firstJson?.substring(0, 80)}...`);
  }

  // Group embeddings by cluster ID
  const clusterEmbeddings = new Map<number, number[][]>();

  for (const point of points) {
    const clusterId = point.cluster_id ?? -1;
    if (!clusterEmbeddings.has(clusterId)) {
      clusterEmbeddings.set(clusterId, []);
    }
    // Parse JSON string to array
    const embedding: number[] = JSON.parse(point.embedding_json);
    clusterEmbeddings.get(clusterId)!.push(embedding);
  }

  // Compute centroid for each cluster
  const centroids = new Map<number, number[]>();

  for (const [clusterId, embeddings] of clusterEmbeddings) {
    if (clusterId === -1) continue; // Skip noise cluster
    const centroid = computeCentroid(embeddings);
    centroids.set(clusterId, centroid);
  }

  // Log cluster info
  console.log(`[Cluster Similarity] Computed ${centroids.size} cluster centroids`);
  const sortedIds = Array.from(centroids.keys()).sort((a, b) => a - b);
  console.log(`[Cluster Similarity] Cluster IDs: ${sortedIds.slice(0, 10).join(', ')}${sortedIds.length > 10 ? '...' : ''}`);

  // Cache the result
  centroidCache = { layerId, centroids };

  return centroids;
}

/**
 * Compute cosine similarity between two clusters
 *
 * @param layerId - The embedding layer ID
 * @param clusterA - First cluster ID
 * @param clusterB - Second cluster ID
 * @returns Cosine similarity (-1 to 1, higher = more similar)
 */
export async function clusterSimilarity(
  layerId: string,
  clusterA: number,
  clusterB: number
): Promise<number> {
  const centroids = await computeAllCentroids(layerId);

  const centroidA = centroids.get(clusterA);
  const centroidB = centroids.get(clusterB);

  if (!centroidA) {
    throw new Error(`Cluster ${clusterA} not found`);
  }
  if (!centroidB) {
    throw new Error(`Cluster ${clusterB} not found`);
  }

  const similarity = cosineSimilarity(centroidA, centroidB);

  console.log(`\n[Cluster Similarity] Cluster ${clusterA} ↔ Cluster ${clusterB}`);
  console.log(`  Cosine similarity: ${similarity.toFixed(4)}`);
  console.log(`  Interpretation: ${interpretSimilarity(similarity)}`);

  return similarity;
}

/**
 * Human-readable interpretation of similarity score
 */
function interpretSimilarity(sim: number): string {
  if (sim >= 0.95) return 'Nearly identical - strong merge candidate';
  if (sim >= 0.90) return 'Very similar - likely merge candidate';
  if (sim >= 0.85) return 'Similar - consider merging';
  if (sim >= 0.80) return 'Moderately similar - related topics';
  if (sim >= 0.70) return 'Somewhat similar - loosely related';
  if (sim >= 0.50) return 'Weakly similar - different topics';
  return 'Dissimilar - distinct clusters';
}

/**
 * Compute pairwise similarities for all clusters
 * Returns a sorted list of cluster pairs by similarity
 */
export async function allClusterSimilarities(
  layerId: string
): Promise<Array<{ clusterA: number; clusterB: number; similarity: number }>> {
  const centroids = await computeAllCentroids(layerId);
  const clusterIds = Array.from(centroids.keys()).sort((a, b) => a - b);

  const pairs: Array<{ clusterA: number; clusterB: number; similarity: number }> = [];

  for (let i = 0; i < clusterIds.length; i++) {
    for (let j = i + 1; j < clusterIds.length; j++) {
      const clusterA = clusterIds[i];
      const clusterB = clusterIds[j];
      const similarity = cosineSimilarity(
        centroids.get(clusterA)!,
        centroids.get(clusterB)!
      );
      pairs.push({ clusterA, clusterB, similarity });
    }
  }

  // Sort by similarity descending
  pairs.sort((a, b) => b.similarity - a.similarity);

  console.log(`\n[Cluster Similarity] Pairwise similarities for ${clusterIds.length} clusters`);
  console.log(`  Total pairs: ${pairs.length}`);
  console.log('\n  Top 15 most similar pairs:');
  console.log('  ┌────────┬────────┬────────────┐');
  console.log('  │ Cl. A  │ Cl. B  │ Similarity │');
  console.log('  ├────────┼────────┼────────────┤');
  pairs.slice(0, 15).forEach(({ clusterA, clusterB, similarity }) => {
    console.log(`  │ ${String(clusterA).padStart(6)} │ ${String(clusterB).padStart(6)} │ ${similarity.toFixed(4).padStart(10)} │`);
  });
  console.log('  └────────┴────────┴────────────┘');

  return pairs;
}

/**
 * Find cluster pairs above a similarity threshold
 *
 * @param layerId - The embedding layer ID
 * @param threshold - Minimum cosine similarity (default: 0.85)
 * @returns Cluster pairs above threshold, sorted by similarity
 */
export async function findSimilarClusters(
  layerId: string,
  threshold: number = 0.85
): Promise<Array<{ clusterA: number; clusterB: number; similarity: number }>> {
  const pairs = await allClusterSimilarities(layerId);
  const similar = pairs.filter(p => p.similarity >= threshold);

  console.log(`\n[Cluster Similarity] Pairs above threshold ${threshold}: ${similar.length}`);

  if (similar.length > 0) {
    console.log('\n  Merge candidates:');
    similar.forEach(({ clusterA, clusterB, similarity }) => {
      console.log(`  • Cluster ${clusterA} + Cluster ${clusterB} (${similarity.toFixed(4)})`);
    });
  } else {
    console.log('  No pairs found above threshold. Try lowering the threshold.');
  }

  return similar;
}

/**
 * Get similarity between a cluster and all other clusters
 * Useful for finding what a specific cluster is most similar to
 */
export async function clusterNeighbors(
  layerId: string,
  clusterId: number,
  topK: number = 10
): Promise<Array<{ clusterId: number; similarity: number }>> {
  const centroids = await computeAllCentroids(layerId);
  const targetCentroid = centroids.get(clusterId);

  if (!targetCentroid) {
    throw new Error(`Cluster ${clusterId} not found`);
  }

  const neighbors: Array<{ clusterId: number; similarity: number }> = [];

  for (const [otherId, centroid] of centroids) {
    if (otherId !== clusterId) {
      const similarity = cosineSimilarity(targetCentroid, centroid);
      neighbors.push({ clusterId: otherId, similarity });
    }
  }

  neighbors.sort((a, b) => b.similarity - a.similarity);
  const topNeighbors = neighbors.slice(0, topK);

  console.log(`\n[Cluster Similarity] Top ${topK} neighbors of Cluster ${clusterId}:`);
  console.log('  ┌─────────┬────────────┬─────────────────────────────────┐');
  console.log('  │ Cluster │ Similarity │ Interpretation                  │');
  console.log('  ├─────────┼────────────┼─────────────────────────────────┤');
  topNeighbors.forEach(({ clusterId: id, similarity }) => {
    const interp = interpretSimilarity(similarity).substring(0, 31);
    console.log(`  │ ${String(id).padStart(7)} │ ${similarity.toFixed(4).padStart(10)} │ ${interp.padEnd(31)} │`);
  });
  console.log('  └─────────┴────────────┴─────────────────────────────────┘');

  return topNeighbors;
}

/**
 * Clear the centroid cache (call after re-clustering)
 */
export function clearCentroidCache(): void {
  centroidCache = null;
  console.log('[Cluster Similarity] Cache cleared');
}

// ============================================================================
// AGGLOMERATIVE CLUSTERING
// ============================================================================

interface SuperTopic {
  id: number;
  clusters: number[];  // Original cluster IDs in this super-topic
  size: number;        // Total points in super-topic
}

interface AgglomerativeResult {
  superTopics: SuperTopic[];
  totalSuperTopics: number;
  largestSuperTopicSize: number;
  largestSuperTopicClusters: number[];
  singletonCount: number;  // Super-topics with only 1 cluster
  threshold: number;
  linkage: 'average' | 'single' | 'complete';
}

export type LinkageType = 'average' | 'single' | 'complete';

/**
 * Compute average linkage similarity between two groups of clusters
 * Average of all pairwise similarities between clusters in each group
 */
function averageLinkage(
  groupA: number[],
  groupB: number[],
  centroids: Map<number, number[]>
): number {
  let totalSim = 0;
  let count = 0;

  for (const a of groupA) {
    for (const b of groupB) {
      const centroidA = centroids.get(a);
      const centroidB = centroids.get(b);
      if (centroidA && centroidB) {
        totalSim += cosineSimilarity(centroidA, centroidB);
        count++;
      }
    }
  }

  return count > 0 ? totalSim / count : 0;
}

/**
 * Compute single linkage similarity between two groups of clusters
 * Maximum similarity among all pairs (closest pair)
 */
function singleLinkage(
  groupA: number[],
  groupB: number[],
  centroids: Map<number, number[]>
): number {
  let maxSim = -Infinity;

  for (const a of groupA) {
    for (const b of groupB) {
      const centroidA = centroids.get(a);
      const centroidB = centroids.get(b);
      if (centroidA && centroidB) {
        const sim = cosineSimilarity(centroidA, centroidB);
        if (sim > maxSim) maxSim = sim;
      }
    }
  }

  return maxSim === -Infinity ? 0 : maxSim;
}

/**
 * Compute complete linkage similarity between two groups of clusters
 * Minimum similarity among all pairs (furthest pair)
 */
function completeLinkage(
  groupA: number[],
  groupB: number[],
  centroids: Map<number, number[]>
): number {
  let minSim = Infinity;

  for (const a of groupA) {
    for (const b of groupB) {
      const centroidA = centroids.get(a);
      const centroidB = centroids.get(b);
      if (centroidA && centroidB) {
        const sim = cosineSimilarity(centroidA, centroidB);
        if (sim < minSim) minSim = sim;
      }
    }
  }

  return minSim === Infinity ? 0 : minSim;
}

/**
 * Get the linkage function for a given type
 */
function getLinkageFunction(type: LinkageType) {
  switch (type) {
    case 'single': return singleLinkage;
    case 'complete': return completeLinkage;
    case 'average':
    default: return averageLinkage;
  }
}

/**
 * Agglomerative clustering with configurable linkage
 * Merges clusters into super-topics based on similarity threshold
 *
 * @param layerId - The embedding layer ID
 * @param threshold - Minimum similarity to merge (default: 0.80)
 * @param linkage - Linkage type: 'average', 'single', or 'complete' (default: 'average')
 * @returns Agglomerative clustering result with super-topics
 */
export async function agglomerativeClustering(
  layerId: string,
  threshold: number = 0.80,
  linkage: LinkageType = 'average'
): Promise<AgglomerativeResult> {
  const centroids = await computeAllCentroids(layerId);
  const clusterIds = Array.from(centroids.keys()).sort((a, b) => a - b);

  console.log(`\n[Agglomerative] Starting with ${clusterIds.length} clusters, threshold=${threshold}, linkage=${linkage}`);

  // Get the linkage function
  const linkageFn = getLinkageFunction(linkage);

  // Get cluster sizes for reporting
  const clusterSizes = new Map<number, number>();
  const points = await executeQuery<{ cluster_id: number; cnt: number }>(`
    SELECT cluster_id, COUNT(*) as cnt
    FROM embedding_points
    WHERE layer_id = '${layerId.replace(/'/g, "''")}'
    GROUP BY cluster_id
  `);
  for (const p of points) {
    clusterSizes.set(p.cluster_id, Number(p.cnt));
  }

  // Initialize: each cluster is its own group
  let groups: number[][] = clusterIds.map(id => [id]);

  // Agglomerative loop
  let mergeCount = 0;
  while (true) {
    // Find the pair of groups with highest similarity
    let bestSim = -1;
    let bestI = -1;
    let bestJ = -1;

    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        const sim = linkageFn(groups[i], groups[j], centroids);
        if (sim > bestSim) {
          bestSim = sim;
          bestI = i;
          bestJ = j;
        }
      }
    }

    // Stop if best similarity is below threshold
    if (bestSim < threshold) {
      console.log(`[Agglomerative] Stopping: best similarity ${bestSim.toFixed(4)} < threshold ${threshold}`);
      break;
    }

    // Merge the two groups
    const mergedGroup = [...groups[bestI], ...groups[bestJ]];
    console.log(`[Agglomerative] Merge #${++mergeCount}: [${groups[bestI].join(',')}] + [${groups[bestJ].join(',')}] (sim=${bestSim.toFixed(4)})`);

    // Remove old groups and add merged group
    groups = groups.filter((_, idx) => idx !== bestI && idx !== bestJ);
    groups.push(mergedGroup);
  }

  // Build super-topics with sizes
  const superTopics: SuperTopic[] = groups.map((clusters, idx) => {
    const size = clusters.reduce((sum, cid) => sum + (clusterSizes.get(cid) || 0), 0);
    return { id: idx, clusters, size };
  });

  // Sort by size descending
  superTopics.sort((a, b) => b.size - a.size);

  // Re-assign IDs after sorting
  superTopics.forEach((st, idx) => { st.id = idx; });

  const largest = superTopics[0];
  const singletonCount = superTopics.filter(st => st.clusters.length === 1).length;

  // Print results
  console.log(`\n[Agglomerative] ═══════════════════════════════════════════`);
  console.log(`[Agglomerative] RESULTS (threshold=${threshold}, linkage=${linkage})`);
  console.log(`[Agglomerative] ═══════════════════════════════════════════`);
  console.log(`[Agglomerative] Total super-topics: ${superTopics.length}`);
  console.log(`[Agglomerative] Largest super-topic: ${largest.size} points (${largest.clusters.length} clusters)`);
  console.log(`[Agglomerative] Largest clusters: [${largest.clusters.join(', ')}]`);
  console.log(`[Agglomerative] Singletons (unmerged): ${singletonCount}`);

  // Print top 10 super-topics
  console.log(`\n[Agglomerative] Top 10 Super-Topics:`);
  console.log('  ┌────────┬─────────┬──────────┬─────────────────────────────────────┐');
  console.log('  │ ST ID  │  Points │ Clusters │ Cluster IDs                         │');
  console.log('  ├────────┼─────────┼──────────┼─────────────────────────────────────┤');
  superTopics.slice(0, 10).forEach(st => {
    const clusterStr = st.clusters.slice(0, 8).join(', ') + (st.clusters.length > 8 ? '...' : '');
    console.log(`  │ ${String(st.id).padStart(6)} │ ${String(st.size).padStart(7)} │ ${String(st.clusters.length).padStart(8)} │ ${clusterStr.padEnd(35)} │`);
  });
  console.log('  └────────┴─────────┴──────────┴─────────────────────────────────────┘');

  return {
    superTopics,
    totalSuperTopics: superTopics.length,
    largestSuperTopicSize: largest.size,
    largestSuperTopicClusters: largest.clusters,
    singletonCount,
    threshold,
    linkage,
  };
}

// ============================================================================
// CLUSTER LABELING (LLM-based)
// ============================================================================

export interface ClusterSample {
  user_message: string;
  assistant_message: string;
}

export interface ClusterLabel {
  clusterId: number;
  title: string;
  labels: string[];
  description: string;
}

// Cache for cluster labels
const labelCache: Map<string, ClusterLabel> = new Map();

/**
 * Sample conversations from a cluster for labeling
 * Extracts user/assistant turns from composed_text
 *
 * @param layerId - The embedding layer ID
 * @param clusterId - The cluster ID to sample from
 * @param sampleSize - Number of samples to retrieve (default: 5)
 * @returns Array of conversation samples
 */
export async function sampleCluster(
  layerId: string,
  clusterId: number,
  sampleSize: number = 5
): Promise<ClusterSample[]> {
  // Query composed_text from the cluster
  const points = await executeQuery<{ composed_text: string }>(`
    SELECT composed_text
    FROM embedding_points
    WHERE layer_id = '${layerId.replace(/'/g, "''")}'
      AND cluster_id = ${clusterId}
    ORDER BY RANDOM()
    LIMIT ${sampleSize}
  `);

  if (points.length === 0) {
    console.warn(`[Cluster Label] No points found in cluster ${clusterId}`);
    return [];
  }

  // Parse composed_text into user/assistant messages
  // Assumes format like "User: ...\nAssistant: ..." or similar
  const samples: ClusterSample[] = points.map(p => {
    const text = p.composed_text || '';

    // Try to extract user and assistant parts
    // Common patterns:
    // 1. "User: ... Assistant: ..."
    // 2. "Human: ... Assistant: ..."
    // 3. Just the raw text (use as user message)

    let userMessage = '';
    let assistantMessage = '';

    // Pattern 1: User/Assistant format
    const userMatch = text.match(/(?:User|Human|user|human):\s*([\s\S]*?)(?=(?:Assistant|assistant|AI|Bot):|$)/i);
    const assistantMatch = text.match(/(?:Assistant|assistant|AI|Bot):\s*([\s\S]*?)$/i);

    if (userMatch && userMatch[1]) {
      userMessage = userMatch[1].trim();
    }
    if (assistantMatch && assistantMatch[1]) {
      assistantMessage = assistantMatch[1].trim();
    }

    // Fallback: if no clear pattern, use whole text as user message
    if (!userMessage && !assistantMessage) {
      // Split by newlines and use first part as user, rest as assistant
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        userMessage = lines[0].trim();
        assistantMessage = lines.slice(1).join('\n').trim();
      } else {
        userMessage = text.trim();
        assistantMessage = '(response not available)';
      }
    }

    // Truncate long messages
    const maxLen = 500;
    if (userMessage.length > maxLen) {
      userMessage = userMessage.substring(0, maxLen) + '...';
    }
    if (assistantMessage.length > maxLen) {
      assistantMessage = assistantMessage.substring(0, maxLen) + '...';
    }

    return { user_message: userMessage, assistant_message: assistantMessage };
  });

  return samples;
}

/**
 * Label a single cluster using LLM
 *
 * @param layerId - The embedding layer ID
 * @param clusterId - The cluster ID to label
 * @param options - Optional configuration
 * @returns Cluster label with title, labels, and description
 */
export async function labelCluster(
  layerId: string,
  clusterId: number,
  options: {
    sampleSize?: number;
    providerId?: string;
    modelId?: string;
    useCache?: boolean;
  } = {}
): Promise<ClusterLabel> {
  const {
    sampleSize = 5,
    providerId = 'openai',
    modelId = 'gpt-5.2',
    useCache = true,
  } = options;

  // Check cache
  const cacheKey = `${layerId}:${clusterId}`;
  if (useCache && labelCache.has(cacheKey)) {
    console.log(`[Cluster Label] Using cached label for cluster ${clusterId}`);
    return labelCache.get(cacheKey)!;
  }

  console.log(`\n[Cluster Label] Labeling cluster ${clusterId}...`);
  console.log(`[Cluster Label] Sampling ${sampleSize} conversations...`);

  // Get samples
  const samples = await sampleCluster(layerId, clusterId, sampleSize);

  if (samples.length === 0) {
    throw new Error(`No samples found for cluster ${clusterId}`);
  }

  console.log(`[Cluster Label] Got ${samples.length} samples, calling LLM (${providerId}/${modelId})...`);

  // Call the API
  const response = await fetch('/api/cluster-label', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clusterId,
      samples,
      providerId,
      modelId,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const result: ClusterLabel = await response.json();

  // Cache the result
  labelCache.set(cacheKey, result);

  // Print the result
  console.log(`\n[Cluster Label] ═══════════════════════════════════════════`);
  console.log(`[Cluster Label] CLUSTER ${clusterId}`);
  console.log(`[Cluster Label] ═══════════════════════════════════════════`);
  console.log(`[Cluster Label] Title: ${result.title}`);
  console.log(`[Cluster Label] Labels: [${result.labels.join(', ')}]`);
  console.log(`[Cluster Label] Description: ${result.description}`);

  return result;
}

/**
 * Label all clusters in a layer
 *
 * @param layerId - The embedding layer ID
 * @param options - Optional configuration
 * @returns Map of cluster ID to label
 */
export async function labelAllClusters(
  layerId: string,
  options: {
    sampleSize?: number;
    providerId?: string;
    modelId?: string;
    useCache?: boolean;
    concurrency?: number;  // Max concurrent requests (default: 3)
  } = {}
): Promise<Map<number, ClusterLabel>> {
  const { concurrency = 3, ...labelOptions } = options;

  // Get all cluster IDs
  const centroids = await computeAllCentroids(layerId);
  const clusterIds = Array.from(centroids.keys()).sort((a, b) => a - b);

  console.log(`\n[Cluster Label] Labeling ${clusterIds.length} clusters...`);
  console.log(`[Cluster Label] Concurrency: ${concurrency}`);

  const results = new Map<number, ClusterLabel>();
  const errors: Array<{ clusterId: number; error: string }> = [];

  // Process in batches for concurrency control
  for (let i = 0; i < clusterIds.length; i += concurrency) {
    const batch = clusterIds.slice(i, i + concurrency);
    console.log(`\n[Cluster Label] Batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(clusterIds.length / concurrency)}: clusters [${batch.join(', ')}]`);

    const batchResults = await Promise.allSettled(
      batch.map(clusterId => labelCluster(layerId, clusterId, labelOptions))
    );

    batchResults.forEach((result, idx) => {
      const clusterId = batch[idx];
      if (result.status === 'fulfilled') {
        results.set(clusterId, result.value);
      } else {
        errors.push({ clusterId, error: result.reason?.message || 'Unknown error' });
        console.error(`[Cluster Label] Failed to label cluster ${clusterId}:`, result.reason);
      }
    });

    // Small delay between batches to avoid rate limits
    if (i + concurrency < clusterIds.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Print summary
  console.log(`\n[Cluster Label] ═══════════════════════════════════════════`);
  console.log(`[Cluster Label] SUMMARY`);
  console.log(`[Cluster Label] ═══════════════════════════════════════════`);
  console.log(`[Cluster Label] Total clusters: ${clusterIds.length}`);
  console.log(`[Cluster Label] Labeled: ${results.size}`);
  console.log(`[Cluster Label] Errors: ${errors.length}`);

  if (errors.length > 0) {
    console.log(`\n[Cluster Label] Failed clusters:`);
    errors.forEach(({ clusterId, error }) => {
      console.log(`  • Cluster ${clusterId}: ${error}`);
    });
  }

  // Print all labels as a table
  console.log(`\n[Cluster Label] All Labels:`);
  console.log('  ┌─────────┬────────────────────────────────────────────────────────────┐');
  console.log('  │ Cluster │ Title                                                      │');
  console.log('  ├─────────┼────────────────────────────────────────────────────────────┤');
  for (const [clusterId, label] of results) {
    console.log(`  │ ${String(clusterId).padStart(7)} │ ${label.title.padEnd(58)} │`);
  }
  console.log('  └─────────┴────────────────────────────────────────────────────────────┘');

  return results;
}

/**
 * Clear the label cache
 */
export function clearLabelCache(): void {
  labelCache.clear();
  console.log('[Cluster Label] Label cache cleared');
}

/**
 * Get all cached labels
 */
export function getCachedLabels(): Map<string, ClusterLabel> {
  return new Map(labelCache);
}

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).clusterSim = {
    // Similarity tools
    similarity: clusterSimilarity,
    allSimilarities: allClusterSimilarities,
    findSimilar: findSimilarClusters,
    neighbors: clusterNeighbors,
    clearCache: clearCentroidCache,
    // Agglomerative clustering
    agglomerate: agglomerativeClustering,
    // Cluster labeling
    sampleCluster,
    labelCluster,
    labelAllClusters,
    clearLabelCache,
    getCachedLabels,
  };
  console.log('[Cluster Similarity] Browser tools loaded. Usage:');
  console.log('  await clusterSim.similarity(layerId, 9, 13)');
  console.log('  await clusterSim.neighbors(layerId, 9)');
  console.log('  await clusterSim.findSimilar(layerId, 0.85)');
  console.log('  await clusterSim.agglomerate(layerId, 0.80)                   // average linkage');
  console.log('  await clusterSim.agglomerate(layerId, 0.80, "single")         // single linkage');
  console.log('  await clusterSim.agglomerate(layerId, 0.80, "complete")       // complete linkage');
  console.log('  await clusterSim.labelCluster(layerId, 9)                     // label single cluster');
  console.log('  await clusterSim.labelAllClusters(layerId)                    // label all clusters');
}

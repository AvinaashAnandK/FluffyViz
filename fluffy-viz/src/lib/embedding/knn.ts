/**
 * K-Nearest Neighbors computation for embedding points
 * Used for enabling fast nearest neighbor search in embedding-atlas
 */

export interface NeighborData {
  ids: string[];
  distances: number[];
}

/**
 * Compute cosine distance between two vectors
 */
function cosineDistance(a: number[], b: number[]): number {
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

  if (normA === 0 || normB === 0) return 1;

  // Cosine similarity to distance: 1 - similarity
  return 1 - (dotProduct / (normA * normB));
}

/**
 * Compute k-nearest neighbors for all points
 * Uses brute-force approach which is acceptable for typical dataset sizes (<10k points)
 *
 * @param pointIds - Array of point IDs
 * @param embeddings - 2D array of embeddings (one per point)
 * @param k - Number of neighbors to find (default: 10)
 * @returns Map of point ID to neighbor data
 */
export function computeKNN(
  pointIds: string[],
  embeddings: number[][],
  k: number = 10
): Map<string, NeighborData> {
  const n = pointIds.length;
  const result = new Map<string, NeighborData>();

  // Ensure k doesn't exceed available points
  const effectiveK = Math.min(k, n - 1);

  if (effectiveK <= 0) {
    // No neighbors to compute
    for (const id of pointIds) {
      result.set(id, { ids: [], distances: [] });
    }
    return result;
  }

  console.log(`[KNN] Computing ${effectiveK}-nearest neighbors for ${n} points...`);

  for (let i = 0; i < n; i++) {
    const distances: { id: string; distance: number }[] = [];

    // Compute distance to all other points
    for (let j = 0; j < n; j++) {
      if (i === j) continue;

      const dist = cosineDistance(embeddings[i], embeddings[j]);
      distances.push({ id: pointIds[j], distance: dist });
    }

    // Sort by distance and take top k
    distances.sort((a, b) => a.distance - b.distance);
    const topK = distances.slice(0, effectiveK);

    result.set(pointIds[i], {
      ids: topK.map(d => d.id),
      distances: topK.map(d => d.distance),
    });

    // Log progress periodically
    if ((i + 1) % 100 === 0) {
      console.log(`[KNN] Processed ${i + 1}/${n} points`);
    }
  }

  console.log(`[KNN] ✓ Computed neighbors for ${n} points`);
  return result;
}

/**
 * Convert neighbor data to JSON string for storage
 */
export function serializeNeighbors(neighbors: NeighborData): string {
  return JSON.stringify(neighbors);
}

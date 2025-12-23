/**
 * Storage layer for embedding system
 * Uses DuckDB for persistent storage of embedding layers and points
 */

import { getConnection, executeQuery } from '@/lib/duckdb/client';
import type { ActiveEmbeddingLayer, EmbeddingLayerMetadata, EmbeddingPoint } from '@/types/embedding';
import { deleteClusteringCoordinates } from './clustering-coords-storage';

/**
 * Helper function to format values for SQL
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'string') {
    return `'${value.replace(/'/g, "''")}'`;
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return `[${value.join(',')}]`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * DuckDB-based embedding storage
 * Replaces IndexedDB + OPFS with SQL-based storage
 */
export class EmbeddingStorage {
  /**
   * Save embedding layer with all points
   * Uses transaction to ensure atomicity
   */
  async saveLayer(layer: ActiveEmbeddingLayer): Promise<void> {
    console.log(`[Embedding Storage] Saving layer ${layer.id} with ${layer.points.length} points`);

    const conn = await getConnection();

    try {
      // Start transaction
      await conn.query('BEGIN TRANSACTION');

      // 1. Insert or replace layer metadata
      const compositionConfigJson = formatValue(JSON.stringify(layer.compositionConfig));
      const clusterConfigJson = layer.clusterConfig ? formatValue(JSON.stringify(layer.clusterConfig)) : 'NULL';
      const clusterStatsJson = layer.clusterStats ? formatValue(JSON.stringify(layer.clusterStats)) : 'NULL';
      await conn.query(`
        INSERT OR REPLACE INTO embedding_layers (
          id, file_id, name, provider, model, dimension,
          composition_mode, composition_config,
          cluster_config, cluster_stats,
          created_at, last_accessed_at, is_active
        ) VALUES (
          ${formatValue(layer.id)},
          ${formatValue(layer.fileId)},
          ${formatValue(layer.name)},
          ${formatValue(layer.provider)},
          ${formatValue(layer.model)},
          ${layer.dimension},
          ${formatValue(layer.compositionMode)},
          ${compositionConfigJson},
          ${clusterConfigJson},
          ${clusterStatsJson},
          ${formatValue(layer.createdAt)},
          ${formatValue(layer.lastAccessedAt)},
          TRUE
        )
      `);

      // 2. Delete existing points for this layer (if any)
      await conn.query(`
        DELETE FROM embedding_points WHERE layer_id = ${formatValue(layer.id)}
      `);

      // 3. Insert points in batches
      const batchSize = 1000;
      for (let i = 0; i < layer.points.length; i += batchSize) {
        const batch = layer.points.slice(i, i + batchSize);

        // Build VALUES clause for batch insert
        const values = batch.map(p => {
          const embedding = formatValue(p.embedding);
          const coordinates2d = formatValue(p.coordinates2D);
          const sourceRowIndices = formatValue(p.sourceRowIndices);
          const composedText = formatValue(p.composedText);
          const label = p.label ? formatValue(p.label) : 'NULL';
          const neighbors = p.neighbors ? formatValue(JSON.stringify(p.neighbors)) : 'NULL';
          const clusterId = p.clusterId ?? -1;

          return `(${formatValue(layer.id)}, ${formatValue(p.id)}, ${embedding}, ${coordinates2d}, ${composedText}, ${label}, ${sourceRowIndices}, ${neighbors}, ${clusterId})`;
        }).join(',\n');

        await conn.query(`
          INSERT INTO embedding_points (
            layer_id, point_id, embedding, coordinates_2d,
            composed_text, label, source_row_indices, neighbors, cluster_id
          ) VALUES ${values}
        `);

        if (i % 5000 === 0 && i > 0) {
          console.log(`[Embedding Storage] Inserted ${i}/${layer.points.length} points`);
        }
      }

      // 4. Mark all other layers for this file as inactive
      await conn.query(`
        UPDATE embedding_layers
        SET is_active = FALSE
        WHERE file_id = ${formatValue(layer.fileId)} AND id != ${formatValue(layer.id)}
      `);

      await conn.query('COMMIT');
      console.log(`[Embedding Storage] ✓ Layer ${layer.id} saved successfully`);

    } catch (error) {
      await conn.query('ROLLBACK');
      console.error('[Embedding Storage] Error saving layer:', error);
      throw error;
    } finally {
      await conn.close();
    }
  }

  /**
   * Get active embedding layer for a file
   * Returns null if no active layer exists
   */
  async getActiveLayer(fileId: string): Promise<ActiveEmbeddingLayer | null> {
    console.log(`[Embedding Storage] Getting active layer for file ${fileId}`);

    try {
      // Get layer metadata
      const layers = await executeQuery<any>(`
        SELECT *
        FROM embedding_layers
        WHERE file_id = ${formatValue(fileId)} AND is_active = TRUE
        LIMIT 1
      `);

      if (layers.length === 0) {
        console.log('[Embedding Storage] No active layer found');
        return null;
      }

      const layerMeta = layers[0];

      // Get points for this layer
      const points = await executeQuery<any>(`
        SELECT *
        FROM embedding_points
        WHERE layer_id = ${formatValue(layerMeta.id)}
        ORDER BY point_id
      `);

      console.log(`[Embedding Storage] ✓ Loaded layer ${layerMeta.id} with ${points.length} points`);

      // Transform database rows to ActiveEmbeddingLayer
      return {
        id: layerMeta.id,
        fileId: layerMeta.file_id,
        name: layerMeta.name,
        provider: layerMeta.provider,
        model: layerMeta.model,
        dimension: layerMeta.dimension,
        compositionMode: layerMeta.composition_mode,
        compositionConfig: JSON.parse(layerMeta.composition_config),
        clusterConfig: layerMeta.cluster_config ? JSON.parse(layerMeta.cluster_config) : undefined,
        clusterStats: layerMeta.cluster_stats ? JSON.parse(layerMeta.cluster_stats) : undefined,
        points: points.map(p => ({
          id: p.point_id,
          embedding: p.embedding,
          coordinates2D: p.coordinates_2d,
          composedText: p.composed_text,
          label: p.label,
          sourceRowIndices: p.source_row_indices,
          clusterId: p.cluster_id ?? -1,
        } as EmbeddingPoint)),
        createdAt: layerMeta.created_at,
        lastAccessedAt: layerMeta.last_accessed_at
      };

    } catch (error) {
      console.error('[Embedding Storage] Error getting active layer:', error);
      throw error;
    }
  }

  /**
   * Get all embedding layer metadata for a file
   * Returns metadata only (no points)
   */
  async getLayerMetadata(fileId: string): Promise<EmbeddingLayerMetadata[]> {
    console.log(`[Embedding Storage] Getting layer metadata for file ${fileId}`);

    try {
      const layers = await executeQuery<any>(`
        SELECT
          l.id,
          l.name,
          l.is_active,
          l.composition_mode,
          l.created_at,
          COUNT(p.point_id) as point_count
        FROM embedding_layers l
        LEFT JOIN embedding_points p ON l.id = p.layer_id
        WHERE l.file_id = ${formatValue(fileId)}
        GROUP BY l.id, l.name, l.is_active, l.composition_mode, l.created_at
        ORDER BY l.created_at DESC
      `);

      console.log(`[Embedding Storage] ✓ Found ${layers.length} layers`);

      return layers.map(l => ({
        id: l.id,
        name: l.name,
        isActive: l.is_active,
        pointCount: typeof l.point_count === 'bigint' ? Number(l.point_count) : l.point_count,
        compositionMode: l.composition_mode,
        createdAt: l.created_at
      } as EmbeddingLayerMetadata));

    } catch (error) {
      console.error('[Embedding Storage] Error getting layer metadata:', error);
      throw error;
    }
  }

  /**
   * Switch active layer for a file
   * Simple UPDATE query - no file system operations needed
   */
  async setActiveLayer(fileId: string, layerId: string): Promise<void> {
    console.log(`[Embedding Storage] Setting active layer to ${layerId}`);

    try {
      await executeQuery(`
        UPDATE embedding_layers
        SET is_active = CASE WHEN id = ${formatValue(layerId)} THEN TRUE ELSE FALSE END,
            last_accessed_at = CASE WHEN id = ${formatValue(layerId)} THEN CURRENT_TIMESTAMP ELSE last_accessed_at END
        WHERE file_id = ${formatValue(fileId)}
      `);

      console.log('[Embedding Storage] ✓ Active layer updated');

    } catch (error) {
      console.error('[Embedding Storage] Error setting active layer:', error);
      throw error;
    }
  }

  /**
   * Delete embedding layer and all its points
   * Cascades to delete all associated points and OPFS clustering coordinates
   */
  async deleteLayer(layerId: string): Promise<void> {
    console.log(`[Embedding Storage] Deleting layer ${layerId}`);

    const conn = await getConnection();

    try {
      await conn.query('BEGIN TRANSACTION');

      // Delete points first
      await conn.query(`
        DELETE FROM embedding_points WHERE layer_id = ${formatValue(layerId)}
      `);

      // Delete layer metadata
      await conn.query(`
        DELETE FROM embedding_layers WHERE id = ${formatValue(layerId)}
      `);

      await conn.query('COMMIT');

      // Delete clustering coordinates from OPFS (outside transaction, non-critical)
      try {
        await deleteClusteringCoordinates(layerId);
      } catch (opfsError) {
        console.warn('[Embedding Storage] Failed to delete OPFS clustering coords:', opfsError);
      }

      console.log('[Embedding Storage] ✓ Layer deleted');

    } catch (error) {
      await conn.query('ROLLBACK');
      console.error('[Embedding Storage] Error deleting layer:', error);
      throw error;
    } finally {
      await conn.close();
    }
  }
}

// Export singleton instance
export const embeddingStorage = new EmbeddingStorage();

// Generate unique ID for embedding layers
export function generateEmbeddingId(): string {
  return `emb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reserved column names that conflict with embedding layer table columns.
 * These will be prefixed with "original_" if they exist in file_data.
 */
const RESERVED_COLUMNS = ['point_id', 'x', 'y', 'composed_text', 'layer_id', 'cluster'];

/**
 * Create an embedding layer table that JOINs embedding points with file data.
 * This table is required by EmbeddingAtlas because it uses ALTER TABLE + UPDATE
 * to create derived category columns for color encoding.
 *
 * @param layerId - The embedding layer ID
 * @param fileId - The file ID to join with
 * @returns The table name created
 */
export async function createLayerTable(layerId: string, fileId: string): Promise<string> {
  const tableName = `embedding_layer_${layerId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const fileTableName = `file_data_${fileId}`;

  console.log(`[Embedding Storage] Creating layer table ${tableName} for file ${fileId}`);

  try {
    // Check if table already exists (handles React Strict Mode double-render race condition)
    const existingTable = await executeQuery<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = '${tableName}'
      LIMIT 1
    `);

    if (existingTable.length > 0) {
      console.log(`[Embedding Storage] Layer table ${tableName} already exists, reusing`);
      return tableName;
    }

    // Get columns from file_data table
    const fileColumnsResult = await executeQuery<{ column_name: string; data_type: string }>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = '${fileTableName}'
      ORDER BY ordinal_position
    `);

    if (fileColumnsResult.length === 0) {
      throw new Error(`File data table ${fileTableName} not found`);
    }

    // Get column metadata to resolve column IDs to human-readable names
    const columnMetadataResult = await executeQuery<{ column_id: string; column_name: string | null }>(`
      SELECT column_id, column_name
      FROM column_metadata
      WHERE file_id = '${fileId}'
    `);

    // Build a map of column_id -> column_name
    const columnNameMap = new Map<string, string>();
    for (const meta of columnMetadataResult) {
      if (meta.column_name) {
        columnNameMap.set(meta.column_id, meta.column_name);
      }
    }

    // Build safe column list, resolving IDs to names and handling collisions
    const safeFileDataColumns = fileColumnsResult
      .map(col => {
        const colId = col.column_name;

        // Skip row_index - we'll reference it but not alias it differently
        if (colId === 'row_index') {
          return `fd."row_index"`;
        }

        // Check if this column has a human-readable name in metadata
        const humanName = columnNameMap.get(colId);

        // Determine the display name (prefer human name, fallback to ID)
        const displayName = humanName || colId;

        // Handle collisions with reserved embedding columns
        if (RESERVED_COLUMNS.includes(displayName.toLowerCase())) {
          return `fd."${colId}" AS "original_${displayName}"`;
        }

        // If we have a human-readable name different from column ID, use alias
        if (humanName && humanName !== colId) {
          return `fd."${colId}" AS "${humanName}"`;
        }

        return `fd."${colId}"`;
      })
      .join(',\n    ');

    // Create layer table with JOIN using CREATE TABLE IF NOT EXISTS pattern
    // Note: We join on source_row_indices[1] because for 1:1 modes (single/multi),
    // there's exactly one source row per embedding point
    // Note: cluster_id is cast to VARCHAR and labeled for categorical coloring in embedding-atlas
    const createSQL = `
      CREATE TABLE "${tableName}" AS
      SELECT
        ep.point_id,
        ep.coordinates_2d[1] AS x,
        ep.coordinates_2d[2] AS y,
        ep.composed_text,
        ep.neighbors,
        CASE
          WHEN ep.cluster_id = -1 THEN 'Noise'
          ELSE 'Cluster ' || CAST(ep.cluster_id AS VARCHAR)
        END AS cluster,
        ${safeFileDataColumns}
      FROM embedding_points ep
      JOIN "${fileTableName}" fd
        ON fd.row_index = ep.source_row_indices[1]
      WHERE ep.layer_id = '${layerId}'
    `;

    await executeQuery(createSQL);

    // Verify table was created with expected row count
    const countResult = await executeQuery<{ count: number | bigint }>(`
      SELECT COUNT(*) as count FROM "${tableName}"
    `);
    const rowCount = typeof countResult[0]?.count === 'bigint'
      ? Number(countResult[0].count)
      : countResult[0]?.count ?? 0;

    console.log(`[Embedding Storage] ✓ Layer table ${tableName} created with ${rowCount} rows`);

    return tableName;

  } catch (error) {
    // Handle race condition: multiple concurrent calls may try to create the same table
    // This happens in React Strict Mode (dev) or during rapid re-renders
    // DuckDB error format: "Catalog Error: Table with name "..." already exists!"
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isAlreadyExistsError =
      errorMessage.includes('already exists') &&
      errorMessage.includes('Catalog Error');

    if (isAlreadyExistsError) {
      console.log(`[Embedding Storage] Layer table ${tableName} created by concurrent call, reusing`);
      return tableName;
    }

    // Re-throw genuine errors
    console.error('[Embedding Storage] Error creating layer table:', error);
    throw error;
  }
}

/**
 * Get the layer table name for a given layer ID.
 * Does not verify if the table exists.
 */
export function getLayerTableName(layerId: string): string {
  return `embedding_layer_${layerId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

/**
 * Drop the layer table for a given layer ID.
 * Called when deleting an embedding layer.
 */
export async function dropLayerTable(layerId: string): Promise<void> {
  const tableName = getLayerTableName(layerId);

  try {
    await executeQuery(`DROP TABLE IF EXISTS "${tableName}"`);
    console.log(`[Embedding Storage] ✓ Layer table ${tableName} dropped`);
  } catch (error) {
    console.error('[Embedding Storage] Error dropping layer table:', error);
    // Don't throw - this is cleanup, failure is acceptable
  }
}

/**
 * Get all columns available in a layer table.
 * Useful for building search queries and UI selectors.
 */
export async function getLayerTableColumns(layerId: string): Promise<string[]> {
  const tableName = getLayerTableName(layerId);

  try {
    const result = await executeQuery<{ column_name: string }>(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

    return result.map(r => r.column_name);
  } catch (error) {
    console.error('[Embedding Storage] Error getting layer table columns:', error);
    return [];
  }
}

/**
 * Update cluster assignments for a layer.
 * Used when re-clustering with different parameters.
 */
export async function updateClusterAssignments(
  layerId: string,
  clusterLabels: number[],
  pointIds: string[]
): Promise<void> {
  console.log(`[Embedding Storage] Updating cluster assignments for layer ${layerId}`);

  const conn = await getConnection();

  try {
    await conn.query('BEGIN TRANSACTION');

    // Update cluster_id for each point
    for (let i = 0; i < pointIds.length; i++) {
      await conn.query(`
        UPDATE embedding_points
        SET cluster_id = ${clusterLabels[i]}
        WHERE layer_id = ${formatValue(layerId)} AND point_id = ${formatValue(pointIds[i])}
      `);
    }

    await conn.query('COMMIT');
    console.log(`[Embedding Storage] ✓ Updated cluster assignments for ${pointIds.length} points`);

  } catch (error) {
    await conn.query('ROLLBACK');
    console.error('[Embedding Storage] Error updating cluster assignments:', error);
    throw error;
  } finally {
    await conn.close();
  }
}

/**
 * Update cluster config and stats for a layer.
 */
export async function updateClusterMetadata(
  layerId: string,
  clusterConfig: { minClusterSize: number; minSamples: number },
  clusterStats: { clusterCount: number; noiseCount: number; noisePercentage: number; clusterSizes: Record<number, number> }
): Promise<void> {
  console.log(`[Embedding Storage] Updating cluster metadata for layer ${layerId}`);

  try {
    await executeQuery(`
      UPDATE embedding_layers
      SET cluster_config = ${formatValue(JSON.stringify(clusterConfig))},
          cluster_stats = ${formatValue(JSON.stringify(clusterStats))}
      WHERE id = ${formatValue(layerId)}
    `);

    console.log('[Embedding Storage] ✓ Cluster metadata updated');
  } catch (error) {
    console.error('[Embedding Storage] Error updating cluster metadata:', error);
    throw error;
  }
}

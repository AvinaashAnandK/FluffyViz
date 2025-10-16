/**
 * Storage layer for embedding system
 * Uses DuckDB for persistent storage of embedding layers and points
 */

import { getConnection, executeQuery } from '@/lib/duckdb/client';
import type { ActiveEmbeddingLayer, EmbeddingLayerMetadata, EmbeddingPoint } from '@/types/embedding';

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
      await conn.query(`
        INSERT OR REPLACE INTO embedding_layers (
          id, file_id, name, provider, model, dimension,
          composition_mode, composition_config,
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

          return `(${formatValue(layer.id)}, ${formatValue(p.id)}, ${embedding}, ${coordinates2d}, ${composedText}, ${label}, ${sourceRowIndices})`;
        }).join(',\n');

        await conn.query(`
          INSERT INTO embedding_points (
            layer_id, point_id, embedding, coordinates_2d,
            composed_text, label, source_row_indices
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
        points: points.map(p => ({
          id: p.point_id,
          embedding: p.embedding,
          coordinates2D: p.coordinates_2d,
          composedText: p.composed_text,
          label: p.label,
          sourceRowIndices: p.source_row_indices
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
   * Cascades to delete all associated points
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

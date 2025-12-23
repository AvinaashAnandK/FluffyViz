/**
 * Database schema definitions and initialization
 *
 * Defines the FluffyViz database schema with tables for:
 * - files: File metadata
 * - file_data_{id}: Dynamic tables for parsed file data
 * - embedding_layers: Embedding layer metadata
 * - embedding_points: Embedding vector data
 */

import { executeQuery, persistDatabase } from './client';

/**
 * Initialize the database schema
 * Creates all required tables if they don't exist
 */
export async function initializeSchema(): Promise<void> {
  console.log('[DuckDB Schema] Initializing database schema...');

  try {
    // Create files table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        last_modified TIMESTAMP NOT NULL,
        size INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      )
    `);
    console.log('[DuckDB Schema] ✓ Files table created');

    // Create embedding_layers table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS embedding_layers (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        composition_mode TEXT NOT NULL,
        composition_config JSON NOT NULL,
        created_at TIMESTAMP NOT NULL,
        last_accessed_at TIMESTAMP NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    console.log('[DuckDB Schema] ✓ Embedding layers table created');

    // Create embedding_points table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS embedding_points (
        layer_id TEXT NOT NULL,
        point_id TEXT NOT NULL,
        embedding DOUBLE[],
        coordinates_2d DOUBLE[2],
        composed_text TEXT,
        label TEXT,
        source_row_indices INTEGER[],
        neighbors JSON,
        cluster_id INTEGER DEFAULT -1,
        PRIMARY KEY (layer_id, point_id)
      )
    `);
    console.log('[DuckDB Schema] ✓ Embedding points table created');

    // Migration: Add neighbors column if it doesn't exist
    try {
      const neighborsColumn = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'embedding_points'
          AND column_name = 'neighbors'
      `);

      if (neighborsColumn.length === 0) {
        await executeQuery(`ALTER TABLE embedding_points ADD COLUMN neighbors JSON`);
        console.log('[DuckDB Schema] ✓ Neighbors column migration completed');
      }
    } catch (error) {
      console.warn('[DuckDB Schema] Neighbors column migration error:', error);
    }

    // Migration: Add cluster_id column to embedding_points if it doesn't exist
    try {
      const clusterIdColumn = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'embedding_points'
          AND column_name = 'cluster_id'
      `);

      if (clusterIdColumn.length === 0) {
        await executeQuery(`ALTER TABLE embedding_points ADD COLUMN cluster_id INTEGER DEFAULT -1`);
        console.log('[DuckDB Schema] ✓ Cluster ID column migration completed');
      }
    } catch (error) {
      console.warn('[DuckDB Schema] Cluster ID column migration error:', error);
    }

    // Migration: Add cluster_config and cluster_stats columns to embedding_layers if they don't exist
    try {
      const clusterConfigColumn = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'embedding_layers'
          AND column_name = 'cluster_config'
      `);

      if (clusterConfigColumn.length === 0) {
        await executeQuery(`ALTER TABLE embedding_layers ADD COLUMN cluster_config JSON`);
        await executeQuery(`ALTER TABLE embedding_layers ADD COLUMN cluster_stats JSON`);
        console.log('[DuckDB Schema] ✓ Cluster config/stats columns migration completed');
      }
    } catch (error) {
      console.warn('[DuckDB Schema] Cluster config/stats columns migration error:', error);
    }

    // Create column_metadata table for AI column configuration
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS column_metadata (
        file_id TEXT NOT NULL,
        column_id TEXT NOT NULL,
        column_name TEXT,
        column_type TEXT NOT NULL,
        model TEXT,
        provider TEXT,
        prompt TEXT,
        created_at BIGINT,
        output_schema TEXT,
        web_search_enabled BOOLEAN DEFAULT FALSE,
        web_search_config TEXT,
        temperature DOUBLE,
        max_tokens INTEGER,
        width INTEGER DEFAULT 200,
        PRIMARY KEY (file_id, column_id)
      )
    `);
    console.log('[DuckDB Schema] ✓ Column metadata table created');

    // Migration: Add column_name if it doesn't exist (for existing databases)
    try {
      // Check if column_name exists
      const columns = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'column_metadata'
          AND column_name = 'column_name'
      `);

      if (columns.length === 0) {
        // Column doesn't exist, add it
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN column_name TEXT`);
        console.log('[DuckDB Schema] ✓ Column name migration completed');
      }

      // Migration: Add output_schema if it doesn't exist
      const outputSchemaColumns = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'column_metadata'
          AND column_name = 'output_schema'
      `);

      if (outputSchemaColumns.length === 0) {
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN output_schema TEXT`);
        console.log('[DuckDB Schema] ✓ Output schema migration completed');
      }

      // Migration: Add web search columns if they don't exist
      const webSearchColumns = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'column_metadata'
          AND column_name = 'web_search_enabled'
      `);

      if (webSearchColumns.length === 0) {
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN web_search_enabled BOOLEAN DEFAULT FALSE`);
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN web_search_config TEXT`);
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN temperature DOUBLE`);
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN max_tokens INTEGER`);
        console.log('[DuckDB Schema] ✓ Web search columns migration completed');
      }

      // Migration: Add width column if it doesn't exist
      const widthColumn = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'column_metadata'
          AND column_name = 'width'
      `);

      if (widthColumn.length === 0) {
        await executeQuery(`ALTER TABLE column_metadata ADD COLUMN width INTEGER DEFAULT 200`);
        console.log('[DuckDB Schema] ✓ Width column migration completed');
      }
    } catch (error: any) {
      console.error('[DuckDB Schema] Column name migration error:', error);
      // Try to recreate the table with the correct schema
      try {
        console.log('[DuckDB Schema] Attempting to recreate column_metadata table...');
        await executeQuery('DROP TABLE IF EXISTS column_metadata');
        await executeQuery(`
          CREATE TABLE column_metadata (
            file_id TEXT NOT NULL,
            column_id TEXT NOT NULL,
            column_name TEXT,
            column_type TEXT NOT NULL,
            model TEXT,
            provider TEXT,
            prompt TEXT,
            created_at BIGINT,
            output_schema TEXT,
            web_search_enabled BOOLEAN DEFAULT FALSE,
            web_search_config TEXT,
            temperature DOUBLE,
            max_tokens INTEGER,
            width INTEGER DEFAULT 200,
            PRIMARY KEY (file_id, column_id)
          )
        `);
        console.log('[DuckDB Schema] ✓ Column metadata table recreated');
      } catch (recreateError) {
        console.error('[DuckDB Schema] Failed to recreate table:', recreateError);
      }
    }

    // Create cell_metadata table for AI cell status tracking
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS cell_metadata (
        file_id TEXT NOT NULL,
        column_id TEXT NOT NULL,
        row_index INTEGER NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        error_type TEXT,
        edited BOOLEAN DEFAULT FALSE,
        original_value TEXT,
        last_edit_time BIGINT,
        sources TEXT,
        PRIMARY KEY (file_id, column_id, row_index)
      )
    `);
    console.log('[DuckDB Schema] ✓ Cell metadata table created');

    // Migration: Add sources column to cell_metadata if it doesn't exist
    try {
      const sourcesColumn = await executeQuery<{ column_name: string }>(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'cell_metadata'
          AND column_name = 'sources'
      `);

      if (sourcesColumn.length === 0) {
        await executeQuery(`ALTER TABLE cell_metadata ADD COLUMN sources TEXT`);
        console.log('[DuckDB Schema] ✓ Sources column migration completed');
      }
    } catch (error: any) {
      console.warn('[DuckDB Schema] Sources column migration error:', error);
    }

    // Create saved_filters table for embedding view selections
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS saved_filters (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        name TEXT NOT NULL,
        layer_id TEXT NOT NULL,
        row_indices INTEGER[] NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[DuckDB Schema] ✓ Saved filters table created');

    // Create view for embedding visualization with x, y columns
    // This view extracts array elements for embedding-atlas compatibility
    await executeQuery(`
      CREATE OR REPLACE VIEW embedding_points_view AS
      SELECT
        layer_id,
        point_id,
        coordinates_2d[1] AS x,
        coordinates_2d[2] AS y,
        composed_text,
        label,
        source_row_indices,
        cluster_id
      FROM embedding_points
    `);
    console.log('[DuckDB Schema] ✓ Embedding points view created');

    // Create indexes for common queries
    await createIndexes();

    console.log('[DuckDB Schema] Schema initialization complete');

    // Persist the schema to OPFS
    await persistDatabase();
  } catch (error) {
    console.error('[DuckDB Schema] Failed to initialize schema:', error);
    throw error;
  }
}

/**
 * Create indexes for performance optimization
 */
async function createIndexes(): Promise<void> {
  try {
    // Index on files table
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_files_name
      ON files(name)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_files_last_modified
      ON files(last_modified DESC)
    `);

    // Index on embedding_layers table
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_embedding_layers_file_id
      ON embedding_layers(file_id)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_embedding_layers_active
      ON embedding_layers(file_id, is_active)
    `);

    // Index on embedding_points table
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_embedding_points_layer
      ON embedding_points(layer_id)
    `);

    // Index on column_metadata table
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_column_metadata_file
      ON column_metadata(file_id)
    `);

    // Index on cell_metadata table
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_cell_metadata_file_column
      ON cell_metadata(file_id, column_id)
    `);

    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_cell_metadata_status
      ON cell_metadata(file_id, column_id, status)
    `);

    // Index on saved_filters table
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_saved_filters_file
      ON saved_filters(file_id)
    `);

    console.log('[DuckDB Schema] ✓ Indexes created');
  } catch (error) {
    console.warn('[DuckDB Schema] Failed to create some indexes:', error);
    // Don't throw - indexes are optimization, not critical
  }
}

/**
 * Check if schema is initialized
 */
export async function isSchemaInitialized(): Promise<boolean> {
  try {
    const result = await executeQuery<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main'
        AND table_name IN ('files', 'embedding_layers', 'embedding_points', 'column_metadata', 'cell_metadata', 'saved_filters')
    `);

    return result.length === 6;
  } catch {
    return false;
  }
}

/**
 * Get schema version (for future migrations)
 */
export function getSchemaVersion(): number {
  return 1; // Initial version
}

/**
 * Drop all tables (for testing/reset)
 */
export async function dropAllTables(): Promise<void> {
  console.warn('[DuckDB Schema] Dropping all tables...');

  try {
    // Drop in reverse order of dependencies
    await executeQuery('DROP TABLE IF EXISTS saved_filters CASCADE');
    await executeQuery('DROP TABLE IF EXISTS cell_metadata CASCADE');
    await executeQuery('DROP TABLE IF EXISTS column_metadata CASCADE');
    await executeQuery('DROP TABLE IF EXISTS embedding_points CASCADE');
    await executeQuery('DROP TABLE IF EXISTS embedding_layers CASCADE');

    // Drop all file_data tables
    const tables = await executeQuery<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'main'
        AND table_name LIKE 'file_data_%'
    `);

    for (const { table_name } of tables) {
      await executeQuery(`DROP TABLE IF EXISTS ${table_name} CASCADE`);
    }

    await executeQuery('DROP TABLE IF EXISTS files CASCADE');

    console.log('[DuckDB Schema] All tables dropped');
  } catch (error) {
    console.error('[DuckDB Schema] Failed to drop tables:', error);
    throw error;
  }
}

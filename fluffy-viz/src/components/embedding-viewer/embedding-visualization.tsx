'use client';

/**
 * Embedding visualization using embedding-atlas
 * Renders an interactive scatter plot of embedded points using DuckDB queries.
 *
 * Deep integration features:
 * - All spreadsheet columns available for color encoding and tooltips
 * - Custom searcher for keyword and conceptual search
 * - Dynamic theme support (light/dark)
 * - Save filter functionality
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ActiveEmbeddingLayer, EmbeddingPoint } from '@/types/embedding';
import { createLayerTable, getLayerTableColumns } from '@/lib/embedding/storage';
import { createFluffySearcher, getSearchableColumns, type Searcher } from '@/lib/embedding/search';
import { Loader2 } from 'lucide-react';

interface EmbeddingVisualizationProps {
  layer: ActiveEmbeddingLayer;
  fileId: string;
  apiKey?: string; // API key for vector search (optional)
  onPointClick: (point: EmbeddingPoint) => void;
  onSelectionChange?: (selectedPointIds: string[]) => void;
}

// Detect system color scheme preference
function useColorScheme(): 'light' | 'dark' {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === 'undefined') return;

    // Check initial preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setColorScheme(mediaQuery.matches ? 'dark' : 'light');

    // Listen for changes
    const handler = (e: MediaQueryListEvent) => {
      setColorScheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return colorScheme;
}

export function EmbeddingVisualization({
  layer,
  fileId,
  apiKey,
  onPointClick,
  onSelectionChange,
}: EmbeddingVisualizationProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState<any>(null);
  const [EmbeddingAtlasComponent, setEmbeddingAtlasComponent] = useState<any>(null);
  const [layerTableName, setLayerTableName] = useState<string | null>(null);
  const [layerColumns, setLayerColumns] = useState<string[]>([]);
  const [searcher, setSearcher] = useState<Searcher | null>(null);

  const colorScheme = useColorScheme();

  // Initialize Mosaic coordinator and create layer table
  useEffect(() => {
    const initVisualization = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[Embedding Visualization] Initializing for layer:', layer.id);

        // Step 1: Create the layer table (JOINs embedding points with file data)
        console.log('[Embedding Visualization] Creating layer table...');
        const tableName = await createLayerTable(layer.id, fileId);
        setLayerTableName(tableName);

        // Step 2: Get available columns for the layer table
        const columns = await getLayerTableColumns(layer.id);
        setLayerColumns(columns);
        console.log('[Embedding Visualization] Layer table columns:', columns);

        // Step 3: Get searchable columns and create searcher
        const searchableColumns = await getSearchableColumns(layer.id);
        console.log('[Embedding Visualization] Searchable columns:', searchableColumns);

        const fluffySearcher = createFluffySearcher({
          layerId: layer.id,
          fileId,
          searchableColumns,
          embeddingProvider: layer.provider,
          embeddingModel: layer.model,
          apiKey,
        });
        setSearcher(fluffySearcher);

        // Step 4: Dynamically import required modules
        console.log('[Embedding Visualization] Importing Mosaic and EmbeddingAtlas...');
        const mosaicCore = await import('@uwdata/mosaic-core');
        const { EmbeddingAtlas } = await import('embedding-atlas/react');

        // Step 5: Get DuckDB instance
        const { getDuckDB } = await import('@/lib/duckdb/client');
        const db = await getDuckDB();

        // Step 6: Create Mosaic coordinator with WASM connector
        console.log('[Embedding Visualization] Creating WASM connector...');
        const connector = mosaicCore.wasmConnector({ duckdb: db });

        // Get global coordinator instance and set database connector
        const coord = mosaicCore.coordinator();
        coord.databaseConnector(connector);

        console.log('[Embedding Visualization] Coordinator initialized successfully');

        setCoordinator(coord);
        setEmbeddingAtlasComponent(() => EmbeddingAtlas);
        setLoading(false);
      } catch (err) {
        console.error('[Embedding Visualization] Error initializing:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize visualization');
        setLoading(false);
      }
    };

    if (layer && fileId) {
      initVisualization();
    }
  }, [layer, fileId, apiKey]);

  // Handle selection export (for save filter functionality)
  const handleExportSelection = useCallback(async (
    predicate: string | null,
    format: 'json' | 'csv'
  ) => {
    if (!layerTableName || !onSelectionChange) return;

    try {
      // Query selected point IDs based on predicate
      const { executeQuery } = await import('@/lib/duckdb/client');
      const whereClause = predicate ? `WHERE ${predicate}` : '';
      const results = await executeQuery<{ point_id: string }>(
        `SELECT point_id FROM "${layerTableName}" ${whereClause}`
      );

      const pointIds = results.map(r => r.point_id);
      onSelectionChange(pointIds);

      console.log(`[Embedding Visualization] Selection exported: ${pointIds.length} points`);
    } catch (err) {
      console.error('[Embedding Visualization] Error exporting selection:', err);
    }
  }, [layerTableName, onSelectionChange]);

  // Memoize the data configuration
  const dataConfig = useMemo(() => {
    if (!layerTableName) return null;

    return {
      table: layerTableName,
      id: 'point_id',
      projection: {
        x: 'x',
        y: 'y',
      },
      text: 'composed_text',
    };
  }, [layerTableName]);

  if (loading) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ minHeight: '400px' }}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {layerTableName ? 'Initializing visualization...' : 'Creating layer table...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ minHeight: '400px' }}
      >
        <div className="flex flex-col items-center gap-2 text-center p-4">
          <p className="text-sm text-red-600">Error loading visualization</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!coordinator || !EmbeddingAtlasComponent || !layer || !dataConfig) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ minHeight: '400px' }}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading embedding data...</p>
        </div>
      </div>
    );
  }

  console.log(
    `[Embedding Visualization] Rendering atlas for layer ${layer.id}`,
    `with ${layer.points.length} points,`,
    `table: ${layerTableName},`,
    `columns: ${layerColumns.length}`
  );

  return (
    <div className="w-full h-full" style={{ minHeight: '400px' }}>
      <EmbeddingAtlasComponent
        coordinator={coordinator}
        data={dataConfig}
        colorScheme={colorScheme}
        searcher={searcher}
        onExportSelection={handleExportSelection}
      />
    </div>
  );
}

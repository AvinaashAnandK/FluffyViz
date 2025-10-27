'use client';

/**
 * Embedding visualization using embedding-atlas
 * Renders an interactive scatter plot of embedded points using DuckDB queries
 */

import { useEffect, useState } from 'react';
import type { ActiveEmbeddingLayer, EmbeddingPoint } from '@/types/embedding';
import { Loader2 } from 'lucide-react';

interface EmbeddingVisualizationProps {
  layer: ActiveEmbeddingLayer;
  onPointClick: (point: EmbeddingPoint) => void;
}

export function EmbeddingVisualization({ layer, onPointClick }: EmbeddingVisualizationProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState<any>(null);
  const [EmbeddingAtlasComponent, setEmbeddingAtlasComponent] = useState<any>(null);

  // Initialize Mosaic coordinator
  useEffect(() => {
    const initCoordinator = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[Embedding Visualization] Initializing Mosaic coordinator...');

        // Dynamically import required modules
        const mosaicCore = await import('@uwdata/mosaic-core');
        const { EmbeddingAtlas } = await import('embedding-atlas/react');

        // Get DuckDB instance
        const { getDuckDB } = await import('@/lib/duckdb/client');
        const db = await getDuckDB();

        console.log('[Embedding Visualization] Creating WASM connector...');

        // Create Mosaic coordinator with WASM connector
        const connector = mosaicCore.wasmConnector({ duckdb: db });

        // Get global coordinator instance and set database connector
        const coord = mosaicCore.coordinator();
        coord.databaseConnector(connector);

        console.log('[Embedding Visualization] Coordinator initialized successfully');

        setCoordinator(coord);
        setEmbeddingAtlasComponent(() => EmbeddingAtlas);
        setLoading(false);
      } catch (err) {
        console.error('[Embedding Visualization] Error initializing coordinator:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize visualization');
        setLoading(false);
      }
    };

    initCoordinator();
  }, []);

  if (loading) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ minHeight: '400px' }}
      >
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Initializing visualization...</p>
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

  if (!coordinator || !EmbeddingAtlasComponent || !layer) {
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

  console.log(`[Embedding Visualization] Rendering atlas for layer ${layer.id} with ${layer.points.length} points`);

  return (
    <div className="w-full h-full" style={{ minHeight: '400px' }}>
      <EmbeddingAtlasComponent
        coordinator={coordinator}
        data={{
          table: 'embedding_points_view',
          id: 'point_id',
          projection: {
            x: 'x',
            y: 'y'
          },
          text: 'composed_text'
        }}
        colorScheme="light"
      />
    </div>
  );
}

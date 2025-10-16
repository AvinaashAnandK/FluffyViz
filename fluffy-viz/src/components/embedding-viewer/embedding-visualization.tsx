'use client';

/**
 * Embedding visualization using embedding-atlas
 * Renders an interactive scatter plot of embedded points using DuckDB queries
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { wasmConnector } from '@uwdata/mosaic-core';
import type { ActiveEmbeddingLayer, EmbeddingPoint } from '@/types/embedding';
import { getDuckDB } from '@/lib/duckdb/client';
import { Loader2 } from 'lucide-react';

interface EmbeddingVisualizationProps {
  layer: ActiveEmbeddingLayer;
  onPointClick: (point: EmbeddingPoint) => void;
}

export function EmbeddingVisualization({ layer, onPointClick }: EmbeddingVisualizationProps) {
  const [coordinator, setCoordinator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const atlasRef = useRef<any>(null);

  // Initialize Mosaic coordinator
  useEffect(() => {
    const initCoordinator = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get DuckDB instance
        const db = await getDuckDB();

        // Create Mosaic coordinator with WASM connector
        const coord = wasmConnector({ duckdb: db });

        setCoordinator(coord);
      } catch (err) {
        console.error('[Embedding Visualization] Error initializing coordinator:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize visualization');
      } finally {
        setLoading(false);
      }
    };

    initCoordinator();
  }, []);

  // Initialize embedding-atlas when coordinator is ready
  useEffect(() => {
    if (!coordinator || !containerRef.current || !layer) return;

    const initAtlas = async () => {
      try {
        // Dynamically import embedding-atlas to avoid SSR issues
        const { EmbeddingAtlas } = await import('embedding-atlas');

        // Clear container
        containerRef.current!.innerHTML = '';

        // Create embedding-atlas instance
        const atlas = new EmbeddingAtlas(containerRef.current!, {
          coordinator,
          data: {
            table: 'embedding_points',
            id: 'point_id',
            projection: {
              x: 'coordinates_2d[1]',  // DuckDB array syntax (1-indexed)
              y: 'coordinates_2d[2]'
            },
            text: 'composed_text'
          },
          filter: {
            column: 'layer_id',
            value: layer.id
          },
          width: containerRef.current!.clientWidth,
          height: containerRef.current!.clientHeight || 600,
          onClick: handleAtlasClick
        });

        atlasRef.current = atlas;

        console.log(`[Embedding Visualization] Atlas initialized for layer ${layer.id}`);
      } catch (err) {
        console.error('[Embedding Visualization] Error initializing atlas:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize atlas');
      }
    };

    initAtlas();

    // Cleanup
    return () => {
      if (atlasRef.current) {
        atlasRef.current.destroy?.();
        atlasRef.current = null;
      }
    };
  }, [coordinator, layer]);

  // Handle point clicks from embedding-atlas
  const handleAtlasClick = useMemo(() => (atlasPoint: any) => {
    try {
      // Map atlas point data to EmbeddingPoint interface
      const embeddingPoint: EmbeddingPoint = {
        id: atlasPoint.point_id || atlasPoint.id,
        embedding: atlasPoint.embedding || [],
        coordinates2D: atlasPoint.coordinates_2d || [atlasPoint.x, atlasPoint.y],
        composedText: atlasPoint.composed_text || atlasPoint.text || '',
        label: atlasPoint.label,
        sourceRowIndices: atlasPoint.source_row_indices || []
      };
      onPointClick(embeddingPoint);
    } catch (err) {
      console.error('[Embedding Visualization] Error handling click:', err);
    }
  }, [onPointClick]);

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

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  );
}

'use client';

/**
 * Agent Trace Viewer - Main container for embedding visualization
 * Displays interactive scatter plots, manages embedding layers, and provides search/filtering
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { EmbeddingWizard } from './embedding-wizard';
import { SaveFilterModal } from './save-filter-modal';
import type { WizardState, ActiveEmbeddingLayer, EmbeddingLayerMetadata, EmbeddingPoint } from '@/types/embedding';
import { embeddingStorage, generateEmbeddingId } from '@/lib/embedding/storage';
import { composeText, addComposedTextColumn } from '@/lib/embedding/text-composer';
import { batchEmbed, freeTiktokenEncoder } from '@/lib/embedding/batch-embedder';
import { computeUMAPProjection, computeUMAPForClustering, clearUMAPMemory } from '@/lib/embedding/umap-reducer';
import { computeKNN } from '@/lib/embedding/knn';
import { getAllFileRows, getFileRowCount } from '@/lib/duckdb';
import { Download, Loader2, Filter } from 'lucide-react';
import { loadProviderSettings, getProviderApiKey, type ProviderKey } from '@/config/provider-settings';
import { clusterEmbeddings } from '@/lib/embedding/clustering';
import { saveClusteringCoordinates } from '@/lib/embedding/clustering-coords-storage';
import type { ClusterConfig, ClusterStats } from '@/types/embedding';

// Dynamically import EmbeddingVisualization with SSR disabled to prevent
// embedding-atlas from being loaded during server-side rendering
const EmbeddingVisualization = dynamic(
  () => import('./embedding-visualization').then(mod => ({ default: mod.EmbeddingVisualization })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center" style={{ minHeight: '400px' }}>
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading visualization...</p>
        </div>
      </div>
    )
  }
);

export interface ColumnInfo {
  id: string;   // Column ID used in DuckDB (e.g., "col_123" or original column name)
  name: string; // Display name shown to user (e.g., "turndata")
}

interface AgentTraceViewerProps {
  fileId: string;
  data: {
    columns: ColumnInfo[];
    rows: Record<string, unknown>[];
  };
  onDataUpdate: (updatedData: { columns: ColumnInfo[]; rows: Record<string, unknown>[] }) => void;
}

export function AgentTraceViewer({ fileId, data, onDataUpdate }: AgentTraceViewerProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ActiveEmbeddingLayer | null>(null);
  const [layers, setLayers] = useState<EmbeddingLayerMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<EmbeddingPoint | null>(null);
  const [selectedPointIds, setSelectedPointIds] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState<string | undefined>(undefined);
  const [totalRows, setTotalRows] = useState<number>(0);

  // Load embedding layers, API key, and total row count on mount
  useEffect(() => {
    loadEmbeddingLayers();
    // Load total row count from DuckDB for accurate wizard preview
    getFileRowCount(fileId).then(setTotalRows).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // Load API key when active layer changes
  useEffect(() => {
    if (activeLayer) {
      loadProviderSettings().then(config => {
        const key = getProviderApiKey(config, activeLayer.provider as ProviderKey);
        setApiKey(key ?? undefined); // Convert null to undefined
      }).catch(() => {
        setApiKey(undefined);
      });
    }
  }, [activeLayer]);

  const loadEmbeddingLayers = async () => {
    try {
      setLoading(true);
      const metadata = await embeddingStorage.getLayerMetadata(fileId);
      setLayers(metadata);

      // Load active layer
      const active = await embeddingStorage.getActiveLayer(fileId);
      if (active) {
        setActiveLayer(active);
      }
    } catch (error) {
      console.error('Error loading embedding layers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmbeddings = useCallback(async (state: WizardState) => {
    try {
      setLoading(true);

      // Step 1: Load provider config and get API key
      const config = await loadProviderSettings();
      const apiKey = getProviderApiKey(config, state.provider as ProviderKey);

      if (!apiKey) {
        throw new Error(`API key not found for provider: ${state.provider}`);
      }

      // Step 2: Fetch ALL rows from DuckDB (not the paginated data.rows!)
      // This ensures embedding generation uses the complete dataset
      console.log(`[Embedding Generation] Fetching all rows for file ${fileId}`);
      const allRows = await getAllFileRows(fileId);
      console.log(`[Embedding Generation] Fetched ${allRows.length} rows from DuckDB`);

      // DEBUG: Check what columns exist in DuckDB vs what was selected
      if (allRows.length > 0) {
        const duckDBColumns = Object.keys(allRows[0]);
        console.log(`[Embedding Generation] DuckDB columns (${duckDBColumns.length}):`, duckDBColumns);
        console.log(`[Embedding Generation] UI state columns (${data.columns.length}):`, data.columns);

        // Check if selected column exists
        const selectedColumn = state.compositionMode === 'single'
          ? state.compositionConfig.sourceColumn
          : state.compositionMode === 'multi'
          ? state.compositionConfig.columns?.[0]
          : state.compositionConfig.turnFormatColumns?.[0];

        if (selectedColumn) {
          const existsInDuckDB = duckDBColumns.includes(selectedColumn);
          console.log(`[Embedding Generation] Selected column "${selectedColumn}" exists in DuckDB: ${existsInDuckDB}`);

          if (!existsInDuckDB) {
            console.error(`[Embedding Generation] CRITICAL: Column "${selectedColumn}" NOT FOUND in DuckDB!`);
            console.error(`[Embedding Generation] Available columns:`, duckDBColumns);
          } else {
            // Sample some values to check if they're populated
            const sampleIndices = [0, 70, 71, 72, 100, Math.floor(allRows.length / 2), allRows.length - 1];
            console.log(`[Embedding Generation] Sample values for "${selectedColumn}":`);
            for (const idx of sampleIndices) {
              if (idx < allRows.length) {
                const value = allRows[idx][selectedColumn];
                const preview = value ? String(value).substring(0, 50) : '(empty/null)';
                console.log(`  Row ${idx}: ${preview}${String(value || '').length > 50 ? '...' : ''}`);
              }
            }
          }
        }
      }

      // Step 3: Compose text from ALL rows
      const compositionConfig = {
        mode: state.compositionMode,
        config: state.compositionConfig,
      } as any;

      const { composedTexts, sourceRowIndices, labels } = composeText(
        allRows,
        compositionConfig
      );
      console.log(`[Embedding Generation] Composed ${composedTexts.length} texts`);

      // Step 4: Generate embeddings
      const { embeddings, dimension } = await batchEmbed(composedTexts, {
        provider: state.provider,
        model: state.model,
        apiKey,
      });

      // Free tiktoken WASM memory before running UMAP
      // This is critical: tiktoken + DuckDB + embedding-atlas WASMs can exceed browser memory limits
      console.log('[Embedding Generation] Freeing tiktoken encoder before UMAP...');
      await freeTiktokenEncoder();

      // Step 5: TWO-STAGE UMAP APPROACH
      // Stage 1: UMAP for clustering (high-D → 15D with min_dist=0.0)
      const nNeighbors = state.clusterConfig.nNeighbors ?? 30;
      console.log(`[Embedding Generation] Stage 1: UMAP for clustering (15D, n_neighbors=${nNeighbors})...`);
      const { coordinates: clusteringCoords } = await computeUMAPForClustering(
        embeddings,
        15, // target dimension
        undefined, // onProgress
        nNeighbors
      );

      // Step 6: Cluster on intermediate UMAP coordinates (15D)
      // HDBSCAN works well here because UMAP with min_dist=0 creates tight density gradients
      console.log('[Embedding Generation] Clustering on 15D UMAP coordinates...');
      const clusterConfig: ClusterConfig = state.clusterConfig;
      const clusterResult = await clusterEmbeddings(clusteringCoords, clusterConfig);

      // Clear WASM memory before second UMAP to avoid memory accumulation
      // This is critical: running two UMAP operations without clearing can cause
      // "memory access out of bounds" errors in the WASM module
      console.log('[Embedding Generation] Clearing UMAP memory before visualization projection...');
      await clearUMAPMemory();

      // Stage 2: UMAP for visualization (high-D → 2D with min_dist=0.1)
      console.log('[Embedding Generation] Stage 2: UMAP for visualization (2D)...');
      const { coordinates2D } = await computeUMAPProjection(embeddings);

      // Step 7: Compute k-nearest neighbors for fast search
      console.log('[Embedding Generation] Computing k-nearest neighbors...');
      const pointIds = embeddings.map((_, i) => `point_${i}`);
      const knnMap = computeKNN(pointIds, embeddings, 10);

      // Step 8: Create embedding points with neighbors and cluster IDs
      const points: EmbeddingPoint[] = embeddings.map((embedding, i) => ({
        id: `point_${i}`,
        embedding,
        coordinates2D: coordinates2D[i],
        sourceRowIndices: sourceRowIndices[i],
        composedText: composedTexts[i],
        label: labels?.[i],
        neighbors: knnMap.get(`point_${i}`),
        clusterId: clusterResult.labels[i],
      }));

      // Prepare cluster stats for storage
      const clusterStats: ClusterStats = {
        clusterCount: clusterResult.clusterCount,
        noiseCount: clusterResult.noiseCount,
        noisePercentage: clusterResult.noisePercentage,
        clusterSizes: Object.fromEntries(clusterResult.clusterSizes),
      };

      // Step 8: Add composed text column to DuckDB (via update callback)
      // Note: We still use the onDataUpdate callback to keep the UI in sync
      const columnName = `_embedding_composition_${Date.now()}`;
      const updatedRows = addComposedTextColumn(allRows, composedTexts, sourceRowIndices, columnName);

      onDataUpdate({
        columns: [...data.columns, { id: columnName, name: columnName }],
        rows: updatedRows,
      });

      // Step 9: Save embedding layer
      const layerId = generateEmbeddingId();

      // Save clustering coordinates to OPFS for future re-clustering
      // This allows re-clustering to use the 15D space instead of 2D
      await saveClusteringCoordinates(layerId, clusteringCoords);

      const layer: ActiveEmbeddingLayer = {
        id: layerId,
        fileId,
        name: state.name,
        provider: state.provider,
        model: state.model,
        dimension,
        compositionMode: state.compositionMode,
        compositionConfig,
        clusterConfig,
        clusterStats,
        points,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
      };

      // Save layer (automatically sets as active and marks others as inactive)
      await embeddingStorage.saveLayer(layer);

      // Reload layers
      await loadEmbeddingLayers();
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw error;
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, data.columns, onDataUpdate]);

  const handleLayerSwitch = useCallback(async (layerId: string) => {
    if (layerId === activeLayer?.id) return;

    try {
      setLoading(true);
      await embeddingStorage.setActiveLayer(fileId, layerId);
      await loadEmbeddingLayers();
    } catch (error) {
      console.error('Error switching layer:', error);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, activeLayer]);

  const handleDownloadPNG = useCallback(async () => {
    // This would be implemented using html-to-image or similar
    console.log('Download PNG not yet implemented');
  }, []);

  if (loading && layers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Empty state
  if (layers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <h3 className="text-lg font-medium">No Embedding Views Created Yet</h3>
          <p className="text-muted-foreground mt-1">
            Create your first embedding view to visualize your data
          </p>
        </div>
        <Button onClick={() => setWizardOpen(true)} size="lg">
          Create Embedding View
        </Button>
        <EmbeddingWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          columns={data.columns}
          rows={data.rows}
          totalRows={totalRows}
          onGenerate={handleGenerateEmbeddings}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Active View:</span>
          <Select value={activeLayer?.id} onValueChange={handleLayerSwitch}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select view" />
            </SelectTrigger>
            <SelectContent>
              {layers.map(layer => (
                <SelectItem key={layer.id} value={layer.id}>
                  <div>
                    <div className="font-medium">{layer.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {layer.pointCount} points • {layer.compositionMode}
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveFilterOpen(true)}
            disabled={selectedPointIds.length === 0}
          >
            <Filter className="h-4 w-4 mr-2" />
            Save Filter ({selectedPointIds.length})
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPNG}>
            <Download className="h-4 w-4 mr-2" />
            Download PNG
          </Button>
          <Button onClick={() => setWizardOpen(true)} size="sm">
            + New View
          </Button>
        </div>
      </div>

      {/* Visualization */}
      <div className="flex-1 border rounded-lg overflow-hidden">
        {activeLayer ? (
          <EmbeddingVisualization
            layer={activeLayer}
            fileId={fileId}
            apiKey={apiKey}
            onPointClick={setSelectedPoint}
            onSelectionChange={setSelectedPointIds}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select a view to visualize</p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedPoint && (
        <Card className="p-4">
          <h3 className="font-medium mb-2">Point Details</h3>
          <div className="space-y-2 text-sm">
            <p><strong>ID:</strong> {selectedPoint.id}</p>
            {selectedPoint.label && <p><strong>Label:</strong> {selectedPoint.label}</p>}
            <div>
              <strong>Composed Text:</strong>
              <pre className="mt-1 p-2 bg-muted rounded text-xs whitespace-pre-wrap">
                {selectedPoint.composedText}
              </pre>
            </div>
          </div>
        </Card>
      )}

      <EmbeddingWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        columns={data.columns}
        rows={data.rows}
        totalRows={totalRows}
        onGenerate={handleGenerateEmbeddings}
      />

      {/* Save Filter Modal */}
      {activeLayer && (
        <SaveFilterModal
          open={saveFilterOpen}
          onClose={() => setSaveFilterOpen(false)}
          fileId={fileId}
          layerId={activeLayer.id}
          pointIds={selectedPointIds}
          onSaved={() => {
            setSelectedPointIds([]);
          }}
        />
      )}
    </div>
  );
}

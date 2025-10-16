'use client';

/**
 * Agent Trace Viewer - Main container for embedding visualization
 * Displays interactive scatter plots, manages embedding layers, and provides search/filtering
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { EmbeddingWizard } from './embedding-wizard';
import { EmbeddingVisualization } from './embedding-visualization';
import type { WizardState, ActiveEmbeddingLayer, EmbeddingLayerMetadata, EmbeddingPoint } from '@/types/embedding';
import { embeddingStorage, generateEmbeddingId } from '@/lib/embedding/storage';
import { composeText, addComposedTextColumn } from '@/lib/embedding/text-composer';
import { batchEmbed } from '@/lib/embedding/batch-embedder';
import { computeUMAPProjection } from '@/lib/embedding/umap-reducer';
import { Download } from 'lucide-react';

interface AgentTraceViewerProps {
  fileId: string;
  data: {
    columns: string[];
    rows: Record<string, unknown>[];
  };
  onDataUpdate: (updatedData: { columns: string[]; rows: Record<string, unknown>[] }) => void;
}

export function AgentTraceViewer({ fileId, data, onDataUpdate }: AgentTraceViewerProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState<ActiveEmbeddingLayer | null>(null);
  const [layers, setLayers] = useState<EmbeddingLayerMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPoint, setSelectedPoint] = useState<EmbeddingPoint | null>(null);

  // Load embedding layers on mount
  useEffect(() => {
    loadEmbeddingLayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

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

      // Step 1: Compose text
      const compositionConfig = {
        mode: state.compositionMode,
        config: state.compositionConfig,
      } as any;

      const { composedTexts, sourceRowIndices, labels } = composeText(
        data.rows,
        compositionConfig
      );

      // Step 2: Generate embeddings
      const { embeddings, dimension } = await batchEmbed(composedTexts, {
        provider: state.provider,
        model: state.model,
      });

      // Step 3: Compute UMAP projection
      const { coordinates2D } = await computeUMAPProjection(embeddings);

      // Step 4: Create embedding points
      const points: EmbeddingPoint[] = embeddings.map((embedding, i) => ({
        id: `point_${i}`,
        embedding,
        coordinates2D: coordinates2D[i],
        sourceRowIndices: sourceRowIndices[i],
        composedText: composedTexts[i],
        label: labels?.[i],
      }));

      // Step 5: Add composed text column to spreadsheet
      const columnName = `_embedding_composition_${Date.now()}`;
      const updatedRows = [...data.rows];
      addComposedTextColumn(updatedRows, composedTexts, sourceRowIndices, columnName);

      // Update data
      onDataUpdate({
        columns: [...data.columns, columnName],
        rows: updatedRows,
      });

      // Step 6: Save embedding layer
      const layerId = generateEmbeddingId();
      const layer: ActiveEmbeddingLayer = {
        id: layerId,
        fileId,
        name: state.name,
        provider: state.provider,
        model: state.model,
        dimension,
        compositionMode: state.compositionMode,
        compositionConfig,
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
  }, [fileId, data, onDataUpdate]);

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
          onGenerate={handleGenerateEmbeddings}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 p-4">
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
            onPointClick={setSelectedPoint}
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
        onGenerate={handleGenerateEmbeddings}
      />
    </div>
  );
}

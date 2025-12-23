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
import type { ActiveEmbeddingLayer, EmbeddingPoint, ClusterConfig, ClusterStats } from '@/types/embedding';
import { DEFAULT_CLUSTER_CONFIG } from '@/types/embedding';
import { createLayerTable, getLayerTableColumns, dropLayerTable, updateClusterAssignments, updateClusterMetadata } from '@/lib/embedding/storage';
import { createFluffySearcher, getSearchableColumns, type Searcher } from '@/lib/embedding/search';
import { clusterEmbeddings } from '@/lib/embedding/clustering';
import { loadClusteringCoordinates } from '@/lib/embedding/clustering-coords-storage';
import { Loader2, Circle, Waves, Minus, Plus, Tags, RefreshCw, CheckCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Switch } from '@/components/ui/switch';

interface EmbeddingVisualizationProps {
  layer: ActiveEmbeddingLayer;
  fileId: string;
  apiKey?: string; // API key for vector search (optional)
  onPointClick: (point: EmbeddingPoint) => void;
  onSelectionChange?: (selectedPointIds: string[]) => void;
  onLayerUpdate?: (updatedLayer: ActiveEmbeddingLayer) => void; // For re-clustering
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

// View config for embedding-atlas
interface EmbeddingViewConfig {
  mode?: 'points' | 'density' | null;
  minimumDensity?: number | null;
  pointSize?: number | null;
  autoLabelEnabled?: boolean | null;
  autoLabelDensityThreshold?: number | null;
}

export function EmbeddingVisualization({
  layer,
  fileId,
  apiKey,
  onPointClick,
  onSelectionChange,
  onLayerUpdate,
}: EmbeddingVisualizationProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState<any>(null);
  const [EmbeddingAtlasComponent, setEmbeddingAtlasComponent] = useState<any>(null);
  const [layerTableName, setLayerTableName] = useState<string | null>(null);
  const [layerColumns, setLayerColumns] = useState<string[]>([]);
  const [searcher, setSearcher] = useState<Searcher | null>(null);

  // View configuration state
  const [viewMode, setViewMode] = useState<'points' | 'density'>('points');
  const [minimumDensity, setMinimumDensity] = useState<number>(0.01);
  const [pointSize, setPointSize] = useState<number | null>(null);
  const [initialAtlasState, setInitialAtlasState] = useState<any>(null);

  // Version for forcing re-mount when view config changes
  const [viewConfigVersion, setViewConfigVersion] = useState(0);

  // Auto-label state (embedding-atlas built-in clustering labels)
  const [autoLabelEnabled, setAutoLabelEnabled] = useState<boolean>(true);
  const [autoLabelDensityThreshold, setAutoLabelDensityThreshold] = useState<number>(0.1);

  // HDBSCAN clustering state
  const [clusterConfig, setClusterConfig] = useState<ClusterConfig>(
    layer.clusterConfig ?? { ...DEFAULT_CLUSTER_CONFIG }
  );
  const [clusterStats, setClusterStats] = useState<ClusterStats | null>(
    layer.clusterStats ?? null
  );
  const [isReclustering, setIsReclustering] = useState(false);

  // Sync cluster config and stats when layer changes (view switch)
  useEffect(() => {
    setClusterConfig(layer.clusterConfig ?? { ...DEFAULT_CLUSTER_CONFIG });
    setClusterStats(layer.clusterStats ?? null);
  }, [layer.id, layer.clusterConfig, layer.clusterStats]);

  const colorScheme = useColorScheme();

  // State persistence key
  const stateKey = `fluffy-viz-embedding-state-${layer.id}`;

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(stateKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setInitialAtlasState(parsed.atlasState || null);
        // Restore view config
        if (parsed.viewMode) setViewMode(parsed.viewMode);
        if (parsed.minimumDensity !== undefined) setMinimumDensity(parsed.minimumDensity);
        if (parsed.pointSize !== undefined) setPointSize(parsed.pointSize);
        // Restore clustering config
        if (parsed.autoLabelEnabled !== undefined) setAutoLabelEnabled(parsed.autoLabelEnabled);
        if (parsed.autoLabelDensityThreshold !== undefined) setAutoLabelDensityThreshold(parsed.autoLabelDensityThreshold);
        console.log('[Embedding Visualization] Restored saved state for layer:', layer.id);
      }
    } catch (err) {
      console.error('[Embedding Visualization] Error loading saved state:', err);
    }
  }, [layer.id, stateKey]);

  // Save view config when it changes
  useEffect(() => {
    try {
      const existing = localStorage.getItem(stateKey);
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem(stateKey, JSON.stringify({
        ...parsed,
        viewMode,
        minimumDensity,
        pointSize,
        autoLabelEnabled,
        autoLabelDensityThreshold,
      }));
    } catch (err) {
      console.error('[Embedding Visualization] Error saving view config:', err);
    }
  }, [viewMode, minimumDensity, pointSize, autoLabelEnabled, autoLabelDensityThreshold, stateKey]);

  // Handle atlas state change (save to localStorage)
  const handleAtlasStateChange = useCallback((state: any) => {
    try {
      const existing = localStorage.getItem(stateKey);
      const parsed = existing ? JSON.parse(existing) : {};
      localStorage.setItem(stateKey, JSON.stringify({
        ...parsed,
        atlasState: state,
      }));
      console.log('[Embedding Visualization] Saved atlas state for layer:', layer.id);
    } catch (err) {
      console.error('[Embedding Visualization] Error saving atlas state:', err);
    }
  }, [layer.id, stateKey]);

  // Handle view config changes - clear atlas state and force re-mount
  const handleViewConfigChange = useCallback(<T,>(setter: (val: T) => void, value: T) => {
    // Update the state value
    setter(value);

    // Clear the saved atlas state to force fresh config application
    try {
      const existing = localStorage.getItem(stateKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        // Remove the atlasState so it doesn't override our new config
        delete parsed.atlasState;
        localStorage.setItem(stateKey, JSON.stringify(parsed));
      }
    } catch (err) {
      console.error('[Embedding Visualization] Error clearing atlas state:', err);
    }

    // Increment version to force re-mount of EmbeddingAtlas
    setViewConfigVersion(v => v + 1);
    // Clear initial state so new config is applied
    setInitialAtlasState(null);
  }, [stateKey]);

  // Handle re-clustering with new parameters
  const handleRecluster = useCallback(async () => {
    if (!layer.points.length || isReclustering) return;

    setIsReclustering(true);
    try {
      console.log('[Embedding Visualization] Re-clustering with config:', clusterConfig);

      const pointIds = layer.points.map(p => p.id);

      // Try to load 15D clustering coordinates from OPFS
      // These preserve more semantic information than 2D
      const clusteringCoords = await loadClusteringCoordinates(layer.id);

      let result;
      if (clusteringCoords && clusteringCoords.length === layer.points.length) {
        console.log('[Embedding Visualization] Using 15D coordinates from OPFS');
        result = await clusterEmbeddings(clusteringCoords, clusterConfig);
      } else {
        // Fall back to 2D coordinates if OPFS data not available
        console.log('[Embedding Visualization] Falling back to 2D coordinates');
        const coordinates2D = layer.points.map(p => p.coordinates2D);
        result = await clusterEmbeddings(coordinates2D, clusterConfig);
      }

      // Update cluster assignments in DuckDB
      await updateClusterAssignments(layer.id, result.labels, pointIds);

      // Update cluster metadata in DuckDB
      const newStats: ClusterStats = {
        clusterCount: result.clusterCount,
        noiseCount: result.noiseCount,
        noisePercentage: result.noisePercentage,
        clusterSizes: Object.fromEntries(result.clusterSizes),
      };
      await updateClusterMetadata(layer.id, clusterConfig, newStats);

      // Update local state
      setClusterStats(newStats);

      // Recreate layer table to get new cluster_id values
      await dropLayerTable(layer.id);
      const newTableName = await createLayerTable(layer.id, fileId);
      setLayerTableName(newTableName);

      // Force re-render of visualization
      setViewConfigVersion(v => v + 1);
      setInitialAtlasState(null);

      // Notify parent if callback provided
      if (onLayerUpdate) {
        const updatedPoints = layer.points.map((p, i) => ({
          ...p,
          clusterId: result.labels[i],
        }));
        onLayerUpdate({
          ...layer,
          clusterConfig,
          clusterStats: newStats,
          points: updatedPoints,
        });
      }

      console.log('[Embedding Visualization] Re-clustering complete:', newStats);
    } catch (err) {
      console.error('[Embedding Visualization] Re-clustering failed:', err);
    } finally {
      setIsReclustering(false);
    }
  }, [layer, clusterConfig, isReclustering, fileId, onLayerUpdate]);

  // Memoize view config to avoid unnecessary re-renders
  const embeddingViewConfig = useMemo<EmbeddingViewConfig>(() => ({
    mode: viewMode,
    minimumDensity: viewMode === 'density' ? minimumDensity : null,
    pointSize: pointSize,
    autoLabelEnabled: autoLabelEnabled,
    autoLabelDensityThreshold: autoLabelDensityThreshold,
  }), [viewMode, minimumDensity, pointSize, autoLabelEnabled, autoLabelDensityThreshold]);

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
      neighbors: 'neighbors', // Pre-computed k-nearest neighbors for fast search
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
    <div className="w-full h-full flex flex-col" style={{ minHeight: '400px' }}>
      {/* Control Panel */}
      <div className="flex items-center gap-3 px-3 py-2 border-b bg-muted/30">
        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">View:</Label>
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(val) => val && handleViewConfigChange(setViewMode, val as 'points' | 'density')}
            className="h-8"
          >
            <ToggleGroupItem value="points" aria-label="Points view" className="h-7 px-2 gap-1">
              <Circle className="h-3 w-3" />
              <span className="text-xs">Points</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="density" aria-label="Density view" className="h-7 px-2 gap-1">
              <Waves className="h-3 w-3" />
              <span className="text-xs">Density</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Density Threshold (shown in density mode) */}
        {viewMode === 'density' && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Min Density: {minimumDensity.toFixed(3)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="start">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">Minimum Density Threshold</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Points per square pixel for contours to appear
                  </p>
                </div>
                <Slider
                  value={[minimumDensity]}
                  onValueChange={([val]) => handleViewConfigChange(setMinimumDensity, val)}
                  min={0.001}
                  max={0.1}
                  step={0.001}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.001</span>
                  <span>0.1</span>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Point Size Control */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              Point Size: {pointSize ?? 'Auto'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Point Size</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Override automatic sizing (or leave as Auto)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleViewConfigChange(setPointSize, Math.max(1, (pointSize ?? 4) - 1))}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Slider
                  value={[pointSize ?? 4]}
                  onValueChange={([val]) => handleViewConfigChange(setPointSize, val)}
                  min={1}
                  max={20}
                  step={1}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleViewConfigChange(setPointSize, Math.min(20, (pointSize ?? 4) + 1))}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => handleViewConfigChange(setPointSize, null)}
              >
                Reset to Auto
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Cluster Labels Control */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Tags className="h-3 w-3" />
              Labels
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Auto Cluster Labels</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Automatically label dense regions
                  </p>
                </div>
                <Switch
                  checked={autoLabelEnabled}
                  onCheckedChange={(checked) => handleViewConfigChange(setAutoLabelEnabled, checked)}
                />
              </div>

              {autoLabelEnabled && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Label Density Threshold</Label>
                  <p className="text-xs text-muted-foreground">
                    Only label clusters above this density (relative to max)
                  </p>
                  <Slider
                    value={[autoLabelDensityThreshold]}
                    onValueChange={([val]) => handleViewConfigChange(setAutoLabelDensityThreshold, val)}
                    min={0.01}
                    max={0.5}
                    step={0.01}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low (more labels)</span>
                    <span>{(autoLabelDensityThreshold * 100).toFixed(0)}%</span>
                    <span>High (fewer labels)</span>
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Separator */}
        <div className="h-4 w-px bg-border" />

        {/* Clustering Controls */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <BarChart3 className="h-3 w-3" />
              Clusters
              {clusterStats && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {clusterStats.clusterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              {/* Cluster Stats */}
              {clusterStats ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Cluster Statistics</Label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Clusters</span>
                      <span className="font-medium">{clusterStats.clusterCount}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted rounded">
                      <span className="text-muted-foreground">Outliers</span>
                      <span className="font-medium">{clusterStats.noisePercentage.toFixed(1)}%</span>
                    </div>
                  </div>
                  {clusterStats.clusterCount > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Sizes: {Object.entries(clusterStats.clusterSizes)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 5)
                        .map(([id, size]) => `C${id}: ${size}`)
                        .join(', ')}
                      {Object.keys(clusterStats.clusterSizes).length > 5 && '...'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground p-2 bg-muted rounded text-center">
                  No clustering data available
                </div>
              )}

              {/* UMAP Neighbors Slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs font-medium">UMAP Neighbors</Label>
                  <span className="text-xs text-muted-foreground">{clusterConfig.nNeighbors}</span>
                </div>
                <Slider
                  value={[clusterConfig.nNeighbors]}
                  onValueChange={([val]) => setClusterConfig(prev => ({ ...prev, nNeighbors: val }))}
                  min={15}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Higher = more global structure, lower noise
                </p>
              </div>

              {/* Min Cluster Size Slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs font-medium">Min Cluster Size</Label>
                  <span className="text-xs text-muted-foreground">{clusterConfig.minClusterSize}</span>
                </div>
                <Slider
                  value={[clusterConfig.minClusterSize]}
                  onValueChange={([val]) => setClusterConfig(prev => ({ ...prev, minClusterSize: val }))}
                  min={5}
                  max={50}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum points needed to form a cluster
                </p>
              </div>

              {/* Min Samples Slider */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs font-medium">Min Samples</Label>
                  <span className="text-xs text-muted-foreground">{clusterConfig.minSamples}</span>
                </div>
                <Slider
                  value={[clusterConfig.minSamples]}
                  onValueChange={([val]) => setClusterConfig(prev => ({ ...prev, minSamples: val }))}
                  min={1}
                  max={15}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Lower = fewer outliers, more cluster members
                </p>
              </div>

              {/* Re-cluster Button */}
              <Button
                onClick={handleRecluster}
                disabled={isReclustering || !layer.points.length}
                className="w-full"
                size="sm"
              >
                {isReclustering ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Re-clustering...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Re-cluster with New Parameters
                  </>
                )}
              </Button>

              {/* Future Features (disabled) */}
              <div className="pt-2 border-t space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Coming Soon</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled
                  >
                    <Tags className="h-3 w-3 mr-1" />
                    Name Clusters
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    disabled
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Eval Coherence
                  </Button>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Visualization */}
      <div className="flex-1 min-h-0">
        <EmbeddingAtlasComponent
          key={`atlas-${layer.id}-${viewConfigVersion}`}
          coordinator={coordinator}
          data={dataConfig}
          colorScheme={colorScheme}
          searcher={searcher}
          embeddingViewConfig={embeddingViewConfig}
          initialState={initialAtlasState}
          onStateChange={handleAtlasStateChange}
          onExportSelection={handleExportSelection}
        />
      </div>
    </div>
  );
}

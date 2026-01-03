'use client';

/**
 * ClusterManagementDialog Component
 *
 * Main dialog for cluster management with three tabs:
 * - Overview: View and name clusters
 * - Agglomerate: Merge similar clusters
 * - Validate: (Coming soon) LLM validation of cluster quality
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import {
  Loader2,
  Sparkles,
  RefreshCw,
  BarChart3,
  GitMerge,
  ShieldCheck,
  Settings,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

import { ClusterCard } from './ClusterCard';
import { AgglomerateTab, type AgglomerativeResult } from './AgglomerateTab';
import { ProviderSelector } from '@/components/spreadsheet/ProviderSelector';
import { ModelSelector } from '@/components/spreadsheet/ModelSelector';

import type { ActiveEmbeddingLayer } from '@/types/embedding';
import type { ModelProvider, Model } from '@/types/models';
import {
  type ClusterLabel,
  saveClusterLabel,
  saveClusterLabels,
  getClusterLabels,
  deleteAllClusterLabels,
  mergeClusterIds,
  dropLayerTable,
  createLayerTable,
} from '@/lib/embedding/storage';
import {
  labelAllClusters,
  sampleAllClusterExamples,
  clearLabelCache,
} from '@/lib/embedding/cluster-similarity';

interface ClusterManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layer: ActiveEmbeddingLayer;
  fileId: string;
  onLayerUpdate?: (layer: ActiveEmbeddingLayer) => void;
  onViewConfigUpdate?: () => void;
  onRecluster?: (params: { nNeighbors: number; minClusterSize: number; minSamples: number }) => Promise<void>;
  isReclustering?: boolean;
}

export function ClusterManagementDialog({
  open,
  onOpenChange,
  layer,
  fileId,
  onLayerUpdate,
  onViewConfigUpdate,
  onRecluster,
  isReclustering = false,
}: ClusterManagementDialogProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'agglomerate' | 'validate'>('overview');

  // Cluster data
  const [clusterLabels, setClusterLabels] = useState<Map<number, ClusterLabel>>(new Map());
  const [clusterExamples, setClusterExamples] = useState<Map<number, string[]>>(new Map());

  // Naming state
  const [isNaming, setIsNaming] = useState(false);
  const [editingClusterId, setEditingClusterId] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider | undefined>();
  const [selectedModel, setSelectedModel] = useState<Model | undefined>();
  const [showNamingConfig, setShowNamingConfig] = useState(false);

  // Re-clustering state
  const [showReclusterConfirm, setShowReclusterConfirm] = useState(false);
  const [reclusterParams, setReclusterParams] = useState({
    nNeighbors: layer.clusterConfig?.nNeighbors || 30,
    minClusterSize: layer.clusterConfig?.minClusterSize || 10,
    minSamples: layer.clusterConfig?.minSamples || 3,
  });

  // Pagination for cluster cards
  const INITIAL_VISIBLE_COUNT = 8;
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  // Get cluster stats from layer
  const clusterStats = layer.clusterStats;
  const clusterSizes = clusterStats?.clusterSizes || {};
  const clusterIds = Object.keys(clusterSizes)
    .map(Number)
    .filter(id => id !== -1)
    .sort((a, b) => a - b);

  // Get visible cluster IDs
  const visibleClusterIds = clusterIds.slice(0, visibleCount);
  const hasMoreClusters = clusterIds.length > visibleCount;
  const remainingCount = clusterIds.length - visibleCount;

  // Check if any clusters are named
  const hasNamedClusters = clusterLabels.size > 0;
  const allClustersNamed = clusterIds.length > 0 && clusterIds.every(id => clusterLabels.has(id));

  // Load cluster labels and examples on open
  useEffect(() => {
    if (open && layer.id) {
      loadClusterData();
      // Reset visible count when dialog opens
      setVisibleCount(INITIAL_VISIBLE_COUNT);
    }
  }, [open, layer.id]);

  const loadClusterData = async () => {
    try {
      // Load labels from DuckDB
      const labels = await getClusterLabels(layer.id);
      setClusterLabels(labels);

      // Load examples for all clusters
      const examples = await sampleAllClusterExamples(layer.id, 3, 150);
      setClusterExamples(examples);
    } catch (err) {
      console.error('[ClusterManagement] Error loading cluster data:', err);
      toast.error('Failed to load cluster data');
    }
  };

  // Handle naming all clusters
  const handleNameAllClusters = async () => {
    if (!selectedProvider || !selectedModel) {
      toast.error('Please select a provider and model');
      return;
    }

    setIsNaming(true);

    try {
      // Call the labeling function
      const results = await labelAllClusters(layer.id, {
        sampleSize: 5,
        providerId: selectedProvider.id,
        modelId: selectedModel.id,
        concurrency: 3,
      });

      // Convert results to ClusterLabel format and save to DuckDB
      const labelsToSave: ClusterLabel[] = [];
      results.forEach((label, clusterId) => {
        labelsToSave.push({
          clusterId,
          title: label.title,
          labels: label.labels,
          description: label.description,
        });
      });

      await saveClusterLabels(layer.id, labelsToSave);

      // Update local state
      const newLabels = new Map(clusterLabels);
      labelsToSave.forEach(label => {
        newLabels.set(label.clusterId, label);
      });
      setClusterLabels(newLabels);

      // Refresh the layer table to show new names on UMAP
      await refreshLayerTable();

      toast.success(`Named ${results.size} clusters`);
    } catch (err) {
      console.error('[ClusterManagement] Error naming clusters:', err);
      toast.error('Failed to name clusters');
    } finally {
      setIsNaming(false);
    }
  };

  // Handle editing a single cluster name
  const handleEditSave = async (clusterId: number, title: string) => {
    try {
      const existingLabel = clusterLabels.get(clusterId);
      const label: ClusterLabel = {
        clusterId,
        title,
        labels: existingLabel?.labels || [],
        description: existingLabel?.description || '',
        isManualEdit: true,
      };

      await saveClusterLabel(layer.id, label);

      // Update local state
      const newLabels = new Map(clusterLabels);
      newLabels.set(clusterId, label);
      setClusterLabels(newLabels);
      setEditingClusterId(null);

      // Refresh the layer table
      await refreshLayerTable();

      toast.success('Cluster name updated');
    } catch (err) {
      console.error('[ClusterManagement] Error saving cluster name:', err);
      toast.error('Failed to save cluster name');
    }
  };

  // Refresh the layer table to pick up new cluster names
  const refreshLayerTable = async () => {
    try {
      await dropLayerTable(layer.id);
      await createLayerTable(layer.id, fileId);
      onViewConfigUpdate?.();
    } catch (err) {
      console.error('[ClusterManagement] Error refreshing layer table:', err);
    }
  };

  // Handle agglomeration apply
  const handleAgglomerateApply = async (result: AgglomerativeResult) => {
    try {
      // Apply merges to DuckDB
      for (const superTopic of result.superTopics) {
        const [targetId, ...sourceIds] = superTopic.memberClusters;
        if (sourceIds.length > 0) {
          await mergeClusterIds(layer.id, targetId, sourceIds);
        }
      }

      // Clear label cache since clusters changed
      clearLabelCache();

      // Reload cluster data
      await loadClusterData();

      // Refresh the layer table
      await refreshLayerTable();

      // Update layer stats if callback provided
      if (onLayerUpdate && layer.clusterStats) {
        const newSizes: Record<number, number> = {};
        result.superTopics.forEach(topic => {
          const totalSize = topic.memberClusters.reduce(
            (sum, id) => sum + (clusterSizes[id] || 0),
            0
          );
          newSizes[topic.memberClusters[0]] = totalSize;
        });
        result.singletons.forEach(id => {
          newSizes[id] = clusterSizes[id] || 0;
        });

        onLayerUpdate({
          ...layer,
          clusterStats: {
            ...layer.clusterStats,
            clusterCount: result.resultingClusterCount,
            clusterSizes: newSizes,
          },
        });
      }

      setActiveTab('overview');
      toast.success(`Merged clusters: ${result.originalClusterCount} → ${result.resultingClusterCount}`);
    } catch (err) {
      console.error('[ClusterManagement] Error applying agglomeration:', err);
      toast.error('Failed to apply cluster merge');
    }
  };

  // Handle re-clustering
  const handleRecluster = async () => {
    setShowReclusterConfirm(false);

    // Clear all labels first
    await deleteAllClusterLabels(layer.id);
    clearLabelCache();
    setClusterLabels(new Map());

    // Call the parent's recluster function if provided
    if (onRecluster) {
      try {
        await onRecluster(reclusterParams);
        // Reload cluster data after re-clustering
        await loadClusterData();
        toast.success('Re-clustering complete');
      } catch (err) {
        console.error('[ClusterManagement] Re-cluster error:', err);
        toast.error('Re-clustering failed');
      }
    } else {
      // Close dialog - parent will handle re-clustering separately
      onOpenChange(false);
      toast.info('Re-clustering... please use the clustering controls in the main view');
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[85vw] max-w-5xl sm:max-w-5xl h-[80vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Cluster Management
              </DialogTitle>
              {clusterStats && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">
                    {clusterIds.length} clusters
                  </Badge>
                  {clusterStats.noiseCount > 0 && (
                    <Badge variant="secondary">
                      {clusterStats.noiseCount} noise ({clusterStats.noisePercentage.toFixed(1)}%)
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="agglomerate" className="gap-2">
                <GitMerge className="h-4 w-4" />
                Agglomerate
              </TabsTrigger>
              <TabsTrigger value="validate" disabled className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Validate
                <Badge variant="outline" className="ml-1 text-xs">
                  Soon
                </Badge>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="flex-1 min-h-0 mt-4">
              <div className="h-full flex flex-col space-y-4">
                {/* Naming Controls */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Provider/Model config - always mounted, conditionally visible */}
                  <div className={`flex items-center gap-2 p-2 bg-muted/50 rounded-lg ${showNamingConfig ? '' : 'hidden'}`}>
                    <ProviderSelector
                      selectedProvider={selectedProvider}
                      onProviderSelect={setSelectedProvider}
                    />
                    <ModelSelector
                      selectedModel={selectedModel}
                      onModelSelect={setSelectedModel}
                      filterByProvider={selectedProvider?.id}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setShowNamingConfig(false)}
                      title="Hide configuration"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {!showNamingConfig && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setShowNamingConfig(true)}
                      title="Configure provider & model"
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (!selectedProvider || !selectedModel) {
                        setShowNamingConfig(true);
                        toast.info('Please select a provider and model first');
                        return;
                      }
                      handleNameAllClusters();
                    }}
                    disabled={isNaming}
                    className="gap-2"
                  >
                    {isNaming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Naming...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        {allClustersNamed ? 'Re-name All' : 'Name All Clusters'}
                      </>
                    )}
                  </Button>
                  {hasNamedClusters && (
                    <Badge variant="secondary">
                      {clusterLabels.size}/{clusterIds.length} named
                    </Badge>
                  )}
                </div>

                {/* Cluster Cards Grid */}
                <ScrollArea className="flex-1 min-h-0">
                  <div className="space-y-4 pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {visibleClusterIds.map((clusterId) => (
                        <ClusterCard
                          key={clusterId}
                          clusterId={clusterId}
                          pointCount={clusterSizes[clusterId] || 0}
                          examples={clusterExamples.get(clusterId) || []}
                          label={clusterLabels.get(clusterId)}
                          isEditing={editingClusterId === clusterId}
                          onEditStart={() => setEditingClusterId(clusterId)}
                          onEditSave={(title) => handleEditSave(clusterId, title)}
                          onEditCancel={() => setEditingClusterId(null)}
                        />
                      ))}
                      {clusterIds.length === 0 && (
                        <div className="col-span-2 text-center py-8 text-muted-foreground">
                          No clusters found. Run clustering first.
                        </div>
                      )}
                    </div>
                    {/* Show More / Show Less Button */}
                    {clusterIds.length > INITIAL_VISIBLE_COUNT && (
                      <div className="flex justify-center pt-2">
                        {hasMoreClusters ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setVisibleCount(clusterIds.length)}
                            className="gap-2"
                          >
                            Show {remainingCount} more cluster{remainingCount !== 1 ? 's' : ''}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setVisibleCount(INITIAL_VISIBLE_COUNT)}
                            className="text-muted-foreground"
                          >
                            Show less
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Advanced Settings (Re-cluster) */}
                <Accordion type="single" collapsible className="w-full border-t pt-4">
                  <AccordionItem value="recluster" className="border-none">
                    <AccordionTrigger className="text-sm font-medium py-2">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Advanced Settings
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-6 pt-2">
                        {/* UMAP Neighbors */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">UMAP Neighbors</Label>
                            <span className="text-sm text-muted-foreground">
                              {reclusterParams.nNeighbors}
                            </span>
                          </div>
                          <Slider
                            value={[reclusterParams.nNeighbors]}
                            onValueChange={([v]) =>
                              setReclusterParams(p => ({ ...p, nNeighbors: v }))
                            }
                            min={15}
                            max={100}
                            step={1}
                          />
                          <p className="text-xs text-muted-foreground">
                            Higher = more global structure
                          </p>
                        </div>

                        {/* Min Cluster Size */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Min Cluster Size</Label>
                            <span className="text-sm text-muted-foreground">
                              {reclusterParams.minClusterSize}
                            </span>
                          </div>
                          <Slider
                            value={[reclusterParams.minClusterSize]}
                            onValueChange={([v]) =>
                              setReclusterParams(p => ({ ...p, minClusterSize: v }))
                            }
                            min={2}
                            max={50}
                            step={1}
                          />
                          <p className="text-xs text-muted-foreground">
                            Min points to form a cluster
                          </p>
                        </div>

                        {/* Min Samples */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Min Samples</Label>
                            <span className="text-sm text-muted-foreground">
                              {reclusterParams.minSamples}
                            </span>
                          </div>
                          <Slider
                            value={[reclusterParams.minSamples]}
                            onValueChange={([v]) =>
                              setReclusterParams(p => ({ ...p, minSamples: v }))
                            }
                            min={1}
                            max={20}
                            step={1}
                          />
                          <p className="text-xs text-muted-foreground">
                            Core point threshold for HDBSCAN
                          </p>
                        </div>

                        <Button
                          variant="default"
                          className="w-full gap-2"
                          onClick={() => setShowReclusterConfirm(true)}
                          disabled={isReclustering}
                        >
                          {isReclustering ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Re-clustering...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4" />
                              Re-cluster
                            </>
                          )}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </TabsContent>

            {/* Agglomerate Tab */}
            <TabsContent value="agglomerate" className="flex-1 min-h-0 mt-4">
              <ScrollArea className="h-full">
                <div className="pr-4">
                  <AgglomerateTab
                    layerId={layer.id}
                    clusterLabels={clusterLabels}
                    clusterSizes={clusterSizes}
                    onApply={handleAgglomerateApply}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Validate Tab (Placeholder) */}
            <TabsContent value="validate" className="flex-1 min-h-0 mt-4">
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <ShieldCheck className="h-12 w-12 mx-auto opacity-50" />
                  <p className="text-sm">LLM Validation Coming Soon</p>
                  <p className="text-xs">
                    Validate cluster quality and get improvement suggestions.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Re-cluster Confirmation Dialog */}
      <AlertDialog open={showReclusterConfirm} onOpenChange={setShowReclusterConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-cluster will reset names</AlertDialogTitle>
            <AlertDialogDescription>
              This will run clustering again with new parameters.
              All existing cluster names will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecluster}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

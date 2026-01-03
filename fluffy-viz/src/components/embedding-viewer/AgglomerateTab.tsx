'use client';

/**
 * AgglomerateTab Component
 *
 * Tab content for agglomerative clustering controls:
 * - Similarity threshold slider
 * - Linkage method selection
 * - Preview and apply agglomeration results
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Loader2, GitMerge, AlertCircle, ChevronRight } from 'lucide-react';
import { agglomerativeClustering } from '@/lib/embedding/cluster-similarity';
import type { ClusterLabel } from '@/lib/embedding/storage';

// Types for agglomerative clustering results
export interface SuperTopic {
  id: number;
  memberClusters: number[];
  mergeOrder: number;
}

export interface AgglomerativeResult {
  threshold: number;
  linkage: 'single' | 'complete' | 'average';
  superTopics: SuperTopic[];
  singletons: number[];
  originalClusterCount: number;
  resultingClusterCount: number;
}

interface AgglomerateTabProps {
  layerId: string;
  clusterLabels: Map<number, ClusterLabel>;
  clusterSizes: Record<number, number>;
  onApply: (result: AgglomerativeResult) => void;
}

export function AgglomerateTab({
  layerId,
  clusterLabels,
  clusterSizes,
  onApply,
}: AgglomerateTabProps) {
  const [threshold, setThreshold] = useState(0.75);
  const [linkage, setLinkage] = useState<'single' | 'complete' | 'average'>('average');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<AgglomerativeResult | null>(null);

  const handlePreview = async () => {
    setIsLoading(true);
    setError(null);
    setPreviewResult(null);

    try {
      // Call the agglomerative clustering function
      const result = await agglomerativeClustering(layerId, threshold, linkage);

      // Transform the result into our format
      // The result.superTopics has clusters with more than 1 member
      // Singletons are topics with only 1 cluster
      const superTopics: SuperTopic[] = [];
      const singletons: number[] = [];

      // Process the dendrogram result
      // result.superTopics uses 'clusters' property (not 'memberClusters')
      if (result.superTopics) {
        result.superTopics.forEach((topic, idx) => {
          if (topic.clusters && topic.clusters.length > 1) {
            superTopics.push({
              id: idx,
              memberClusters: topic.clusters,
              mergeOrder: idx,
            });
          } else if (topic.clusters && topic.clusters.length === 1) {
            singletons.push(topic.clusters[0]);
          }
        });
      }

      const originalCount = Object.keys(clusterSizes).length;
      const resultingCount = superTopics.length + singletons.length;

      setPreviewResult({
        threshold,
        linkage,
        superTopics,
        singletons,
        originalClusterCount: originalCount,
        resultingClusterCount: resultingCount,
      });
    } catch (err) {
      console.error('[AgglomerateTab] Preview error:', err);
      setError(err instanceof Error ? err.message : 'Failed to compute clustering');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = () => {
    if (previewResult) {
      onApply(previewResult);
    }
  };

  const getClusterDisplayName = (clusterId: number): string => {
    const label = clusterLabels.get(clusterId);
    return label?.title || `Cluster ${clusterId}`;
  };

  const getClusterSize = (clusterId: number): number => {
    return clusterSizes[clusterId] || 0;
  };

  const getMergedSize = (clusterIds: number[]): number => {
    return clusterIds.reduce((sum, id) => sum + getClusterSize(id), 0);
  };

  return (
    <div className="space-y-6">
      {/* Threshold Control */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Similarity Threshold</Label>
          <span className="text-sm font-mono text-muted-foreground">
            {threshold.toFixed(2)}
          </span>
        </div>
        <Slider
          value={[threshold]}
          onValueChange={([v]) => {
            setThreshold(v);
            setPreviewResult(null);
          }}
          min={0}
          max={1}
          step={0.01}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          Higher values require more similar clusters to merge.
          Typical range: 0.70 - 0.90
        </p>
      </div>

      {/* Advanced Settings */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="advanced" className="border-none">
          <AccordionTrigger className="text-sm font-medium py-2">
            Advanced Settings
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pt-2">
              <Label className="text-sm">Linkage Method</Label>
              <RadioGroup
                value={linkage}
                onValueChange={(v) => {
                  setLinkage(v as 'single' | 'complete' | 'average');
                  setPreviewResult(null);
                }}
                className="space-y-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="average" id="linkage-average" />
                  <Label htmlFor="linkage-average" className="text-sm font-normal">
                    Average (recommended)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="complete" id="linkage-complete" />
                  <Label htmlFor="linkage-complete" className="text-sm font-normal">
                    Complete (conservative)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="single" id="linkage-single" />
                  <Label htmlFor="linkage-single" className="text-sm font-normal">
                    Single (aggressive)
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Linkage determines how inter-cluster distance is measured.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Preview Button */}
      <Button
        onClick={handlePreview}
        disabled={isLoading}
        className="w-full"
        variant="outline"
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Computing...
          </>
        ) : (
          <>
            <GitMerge className="h-4 w-4 mr-2" />
            Preview Agglomeration
          </>
        )}
      </Button>

      {/* Error Display */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {/* Preview Results */}
      {previewResult && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Preview Results</h4>
            <Badge variant="secondary">
              {previewResult.originalClusterCount} → {previewResult.resultingClusterCount} clusters
            </Badge>
          </div>

          {/* Super-topics */}
          {previewResult.superTopics.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Merged Groups ({previewResult.superTopics.length})
              </Label>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2 pr-4">
                  {previewResult.superTopics.map((topic) => (
                    <div
                      key={topic.id}
                      className="p-2 bg-muted/50 rounded-md space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">
                          Super-topic {topic.id + 1}
                        </span>
                        <span className="text-muted-foreground">
                          {getMergedSize(topic.memberClusters)} points
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {topic.memberClusters.map((clusterId, idx) => (
                          <span key={clusterId} className="flex items-center text-xs">
                            <Badge variant="outline" className="text-xs">
                              {getClusterDisplayName(clusterId)}
                            </Badge>
                            {idx < topic.memberClusters.length - 1 && (
                              <ChevronRight className="h-3 w-3 mx-0.5 text-muted-foreground" />
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Singletons */}
          {previewResult.singletons.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Unchanged Clusters ({previewResult.singletons.length})
              </Label>
              <div className="flex flex-wrap gap-1">
                {previewResult.singletons.slice(0, 10).map((clusterId) => (
                  <Badge key={clusterId} variant="secondary" className="text-xs">
                    {getClusterDisplayName(clusterId)}
                  </Badge>
                ))}
                {previewResult.singletons.length > 10 && (
                  <Badge variant="secondary" className="text-xs">
                    +{previewResult.singletons.length - 10} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Apply/Cancel */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleApply} className="flex-1">
              Apply Merge
            </Button>
            <Button
              variant="outline"
              onClick={() => setPreviewResult(null)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Manual Agglomeration (Coming Soon) */}
      <div className="opacity-50 pointer-events-none">
        <div className="flex items-center gap-2 mb-2">
          <Label className="text-sm font-medium">Manual Agglomeration</Label>
          <Badge variant="outline" className="text-xs">
            Coming Soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Drag and drop clusters to manually create super-topics.
        </p>
      </div>
    </div>
  );
}

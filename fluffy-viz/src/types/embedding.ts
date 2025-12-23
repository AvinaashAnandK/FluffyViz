/**
 * Embedding system type definitions
 * Supports multiple embedding layers per file with different composition strategies
 */

export type CompositionMode = 'single' | 'multi' | 'conversational';

export type ConversationalStrategy =
  | 'turn-only'
  | 'history-until'
  | 'turn-plus-n'
  | 'full-conversation';

export interface SingleCompositionConfig {
  sourceColumn: string;
}

export interface MultiCompositionConfig {
  columns: string[];
  separator: string; // "\n", ", ", " | "
}

export interface ConversationalCompositionConfig {
  conversationIdColumn: string; // "session_id"
  sequenceColumn: string; // "timestamp"
  strategy: ConversationalStrategy;
  contextSize?: number; // For "turn-plus-n"
  turnFormatColumns: string[]; // ["role", "message"]
}

export type CompositionConfig =
  | { mode: 'single'; config: SingleCompositionConfig }
  | { mode: 'multi'; config: MultiCompositionConfig }
  | { mode: 'conversational'; config: ConversationalCompositionConfig };

export interface NeighborData {
  ids: string[]; // IDs of k-nearest neighbors
  distances: number[]; // Distances to each neighbor
}

export interface EmbeddingPoint {
  id: string; // "point_0"
  embedding: number[]; // The vector [0.123, -0.456, ...]
  coordinates2D: [number, number]; // Pre-computed UMAP/t-SNE
  sourceRowIndices: number[]; // Maps to source file rows
  label?: string; // For conversation-level: the conversation ID
  composedText: string; // The text that was embedded
  metadata?: Record<string, unknown>; // Aggregated metadata for conversation-level
  neighbors?: NeighborData; // Pre-computed k-nearest neighbors for fast search
  clusterId?: number; // HDBSCAN cluster assignment (-1 = noise/outlier)
}

// Clustering configuration
export interface ClusterConfig {
  minClusterSize: number;  // Minimum points to form a cluster (default: 10, range: 5-50)
  minSamples: number;      // Core point threshold (default: 5, range: 1-15)
  nNeighbors: number;      // UMAP n_neighbors for clustering projection (default: 30, range: 15-100)
}

export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  minClusterSize: 10,  // Reasonable default for most datasets
  minSamples: 5,       // Core point threshold
  nNeighbors: 30,      // UMAP neighborhood size for clustering
};

// Cluster statistics after running HDBSCAN
export interface ClusterStats {
  clusterCount: number;              // Number of clusters found (excluding noise)
  noiseCount: number;                // Number of noise/outlier points
  noisePercentage: number;           // Percentage of points that are noise
  clusterSizes: Record<number, number>;  // Cluster ID → point count (JSON-serializable)
}

export interface EmbeddingLayerMetadata {
  id: string;
  name: string; // User-friendly: "Conversation History View"
  isActive: boolean; // Only one active at a time
  pointCount: number;
  compositionMode: CompositionMode;
  createdAt: string;
}

export interface ActiveEmbeddingLayer {
  id: string; // "emb_abc123"
  fileId: string;
  name: string; // User-provided name

  // Generation config
  provider: string; // "voyageai", "openai", "cohere"
  model: string; // "voyage-3-lite", "text-embedding-3-small"
  dimension: number; // 768, 1536, 3072, etc.

  compositionMode: CompositionMode;
  compositionConfig: CompositionConfig;

  // Clustering config and results
  clusterConfig?: ClusterConfig;
  clusterStats?: ClusterStats;

  // The actual embeddings + visualization data
  points: EmbeddingPoint[];

  // Metadata
  createdAt: string;
  lastAccessedAt: string;
}

export interface StoredFile {
  id: string;
  name: string;
  data: { columns: string[]; rows: unknown[][] };
  embeddingLayers: EmbeddingLayerMetadata[];
  embeddingCompositionColumns: string[]; // ["_embedding_composition_1", "_embedding_composition_2"]
  nextCompositionColumnNumber: number; // For auto-incrementing column names
}

export interface UMAPParams {
  n_neighbors: number;
  min_dist: number;
  metric: 'cosine' | 'euclidean';
}

export interface WizardState {
  step: number;
  name: string;
  provider: string;
  model: string;
  dimension: number;
  compositionMode: CompositionMode;
  compositionConfig: Partial<SingleCompositionConfig & MultiCompositionConfig & ConversationalCompositionConfig>;
  clusterConfig: ClusterConfig;
}

export interface GenerationProgress {
  phase: 'composing' | 'embedding' | 'clustering' | 'projecting' | 'storing' | 'complete';
  current: number;
  total: number;
  message: string;
}

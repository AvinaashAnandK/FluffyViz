# FluffyViz Technical Documentation

## Architecture Overview

FluffyViz is a client-side web application built with Next.js 15 (App Router), React 19, and TypeScript. All data processing occurs in the browser using DuckDB WASM for storage and querying.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Browser Environment                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Next.js 15 App Router                            │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐    │    │
│  │  │   Pages &    │  │     API      │  │      Components        │    │    │
│  │  │   Layouts    │  │    Routes    │  │   (React 19 + shadcn)  │    │    │
│  │  └──────────────┘  └──────────────┘  └────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                       │                                      │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          Data Layer                                  │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │    │
│  │  │   DuckDB WASM    │  │  Format Parser   │  │   File Storage   │  │    │
│  │  │  (IndexedDB)     │  │  (Auto-detect)   │  │   Abstraction    │  │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                       │                                      │
│                                       ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        AI Integration                                │    │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │    │
│  │  │  Vercel AI SDK   │  │   Web Search     │  │    Embedding     │  │    │
│  │  │  (10+ providers) │  │   + Sources      │  │  UMAP + Cluster  │  │    │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.x | App Router, API routes, Turbopack |
| React | 19.x | UI components with React Compiler |
| TypeScript | 5.x | Strict type checking |
| Tailwind CSS | 4.x | Utility-first styling |

### Data & Storage
| Package | Purpose |
|---------|---------|
| @duckdb/duckdb-wasm | In-browser SQL database |
| @uwdata/mosaic-core | Data binding for visualizations |
| papaparse | CSV parsing |
| js-yaml | YAML template parsing |
| zod | Schema validation |

### AI Integration
| Package | Purpose |
|---------|---------|
| ai (Vercel AI SDK) | Unified LLM interface |
| @ai-sdk/openai | OpenAI models + web search |
| @ai-sdk/anthropic | Claude models |
| @ai-sdk/google | Gemini models + grounding |
| @ai-sdk/perplexity | Perplexity models (built-in search) |
| @ai-sdk/groq | Groq models |
| @ai-sdk/mistral | Mistral models |
| @ai-sdk/cohere | Cohere models |
| @huggingface/inference | HuggingFace API |
| umap-js | Dimensionality reduction |
| hdbscan-ts | Density-based clustering |
| ml-kmeans | K-Means clustering with silhouette |
| tiktoken | Token counting |

### UI Components
| Package | Purpose |
|---------|---------|
| @radix-ui/* | Accessible primitives (via shadcn) |
| @tiptap/react | Rich text editor |
| lucide-react | Icon library |
| sonner | Toast notifications |
| cmdk | Command palette |
| embedding-atlas | Interactive scatter plot |

---

## Project Structure

```
fluffy-viz/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── page.tsx                  # Home page (file upload)
│   │   ├── layout.tsx                # Root layout
│   │   ├── edit/[fileId]/page.tsx    # Spreadsheet editor
│   │   └── api/                      # API routes
│   │       ├── generate-column/      # AI inference endpoint
│   │       ├── model-registry/       # Model definitions API
│   │       ├── prompts/[templateId]/ # Template loader
│   │       └── provider-config/      # Provider settings
│   │
│   ├── components/
│   │   ├── spreadsheet/              # Data editing components
│   │   │   ├── SpreadsheetEditor.tsx # Main editor
│   │   │   ├── SpreadsheetTable.tsx  # Table rendering
│   │   │   ├── AddColumnModal.tsx    # AI column workflow
│   │   │   ├── GenerationSettings.tsx# Temperature, tokens, web search
│   │   │   ├── PromptComposer.tsx    # TipTap editor
│   │   │   ├── ModelSelector.tsx     # Model search
│   │   │   ├── ProviderSelector.tsx  # Provider filtering
│   │   │   ├── ConversationalHistoryConfig.tsx
│   │   │   ├── AiCell.tsx            # Cell with status
│   │   │   └── RetryModal.tsx        # Retry failed cells
│   │   │
│   │   ├── embedding-viewer/         # Visualization components
│   │   │   ├── embedding-wizard.tsx  # Multi-step wizard
│   │   │   ├── embedding-visualization.tsx # Atlas integration
│   │   │   ├── agent-trace-viewer.tsx # Main container
│   │   │   └── save-filter-modal.tsx # Filter persistence
│   │   │
│   │   ├── ui/                       # shadcn/ui components
│   │   └── ...                       # Other components
│   │
│   ├── lib/
│   │   ├── ai-inference.ts           # LLM + web search integration
│   │   ├── format-detector.ts        # Format auto-detection
│   │   ├── format-parser.ts          # Data parsing & flattening
│   │   ├── conversational-history.ts # Turn aggregation
│   │   ├── prompt-serializer.ts      # TipTap → template conversion
│   │   ├── models.ts                 # Model utilities
│   │   ├── providers.ts              # Provider definitions
│   │   ├── error-messages.ts         # Error classification
│   │   │
│   │   ├── duckdb/                   # Database layer
│   │   │   ├── index.ts              # Main export
│   │   │   ├── client.ts             # DuckDB WASM client
│   │   │   ├── schema.ts             # Table schemas
│   │   │   ├── operations.ts         # CRUD operations
│   │   │   ├── file-storage.ts       # File persistence
│   │   │   └── types.ts              # Type definitions
│   │   │
│   │   └── embedding/                # Embedding pipeline
│   │       ├── text-composer.ts      # Composition strategies
│   │       ├── batch-embedder.ts     # Batch processing
│   │       ├── umap-reducer.ts       # UMAP projection (2-stage)
│   │       ├── clustering.ts         # Hybrid HDBSCAN + K-Means
│   │       ├── kmeans.ts             # K-Means with silhouette scoring
│   │       ├── cluster-similarity.ts # Console tools for cluster analysis
│   │       ├── clustering-coords-storage.ts # OPFS storage for 15D coords
│   │       ├── knn.ts                # K-nearest neighbors
│   │       ├── search.ts             # Searcher interface
│   │       └── storage.ts            # Layer persistence
│   │
│   ├── hooks/
│   │   └── use-file-storage.ts       # React abstraction
│   │
│   ├── types/
│   │   ├── agent-data.ts             # Data format types
│   │   ├── models.ts                 # AI model types
│   │   ├── web-search.ts             # Web search config types
│   │   ├── embedding.ts              # Embedding & clustering types
│   │   └── file-storage.ts           # Storage types
│   │
│   └── config/
│       ├── ai-column-templates.ts    # Template definitions
│       ├── model-registry.ts         # Client-side registry
│       ├── models/
│       │   └── model-registry.yaml   # Model definitions
│       ├── parser.config.ts          # Parser limits
│       ├── provider-settings.ts      # Provider metadata
│       └── prompts/                  # YAML template files
│           ├── *.yaml                # AI column templates
│           └── cluster-labeling.yaml # Cluster labeling prompts
│
├── CLAUDE.md                         # AI assistant context
├── PROVIDER_CONFIG.md                # Provider setup guide
└── package.json
```

---

## Core Data Flow

### 1. File Upload & Parsing

```
File upload
  → FormatDetector.detectFormat(content)     // Confidence scoring
  → parseFileContent(content, format)        // Flatten nested data
  → saveFileToDuckDB(normalizedData)         // Persist to DuckDB
  → router.push(`/edit/${fileId}`)
```

**Key Files**:
- `src/lib/format-detector.ts` - Detection with confidence scores
- `src/lib/format-parser.ts` - Parsing with memoization (LRU cache)
- `src/lib/duckdb/file-storage.ts` - Storage abstraction

**Flattening Algorithm**:
```typescript
// Input
{ user: { name: "Alice", meta: { role: "admin" } } }

// Output
{ "user.name": "Alice", "user.meta.role": "admin" }
```

Configuration (`src/config/parser.config.ts`):
- `maxFlattenDepth: 10`
- `maxArrayLength: 1000`
- `maxStringLength: 10000`

### 2. Spreadsheet Rendering

```
useFileStorage.getFile(fileId)
  → queryFileDataWithMetadata(fileId, options)  // DuckDB query
  → SpreadsheetTable renders with pagination
  → Sorting/filtering via SQL WHERE/ORDER BY
```

**Key Files**:
- `src/components/spreadsheet/SpreadsheetEditor.tsx`
- `src/components/spreadsheet/SpreadsheetTable.tsx`
- `src/lib/duckdb/operations.ts`

### 3. AI Column Generation

```
AddColumnModal
  → Template selection or custom prompt
  → ModelSelector (filter by provider/capability)
  → ProviderSelector (filter by enabled/search support)
  → GenerationSettings (temperature, tokens, web search)
  → PromptComposer (TipTap with variable pills)
  → POST /api/generate-column
  → generateColumnData() with cell callbacks
  → batchUpdateColumn() saves results
  → If web search: create companion _sources column
```

**Key Files**:
- `src/components/spreadsheet/AddColumnModal.tsx`
- `src/components/spreadsheet/GenerationSettings.tsx`
- `src/components/spreadsheet/PromptComposer.tsx`
- `src/lib/ai-inference.ts`
- `src/app/api/generate-column/route.ts`

### 4. Web Search Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Search Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  AddColumnModal                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                            │
│  │ webSearch config│ { enabled, contextSize, userLocation }     │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              /api/generate-column                        │    │
│  │  ┌─────────────────────────────────────────────────┐    │    │
│  │  │  Provider Routing (ai-inference.ts)             │    │    │
│  │  │                                                  │    │    │
│  │  │  OpenAI (Responses API)                         │    │    │
│  │  │    → getWebSearchTools() → web_search_preview   │    │    │
│  │  │    → Sources from toolResults                   │    │    │
│  │  │                                                  │    │    │
│  │  │  Perplexity (Built-in)                          │    │    │
│  │  │    → getPerplexityProviderOptions()             │    │    │
│  │  │    → Location via providerOptions               │    │    │
│  │  │    → Sources from result.sources                │    │    │
│  │  │                                                  │    │    │
│  │  │  Google (Grounding)                             │    │    │
│  │  │    → googleSearch tool                          │    │    │
│  │  └─────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  SpreadsheetEditor                                       │    │
│  │    → Creates main column + {column}_sources column       │    │
│  │    → Stores sources as JSON array of URLs               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Embedding Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Embedding Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EmbeddingWizard                                                 │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────┐                                            │
│  │ 1. Compose Text │ Single / Multi / Conversational            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 2. Batch Embed  │ OpenAI / Cohere API                        │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 3. UMAP 15D     │ min_dist=0.0 (for clustering)              │
│  │    (clustering) │ nNeighbors from config                     │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ 4. Hybrid Clustering                                     │    │
│  │    ┌──────────────────────────────────────────────────┐ │    │
│  │    │ HDBSCAN on 15D UMAP → Discover k                 │ │    │
│  │    └──────────────────────────────────────────────────┘ │    │
│  │    ┌──────────────────────────────────────────────────┐ │    │
│  │    │ K-Means on original embeddings                   │ │    │
│  │    │ Test k in [k-2, k+5] with silhouette score      │ │    │
│  │    └──────────────────────────────────────────────────┘ │    │
│  │    ┌──────────────────────────────────────────────────┐ │    │
│  │    │ Final assignment: 100% points clustered         │ │    │
│  │    └──────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────┘    │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 5. Clear Memory │ Free tiktoken + UMAP before Stage 2       │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 6. UMAP 2D      │ min_dist=0.1 (for visualization)          │
│  │  (visualization)│                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 7. Compute KNN  │ k=10 neighbors per point                   │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ 8. Store Layer  │ DuckDB + OPFS (15D coords)                 │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  EmbeddingVisualization (embedding-atlas)                │    │
│  │    → Points / Density view modes                        │    │
│  │    → Auto cluster labels                                │    │
│  │    → Re-clustering with parameter tuning                │    │
│  │    → Save filter from selection                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Files**:
- `src/components/embedding-viewer/embedding-wizard.tsx`
- `src/components/embedding-viewer/embedding-visualization.tsx`
- `src/components/embedding-viewer/agent-trace-viewer.tsx`
- `src/lib/embedding/text-composer.ts`
- `src/lib/embedding/batch-embedder.ts`
- `src/lib/embedding/umap-reducer.ts`
- `src/lib/embedding/clustering.ts`
- `src/lib/embedding/kmeans.ts`
- `src/lib/embedding/clustering-coords-storage.ts`

---

## Clustering System

### Hybrid HDBSCAN + K-Means Approach

FluffyViz uses a two-stage clustering approach that combines the benefits of density-based discovery with complete point assignment:

```typescript
// src/lib/embedding/clustering.ts

export interface HybridClusterResult {
  labels: number[];              // Cluster ID per point (0 to k-1, no -1 outliers)
  clusterCount: number;          // Number of clusters
  clusterSizes: Map<number, number>;
  kEstimate: number;             // k discovered by HDBSCAN
  optimalK: number;              // k selected by silhouette score
  silhouetteScore: number;       // Best silhouette score
  method: 'hybrid';
}

/**
 * Stage 1: HDBSCAN k-discovery on 15D UMAP
 * - Runs HDBSCAN on intermediate-dimensional UMAP projection
 * - min_dist=0.0 creates tight clusters for better density detection
 * - Returns natural cluster count without requiring k upfront
 *
 * Stage 2: K-Means optimization on original embeddings
 * - L2-normalizes embeddings for cosine-like distance
 * - Tests k in range [k_estimate - 2, k_estimate + 5]
 * - Selects k with highest silhouette score
 * - Final assignment: 100% of points clustered (no outliers)
 */
export async function hybridCluster(
  umapCoords15D: number[][],
  originalEmbeddings: number[][],
  config: ClusterConfig
): Promise<HybridClusterResult>;
```

### Clustering Configuration

```typescript
// src/types/embedding.ts

export interface ClusterConfig {
  minClusterSize: number;  // 5-50, default: 10
  minSamples: number;      // 1-15, default: 3
  nNeighbors: number;      // 15-100, default: 30
}

export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  minClusterSize: 10,  // Min points to form a cluster
  minSamples: 3,       // Core point threshold for HDBSCAN
  nNeighbors: 30,      // UMAP neighborhood size
};
```

### K-Means with Silhouette Scoring

```typescript
// src/lib/embedding/kmeans.ts

/**
 * Find optimal k using silhouette score
 * Tests k values in range and returns k with highest silhouette
 */
export function findOptimalK(
  data: number[][],
  kMin: number,
  kMax: number
): { optimalK: number; scores: Map<number, number>; labels: number[] };

/**
 * Silhouette score for clustering quality
 * Higher is better: -1 (worst) to +1 (best)
 *
 * For each point:
 * - a = mean distance to points in same cluster
 * - b = mean distance to points in nearest other cluster
 * - silhouette = (b - a) / max(a, b)
 */
export function silhouetteScore(data: number[][], labels: number[]): number;
```

### Why This Approach?

1. **HDBSCAN alone** (previous approach):
   - Great at finding density-based clusters
   - Labels 50%+ points as noise/outliers
   - Inconsistent results

2. **K-Means alone**:
   - Requires knowing k upfront
   - Assigns all points (no outliers)
   - May create arbitrary clusters

3. **Hybrid approach** (current):
   - HDBSCAN discovers natural k
   - K-Means tests range with silhouette validation
   - 100% point assignment with quality metric

### Browser Console Tools for Cluster Exploration

FluffyViz provides browser console tools (`window.clusterSim`) for advanced cluster analysis, hierarchical organization, and LLM-based labeling. Access via the browser Developer Console (F12).

**Initialization:**
```javascript
// Get layer ID from the embedding visualization URL or console log
const layerId = 'emb_xxxxx';
```

#### Similarity Analysis

```javascript
// Compute cosine similarity between two cluster centroids
await clusterSim.similarity(layerId, 9, 13)
// Output: "Cluster 9 ↔ Cluster 13: 0.8234 (Similar - consider merging)"

// Find top 10 neighbors of a specific cluster
await clusterSim.neighbors(layerId, 9)
// Output: Table of clusters sorted by similarity

// Find all cluster pairs above similarity threshold
await clusterSim.findSimilar(layerId, 0.85)
// Output: List of merge candidates

// Get full pairwise similarity matrix (sorted by similarity)
await clusterSim.allSimilarities(layerId)
// Output: Complete matrix with top 15 pairs highlighted
```

#### Agglomerative Clustering

Build hierarchical super-topics by merging similar clusters:

```javascript
// Merge clusters into super-topics based on centroid similarity
// Linkage options: 'average' (default), 'single', 'complete'
await clusterSim.agglomerate(layerId, 0.80)                   // average linkage
await clusterSim.agglomerate(layerId, 0.80, 'single')         // single linkage
await clusterSim.agglomerate(layerId, 0.80, 'complete')       // complete linkage
```

**Linkage Methods:**
- **Average**: Mean similarity between all pairs (balanced approach)
- **Single**: Max similarity (closest pair) → tends to chain clusters
- **Complete**: Min similarity (furthest pair) → creates compact clusters

**Output:**
```
[Agglomerative] RESULTS (threshold=0.80, linkage=average)
Total super-topics: 12
Largest super-topic: 156 points (4 clusters)
Largest clusters: [2, 5, 11, 14]
Singletons (unmerged): 5

Top 10 Super-Topics:
┌────────┬─────────┬──────────┬─────────────────────────────────────┐
│ ST ID  │  Points │ Clusters │ Cluster IDs                         │
├────────┼─────────┼──────────┼─────────────────────────────────────┤
│      0 │     156 │        4 │ 2, 5, 11, 14                        │
│      1 │     134 │        3 │ 0, 3, 8                             │
...
```

#### LLM Cluster Labeling

Generate semantic labels for clusters using an LLM:

```javascript
// Label a single cluster
await clusterSim.labelCluster(layerId, 9)
await clusterSim.labelCluster(layerId, 9, { modelId: 'gpt-4o' })
await clusterSim.labelCluster(layerId, 9, { sampleSize: 10 })

// Label all clusters with concurrency control
await clusterSim.labelAllClusters(layerId)
await clusterSim.labelAllClusters(layerId, { concurrency: 5, modelId: 'gpt-4o' })
```

**Output:**
```json
{
  "clusterId": 9,
  "title": "Python Debugging Requests",
  "labels": ["coding", "python", "troubleshooting", "debugging"],
  "description": "Users seeking help with Python errors, exceptions, and debugging techniques."
}
```

#### Cache Management

```javascript
clusterSim.clearCache()       // Clear centroid cache (after re-clustering)
clusterSim.clearLabelCache()  // Clear LLM label cache
clusterSim.getCachedLabels()  // Get all cached labels as Map
```

**Key Files:**
- `src/lib/embedding/cluster-similarity.ts` - Console tools implementation
- `src/config/prompts/cluster-labeling.yaml` - LLM prompts for labeling
- `src/app/api/cluster-label/route.ts` - API endpoint for LLM calls

### Cluster Labeling API

The `/api/cluster-label` endpoint supports multiple prompt types for different use cases:

```typescript
interface ClusterLabelRequest {
  clusterId: number;
  samples: { user_message: string; assistant_message: string }[];
  providerId?: string;   // Default: 'openai'
  modelId?: string;      // Default: 'gpt-5.2'
  promptType?: 'cluster_label' | 'super_topic_label' | 'super_topic_validation' | 'singleton_analysis';
  context?: {            // Additional context for super-topic prompts
    threshold?: number;
    linkage?: string;
    clusterCount?: number;
    // ... other fields
  };
}
```

**Prompt Types:**
- `cluster_label`: Generate title, labels, description for a single cluster
- `super_topic_label`: Create unified label for merged super-topic
- `super_topic_validation`: Validate agglomerative clustering quality
- `singleton_analysis`: Analyze unmerged singleton clusters

### Experimental Approaches for Cluster Hierarchy

These console tools enable exploration of different approaches to building cluster hierarchies:

#### A. Embedding Agglomerative Clustering (Implemented)
Cluster on **centroid embeddings** with configurable linkage:

```javascript
// Compare linkage methods at same threshold
const avg = await clusterSim.agglomerate(layerId, 0.80, 'average');
const single = await clusterSim.agglomerate(layerId, 0.80, 'single');
const complete = await clusterSim.agglomerate(layerId, 0.80, 'complete');
```

#### B. Label Embedding Clustering (Planned)
Instead of clustering on centroids, cluster on **LLM-generated label embeddings**:
1. Generate labels for all clusters: `await clusterSim.labelAllClusters(layerId)`
2. Embed the titles/descriptions using same embedding model
3. Compute cosine similarity between label embeddings
4. Agglomerate based on label similarity

**Benefits**: Labels capture semantic meaning explicitly, more interpretable
**Drawbacks**: Requires LLM call per cluster, dependent on label quality

#### C. LLM Validation Pass (Planned)
After agglomerative clustering, validate each super-topic with LLM:
- Use `super_topic_validation` prompt from YAML
- Scores: semantic coherence, intent alignment, granularity appropriateness
- Suggestions: split, keep, or reassign clusters

#### D. Manual Merge in UI (Planned)
Let users manually merge singleton clusters in the visualization:
- Select clusters in the scatter plot
- Review cluster labels and samples
- Merge into existing super-topic or create new one

---

## Memory Management

### WASM Module Coordination

FluffyViz uses multiple WASM modules that must be carefully managed:

```typescript
// src/components/embedding-viewer/agent-trace-viewer.tsx

// Critical: Free tiktoken before UMAP to prevent memory overflow
console.log('[Embedding Generation] Freeing tiktoken encoder before UMAP...');
await freeTiktokenEncoder();

// Run first UMAP (15D for clustering)
const { coordinates: clusteringCoords } = await computeUMAPForClustering(embeddings, 15);

// Run hybrid clustering
const clusterResult = await hybridCluster(clusteringCoords, embeddings, clusterConfig);

// Critical: Clear UMAP memory before second projection
console.log('[Embedding Generation] Clearing UMAP memory before visualization projection...');
await clearUMAPMemory();

// Run second UMAP (2D for visualization)
const { coordinates2D } = await computeUMAPProjection(embeddings);
```

### OPFS Storage for Re-clustering

15D clustering coordinates are stored in Origin Private File System (OPFS) for efficient re-clustering:

```typescript
// src/lib/embedding/clustering-coords-storage.ts

export async function saveClusteringCoordinates(
  layerId: string,
  coordinates: number[][]
): Promise<void>;

export async function loadClusteringCoordinates(
  layerId: string
): Promise<number[][] | null>;
```

---

## DuckDB Integration

### Schema Overview

**File Metadata** (`file_metadata` table):
```sql
CREATE TABLE file_metadata (
  id VARCHAR PRIMARY KEY,
  name VARCHAR,
  format VARCHAR,
  size INTEGER,
  row_count INTEGER,
  column_names VARCHAR[],
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  version INTEGER
);
```

**Dynamic Data Tables** (`file_data_{fileId}`):
- Created per file with columns matching parsed data
- Supports arbitrary column additions (AI columns, _sources columns)

**Column Metadata** (`column_metadata` table):
```sql
CREATE TABLE column_metadata (
  file_id VARCHAR,
  column_id VARCHAR,
  column_name VARCHAR,
  column_type VARCHAR,      -- 'ai-generated', 'computed', 'original'
  template_id VARCHAR,
  model_id VARCHAR,
  provider VARCHAR,
  prompt_template VARCHAR,
  output_schema TEXT,       -- JSON schema for structured output
  created_at BIGINT
);
```

**Cell Metadata** (`cell_metadata` table):
```sql
CREATE TABLE cell_metadata (
  file_id VARCHAR,
  column_id VARCHAR,
  row_index INTEGER,
  status VARCHAR,           -- 'pending', 'success', 'failed'
  error VARCHAR,
  error_type VARCHAR,       -- 'rate_limit', 'auth', 'network', etc.
  edited BOOLEAN,
  last_edit_time BIGINT,
  original_value TEXT,
  sources TEXT,             -- JSON array of {url, title}
  PRIMARY KEY (file_id, column_id, row_index)
);
```

**Embedding Points** (`embedding_points` table):
```sql
CREATE TABLE embedding_points (
  layer_id VARCHAR,
  point_id VARCHAR,
  x DOUBLE,
  y DOUBLE,
  composed_text TEXT,
  cluster_id INTEGER,
  neighbors TEXT,           -- JSON array of {ids, distances}
  source_row_indices TEXT,  -- JSON array of row indices
  PRIMARY KEY (layer_id, point_id)
);
```

### Key Operations

```typescript
// src/lib/duckdb/operations.ts

// Query with pagination, sorting, filtering
export async function queryFileData(
  fileId: string,
  options: QueryOptions
): Promise<{ rows: Record<string, any>[], total: number }>;

// Add new column
export async function addColumn(
  fileId: string,
  columnId: string,
  type: string,
  defaultValue: any
): Promise<void>;

// Batch update column values
export async function batchUpdateColumn(
  fileId: string,
  columnId: string,
  updates: { rowIndex: number, value: any }[]
): Promise<void>;

// Update cluster assignments
export async function updateClusterAssignments(
  layerId: string,
  labels: number[],
  pointIds: string[]
): Promise<void>;

// Persist database to IndexedDB
export async function persistDatabase(): Promise<void>;
```

---

## AI Inference System

### Provider Architecture

```typescript
// src/config/provider-settings.ts
export const PROVIDER_SETTINGS: Record<ProviderKey, ProviderSettings> = {
  openai: {
    displayName: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    capabilities: {
      text: true,
      embedding: true,
      mmEmbedding: false,
    },
    batchSize: 5,
  },
  perplexity: {
    displayName: 'Perplexity',
    envKey: 'PERPLEXITY_API_KEY',
    capabilities: {
      text: true,
      embedding: false,
      mmEmbedding: false,
    },
    batchSize: 3,
  },
  // ... 10+ providers
};
```

### Model Registry

Models are defined in YAML and loaded via API:

```yaml
# src/config/models/model-registry.yaml
openai:
  text:
    - id: gpt-4o
      name: GPT-4o
      type: text
      apiMode: responses        # 'responses' or 'completions'
      searchSupport: true       # Can use web search
      searchBuiltIn: false      # Requires tool, not built-in
      contextWindow: 128000
      maxOutputTokens: 16384
      recommended: true

perplexity:
  text:
    - id: sonar-pro
      name: Sonar Pro
      type: text
      searchSupport: true
      searchBuiltIn: true       # Always searches, no tool needed
      recommended: true
```

### Inference Function

```typescript
// src/lib/ai-inference.ts

export async function generateCompletion(
  options: GenerateCompletionOptions
): Promise<GenerateCompletionResult> {
  const { prompt, model, provider, webSearch } = options;

  // Get AI SDK model with proper API routing
  const aiModel = getAISDKModel(
    provider.id,
    model.id,
    provider.apiKey,
    modelConfig,
    webSearch
  );

  // Get web search tools if enabled
  const tools = webSearch?.enabled
    ? getWebSearchTools(provider.id, webSearch, provider.apiKey, modelConfig)
    : undefined;

  // Get provider-specific options (e.g., Perplexity location)
  const providerOptions = provider.id === 'perplexity'
    ? getPerplexityProviderOptions(webSearch)
    : undefined;

  // Generate with Vercel AI SDK
  const result = await generateText({
    model: aiModel,
    prompt,
    temperature,
    ...(tools && { tools, maxSteps: 3 }),
    ...(providerOptions && { providerOptions }),
  });

  // Extract sources from multiple locations
  const sources = extractSources(result, provider.id);

  return {
    content: result.text,
    sources,
  };
}
```

---

## Type Definitions

### Embedding Types

```typescript
// src/types/embedding.ts

export type CompositionMode = 'single' | 'multi' | 'conversational';

export type ConversationalStrategy =
  | 'turn-only'
  | 'history-until'
  | 'turn-plus-n'
  | 'full-conversation';

export interface ClusterConfig {
  minClusterSize: number;  // 5-50, default: 10
  minSamples: number;      // 1-15, default: 3
  nNeighbors: number;      // 15-100, default: 30
}

export interface ClusterStats {
  clusterCount: number;
  noiseCount: number;
  noisePercentage: number;
  clusterSizes: Record<number, number>;
}

export interface EmbeddingPoint {
  id: string;
  embedding: number[];
  coordinates2D: [number, number];
  sourceRowIndices: number[];
  label?: string;
  composedText: string;
  metadata?: Record<string, unknown>;
  neighbors?: NeighborData;
  clusterId?: number;
}

export interface ActiveEmbeddingLayer {
  id: string;
  fileId: string;
  name: string;
  provider: string;
  model: string;
  dimension: number;
  compositionMode: CompositionMode;
  compositionConfig: CompositionConfig;
  clusterConfig?: ClusterConfig;
  clusterStats?: ClusterStats;
  points: EmbeddingPoint[];
  createdAt: string;
  lastAccessedAt: string;
}
```

### Model Types

```typescript
// src/types/models.ts

export interface Model {
  id: string;
  name: string;
  provider: string;
  searchSupport?: boolean;
  searchBuiltIn?: boolean;
  apiMode?: 'responses' | 'completions';
}

export interface ModelProvider {
  id: string;
  name: string;
  displayName: string;
  apiKey: string;
}
```

### Web Search Types

```typescript
// src/types/web-search.ts

export interface WebSearchConfig {
  enabled: boolean;
  contextSize: 'low' | 'medium' | 'high';
  userLocation?: {
    type: 'approximate';
    city?: string;
    region?: string;
    country?: string;  // ISO code: IN, US, GB
  };
}

export interface SearchSource {
  url: string;
  title?: string;
  snippet?: string;
}
```

---

## API Routes

### Generate Column

**Endpoint**: `POST /api/generate-column`

```typescript
// Request
{
  rows: Array<{ data: Record<string, any> }>;
  columnId: string;
  promptTemplate: string;
  model: { id: string; name: string };
  provider: { id: string; apiKey: string };
  columnReferences: string[];
  outputSchema?: { mode: string; fields: SchemaField[] };
  webSearch?: WebSearchConfig;
}

// Response (streaming)
{
  type: 'result';
  rowIndex: number;
  content: string;
  sources?: SearchSource[];
  error?: string;
  errorType?: string;
}
```

### Model Registry

**Endpoint**: `GET /api/model-registry`

Returns parsed YAML model definitions with provider injection.

### Provider Config

**Endpoint**: `GET/POST /api/provider-config`

Reads/writes `provider-config.json` with API keys and capabilities.

### Cluster Label

**Endpoint**: `POST /api/cluster-label`

Generates semantic labels for clusters using LLM.

```typescript
// Request
{
  clusterId: number;
  samples: Array<{ user_message: string; assistant_message: string }>;
  providerId?: string;   // Default: 'openai'
  modelId?: string;      // Default: 'gpt-5.2'
  promptType?: 'cluster_label' | 'super_topic_label' | 'super_topic_validation' | 'singleton_analysis';
  context?: {            // Additional context for super-topic prompts
    threshold?: number;
    linkage?: string;
    clusterCount?: number;
    clusterSummaries?: string;
    // ... other fields
  };
}

// Response
{
  clusterId: number;
  promptType: string;
  title: string;
  labels: string[];
  description: string;
}
```

**Prompt Types:**
- `cluster_label`: Basic cluster labeling (title, labels, description)
- `super_topic_label`: Label for merged super-topic
- `super_topic_validation`: Validate agglomerative clustering quality
- `singleton_analysis`: Analyze unmerged singleton clusters

Prompts are defined in `src/config/prompts/cluster-labeling.yaml`.

---

## Visualization Controls

### View Configuration

```typescript
// src/components/embedding-viewer/embedding-visualization.tsx

interface EmbeddingViewConfig {
  mode: 'points' | 'density';        // View mode
  minimumDensity?: number;           // Density threshold (0.001-0.1)
  pointSize?: number;                // Point size (1-20, null = auto)
  autoLabelEnabled?: boolean;        // Enable auto cluster labels
  autoLabelDensityThreshold?: number; // Label threshold (0.01-0.5)
}
```

### Re-clustering

```typescript
const handleRecluster = async () => {
  // Load 15D coords from OPFS
  const clusteringCoords = await loadClusteringCoordinates(layer.id);

  // Run hybrid clustering
  const result = await hybridCluster(clusteringCoords, originalEmbeddings, clusterConfig);

  // Update DuckDB
  await updateClusterAssignments(layer.id, result.labels, pointIds);
  await updateClusterMetadata(layer.id, clusterConfig, newStats);

  // Force visualization refresh
  setViewConfigVersion(v => v + 1);
};
```

---

## Testing

### Test Structure

```
src/
├── lib/
│   └── __tests__/
│       ├── format-parser.test.ts
│       ├── ai-inference.test.ts
│       └── prompt-serializer.test.ts
├── hooks/
│   └── __tests__/
│       └── use-file-storage.test.ts
└── lib/duckdb/
    └── __tests__/
        ├── client.test.ts
        └── operations.test.ts
```

### Running Tests

```bash
npm test                    # All tests
npm run test:watch          # Watch mode
npm test -- --coverage      # With coverage
```

---

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm start            # Run production build
npm run lint         # ESLint
npx tsc --noEmit     # Type checking
```

---

## Environment Variables

Provider API keys can be set as environment variables:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
PERPLEXITY_API_KEY=pplx-...
HUGGINGFACE_API_KEY=hf_...
```

Or configured via UI (stored in `provider-config.json`, gitignored).

---

## Known Issues

### Search-Preview Models

Models like `gpt-4o-search-preview` don't work due to an AI SDK bug parsing the `annotations` field in ChatCompletions responses.

**Workaround**: Use Responses API models with `web_search_preview` tool or Perplexity with built-in search.

Tracked at: https://github.com/vercel/ai/issues/5834

---

## Performance Optimizations

- **Parser Memoization**: LRU cache for `flattenObject()`
- **DuckDB Queries**: SQL-level pagination, filtering, sorting
- **Lazy Loading**: Heavy components loaded dynamically
- **Debouncing**: 300ms for search/filter inputs
- **Batch Processing**: AI inference and DuckDB updates batched
- **Memory Management**: WASM modules freed between operations
- **OPFS Storage**: 15D coords stored for efficient re-clustering

---

## Browser Compatibility

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

Requires: IndexedDB, Web Workers, ES2020+, OPFS

---

## Contributing

### Adding a New Provider

1. Add to `ProviderKey` type in `src/types/models.ts`
2. Add settings in `src/config/provider-settings.ts`
3. Add SDK import in `src/lib/ai-inference.ts`
4. Add models in `src/config/models/model-registry.yaml`
5. Handle in `getAISDKModel()` switch statement

### Adding Web Search Support

1. Set `searchSupport: true` in model registry
2. If tool-based: implement in `getWebSearchTools()`
3. If built-in: add source extraction logic
4. Update `getPerplexityProviderOptions()` if needed

### Adding a Data Format

1. Add to `SupportedFormat` type
2. Add detector in `format-detector.ts`
3. Add parser in `format-parser.ts` (in `parseByFormat()`)
4. Test with sample file

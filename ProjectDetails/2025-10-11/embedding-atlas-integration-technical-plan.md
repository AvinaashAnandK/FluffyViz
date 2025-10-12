# Embedding Atlas Integration - Technical Implementation Plan

**Project**: FluffyViz - Embedding Atlas Visualization Feature
**Date**: 2025-10-11
**Status**: Design Phase

## Executive Summary

This document outlines the technical implementation plan for integrating Apple's Embedding Atlas into FluffyViz, enabling users to visualize their augmented conversation data as interactive 2D scatter plots with AI-powered clustering, semantic search, and strategic sampling for active learning.

---

## Feature-by-Feature Technical Breakdown

### Feature 1: UMAP Projection & Visual Clustering

#### Expected Visualization
For a chatbot with 3 conversation types (General Q/A, Technical Coding, Support):

```
UMAP 2D Space:
┌─────────────────────────────────────────┐
│   [General Q/A cluster]                 │
│   • "What's the capital of France?"     │
│   • "Tell me a joke"                    │
│                                         │
│                                         │
│         [Technical Coding cluster]      │
│         • "How to reverse a list?"      │
│         • "Debug this Python code"      │
│                                         │
│                                         │
│   [Support cluster]                     │
│   • "Reset my password"                 │
│   • "Billing question"                  │
└─────────────────────────────────────────┘
```

**How it works:**
- Embeddings capture semantic meaning → similar conversations cluster together
- UMAP reduces high-dimensional embeddings (e.g., 1536D from OpenAI) → 2D
- Natural separation emerges when topics differ significantly
- Overlapping regions indicate ambiguous conversations (e.g., "How to use the API?" = technical + support)

#### What Atlas Provides
✅ **UMAP WASM implementation** (`packages/umap-wasm`)
✅ **Interactive scatter plot** with zoom/pan
✅ **Density contours** to visualize cluster density
✅ **Point rendering** (WebGPU/WebGL)

#### What We Build
- **Embedding composition strategies** (see Feature 6)
- **Parameter tuning UI** for UMAP (n_neighbors, min_dist)
- **Color schemes** for categorical metadata overlay

---

### Feature 2: Dual Search Interface (String + Semantic)

#### Search Architecture

**Type 1: String/Keyword Search** (Like LilacML)
```typescript
// User types: "capital of a country"
// → Full-text search across all text columns
// → Highlights matching points on graph
```

**What Atlas Provides:**
✅ **FlexSearch** (seen in viewer dependencies)
- Fast in-memory text search
- Supports fuzzy matching
- Indexing of metadata columns

**Type 2: Semantic/Conceptual Search**
```typescript
// User types: "questions about geography"
// → Embed query → Find nearest neighbors in embedding space
// → Highlight semantically similar points

// OR: User clicks a point → "Find Similar"
// → Use that point's embedding for k-NN search
```

#### What We Build

```typescript
// src/lib/semantic-search.ts
interface SemanticSearchEngine {
  // Embed user query and find k nearest neighbors
  searchByText(query: string, k: number): SearchResult[]

  // Find similar conversations to a clicked point
  findSimilar(pointIndex: number, k: number): SearchResult[]

  // Vector similarity computation (cosine similarity)
  computeSimilarity(vec1: number[], vec2: number[]): number
}
```

**Implementation Strategy:**
- **Small datasets (<10k points)**: Brute-force cosine similarity in browser
- **Large datasets (>10k)**: Use approximate nearest neighbor (ANN) libraries
  - **HNSW** (Hierarchical Navigable Small World) via `hnswlib-wasm`
  - **Faiss** (if we add a small Python backend)
  - **Or**: Pre-compute k-NN during embedding generation and store in IndexedDB

---

### Feature 3: Metadata Visualization System

#### Column-to-Chart Mapping

```typescript
// src/lib/metadata-chart-mapper.ts

type ColumnType = 'categorical' | 'numerical' | 'datetime' | 'text'
type ChartType = 'bar' | 'histogram' | 'heatmap' | 'boxplot' | 'stacked-histogram'

interface MetadataColumn {
  id: string
  name: string
  type: ColumnType
  uniqueValues?: any[]       // For categorical
  range?: [number, number]   // For numerical
}

// Automatic chart type inference
function inferChartType(column: MetadataColumn): ChartType {
  if (column.type === 'categorical') {
    return column.uniqueValues.length < 20 ? 'bar' : 'stacked-histogram'
  }

  if (column.type === 'numerical') {
    // If column name suggests price/currency
    if (/price|cost|amount|usd|eur/i.test(column.name)) {
      return 'heatmap'  // 2D heatmap with color scale
    }
    return 'histogram'
  }

  return 'histogram'
}
```

#### What Atlas Provides
✅ **Mosaic declarative charts** (VGPlot integration)
✅ **Linked selection** (click chart → filter scatter plot)
✅ **Metadata filtering UI**

**From their examples, Atlas can:**
- Overlay categorical colors on scatter plot points
- Generate bar charts for categories
- Create histograms for numerical distributions
- Link interactions (brush, click, filter)

#### What We Build

```typescript
// UI Component: MetadataPanel.tsx
interface MetadataPanelProps {
  columns: MetadataColumn[]          // From spreadsheet
  selectedColumns: string[]          // User's active overlays
  onToggleColumn: (colId: string) => void
  chartConfigs: Map<string, ChartConfig>
}

// Features:
// 1. Column list with preview
// 2. Toggle to show/hide on scatter plot
// 3. Chart type selector (auto or manual)
// 4. Color scheme picker for categorical
// 5. Bin size control for histograms
```

**Chart Configuration:**
```typescript
interface ChartConfig {
  columnId: string
  chartType: ChartType
  options: {
    colorScheme?: string[]      // For categorical
    binCount?: number            // For histograms
    logScale?: boolean           // For skewed distributions
    stackBy?: string             // For stacked histograms
  }
}
```

**NO Mosaic Specification UI** (as requested)
- Hide Mosaic SQL query builder
- Hide custom spec editor
- Only expose preset chart types via dropdown

---

### Feature 4: Automated Clustering + LLM Labeling

#### Clustering Pipeline

```typescript
// src/lib/clustering.ts

interface ClusterResult {
  clusterIds: number[]              // Cluster assignment per point
  clusterCount: number              // Total clusters found
  clusterCenters: number[][]        // Centroid embeddings
  clusterLabels?: string[]          // LLM-generated labels
  silhouetteScore: number           // Quality metric
}

// Step 1: Clustering Algorithm Selection
enum ClusteringMethod {
  HDBSCAN = 'hdbscan',   // Density-based, finds natural clusters
  KMeans = 'kmeans',      // User specifies k
  DBSCAN = 'dbscan'       // Density-based with radius
}
```

#### What Atlas Provides
✅ **Kernel Density Estimation** (Rust implementation in `packages/density-clustering`)
- Computes density contours on 2D projection
- Could be adapted for cluster boundary detection

❌ **No built-in clustering** for discrete cluster assignment

#### What We Build

**Option 1: Client-Side Clustering (JavaScript)**
```typescript
// Use ML.js or similar
import { DBSCAN, KMeans } from 'ml-clustering'

async function clusterEmbeddings(
  embeddings: number[][],
  method: ClusteringMethod,
  params: ClusterParams
): Promise<ClusterResult> {
  if (method === 'hdbscan') {
    // Use hdbscanjs (JavaScript port)
    const clusterer = new HDBSCAN(params.minClusterSize, params.minSamples)
    const clusters = clusterer.fit(embeddings)
    return clusters
  }

  if (method === 'kmeans') {
    const kmeans = new KMeans(params.k)
    kmeans.train(embeddings)
    return {
      clusterIds: kmeans.clusters,
      clusterCenters: kmeans.centroids,
      clusterCount: params.k
    }
  }
}
```

**Option 2: Python Backend (Optional, better performance)**
```python
# Backend API endpoint: POST /api/cluster
from sklearn.cluster import HDBSCAN, KMeans
import numpy as np

def cluster_embeddings(embeddings, method='hdbscan', **params):
    if method == 'hdbscan':
        clusterer = HDBSCAN(
            min_cluster_size=params.get('min_cluster_size', 10),
            min_samples=params.get('min_samples', 5)
        )
        labels = clusterer.fit_predict(embeddings)
        return labels
```

**Recommendation**: Start with JavaScript (client-side), optionally add Python backend later for large datasets

#### LLM Cluster Labeling System

```typescript
// src/lib/cluster-labeling.ts

interface ClusterLabelingConfig {
  samplesPerCluster: number      // How many examples to show LLM
  labelingModel: Model            // GPT-4, Claude, etc.
  includeKeywords: boolean        // Extract keywords too
}

async function labelClusters(
  clusterResult: ClusterResult,
  data: SpreadsheetData[],
  config: ClusterLabelingConfig
): Promise<string[]> {

  const labels: string[] = []

  for (let clusterId = 0; clusterId < clusterResult.clusterCount; clusterId++) {
    // Get points in this cluster
    const clusterPoints = data.filter((_, idx) =>
      clusterResult.clusterIds[idx] === clusterId
    )

    // Sample diverse examples (use centroid distance)
    const samples = sampleDiverseExamples(
      clusterPoints,
      config.samplesPerCluster
    )

    // Generate label with LLM
    const prompt = `
You are analyzing a cluster of similar conversations. Here are ${samples.length} representative examples:

${samples.map((s, i) => `Example ${i+1}:\n${s.user_input}\n${s.agent_response}`).join('\n\n')}

Generate a concise label (2-4 words) that describes the common theme of this cluster.
Also provide 3-5 keywords.

Format:
Label: <label>
Keywords: <keyword1>, <keyword2>, ...
    `.trim()

    const response = await generateWithLLM(prompt, config.labelingModel)
    labels[clusterId] = parseLabel(response)
  }

  return labels
}

// Sample diverse examples using centroid distance
function sampleDiverseExamples(
  points: any[],
  count: number
): any[] {
  // 1. Find centroid
  // 2. Sort by distance to centroid
  // 3. Take samples from different percentiles (0%, 25%, 50%, 75%, 100%)
  // This ensures we show diversity within cluster
}
```

**UI Integration:**
```typescript
// ClusterPanel.tsx
interface ClusterInfo {
  id: number
  label: string
  keywords: string[]
  size: number
  color: string
  confidence: number  // Based on silhouette score
}

// Features:
// - List all clusters with labels
// - Click to highlight cluster on scatter plot
// - Edit label manually
// - Re-generate label with different model
// - Show cluster statistics (size, density, etc.)
```

---

### Feature 5: Strategic Sampling (Boundary Detection)

This is the **active learning** feature - helps users find the most valuable examples to label.

#### Concept: Uncertainty at Cluster Boundaries

```
Visual Representation:

Cluster A          Boundary Zone         Cluster B
  (clear)          (uncertain)           (clear)
    ●●●              ○○○                   ■■■
   ●●●●●            ○○○○○                 ■■■■■
    ●●●              ○○○                   ■■■
                     ↑
           These points are ambiguous!
```

**Why these matter:**
- Points near cluster boundaries are where the model is least certain
- Labeling these has highest impact on model performance
- Strategic sampling = focus expert effort on high-value examples

#### Implementation

```typescript
// src/lib/boundary-detection.ts

interface BoundaryPoint {
  index: number
  uncertainty: number        // 0-1 score
  nearestClusters: number[]  // IDs of nearby clusters
  distance: number           // Distance to nearest centroid
  reason: string             // Why it's uncertain
}

async function detectBoundaryPoints(
  embeddings: number[][],
  clusterResult: ClusterResult,
  threshold: number = 0.3
): Promise<BoundaryPoint[]> {

  const boundaryPoints: BoundaryPoint[] = []

  for (let i = 0; i < embeddings.length; i++) {
    const embedding = embeddings[i]
    const assignedCluster = clusterResult.clusterIds[i]

    // Compute distances to all cluster centroids
    const distances = clusterResult.clusterCenters.map(center =>
      cosineSimilarity(embedding, center)
    )

    // Sort to find closest centroids
    const sorted = distances
      .map((d, idx) => ({ clusterId: idx, distance: d }))
      .sort((a, b) => b.distance - a.distance)  // Descending

    const firstClosest = sorted[0]
    const secondClosest = sorted[1]

    // Uncertainty = how similar are the top 2 cluster distances?
    const uncertainty = 1 - (firstClosest.distance - secondClosest.distance)

    if (uncertainty > threshold) {
      boundaryPoints.push({
        index: i,
        uncertainty,
        nearestClusters: [firstClosest.clusterId, secondClosest.clusterId],
        distance: firstClosest.distance,
        reason: `Ambiguous between clusters ${firstClosest.clusterId} and ${secondClosest.clusterId}`
      })
    }
  }

  // Sort by uncertainty (highest first)
  return boundaryPoints.sort((a, b) => b.uncertainty - a.uncertainty)
}
```

#### Alternative: Density-Based Boundary Detection

```typescript
// Use Atlas's density clustering Rust module
// Points with low density AND near multiple clusters = boundaries

function detectLowDensityBoundaries(
  projections: {x: number, y: number}[],
  densityMap: DensityEstimate,
  clusterResult: ClusterResult
): BoundaryPoint[] {

  return projections
    .map((point, idx) => {
      const density = getDensityAt(point, densityMap)
      const nearClusters = getNearbyClusters(point, clusterResult)

      // Low density + multiple nearby clusters = boundary
      if (density < 0.2 && nearClusters.length > 1) {
        return {
          index: idx,
          uncertainty: 1 - density,
          nearestClusters: nearClusters,
          reason: `Low density region between ${nearClusters.length} clusters`
        }
      }
    })
    .filter(Boolean)
}
```

#### LLM-Based Boundary Analysis

```typescript
// Enhance boundary detection with LLM reasoning
async function analyzeBoundaryExamples(
  boundaryPoints: BoundaryPoint[],
  data: SpreadsheetData[],
  clusterLabels: string[]
): Promise<BoundaryAnalysis[]> {

  const analyses = []

  for (const bp of boundaryPoints.slice(0, 50)) {  // Top 50
    const example = data[bp.index]
    const clusterNames = bp.nearestClusters.map(id => clusterLabels[id])

    const prompt = `
This conversation is ambiguous - it falls between clusters:
- ${clusterNames[0]}
- ${clusterNames[1]}

Conversation:
User: ${example.user_input}
Agent: ${example.agent_response}

Why might this be difficult to categorize? What makes it ambiguous?
Provide a 1-sentence explanation.
    `.trim()

    const reasoning = await generateWithLLM(prompt, smallFastModel)

    analyses.push({
      ...bp,
      llmReasoning: reasoning,
      suggestedAction: inferAction(reasoning)
    })
  }

  return analyses
}
```

#### Strategic Sampling UI

```tsx
// src/components/visualization/StrategicSamplingPanel.tsx

interface StrategicSamplingPanelProps {
  boundaryPoints: BoundaryPoint[]
  data: SpreadsheetData[]
  onExport: (points: BoundaryPoint[]) => void
}

export function StrategicSamplingPanel({ boundaryPoints, data, onExport }) {
  return (
    <div className="strategic-sampling-panel">
      <header>
        <h3>Strategic Sampling: {boundaryPoints.length} Uncertain Examples</h3>
        <p>Focus your labeling efforts here for maximum impact</p>
      </header>

      {/* Uncertainty Distribution */}
      <UncertaintyHistogram data={boundaryPoints} />

      {/* Top Uncertain Examples */}
      <div className="boundary-list">
        {boundaryPoints.slice(0, 20).map(bp => (
          <BoundaryCard
            key={bp.index}
            point={bp}
            data={data[bp.index]}
            onHighlight={() => highlightOnGraph(bp.index)}
          />
        ))}
      </div>

      {/* Export Options */}
      <ExportPanel>
        <Select
          label="Export Top N"
          options={[10, 25, 50, 100, 'All']}
        />
        <Button onClick={() => onExport(boundaryPoints)}>
          Export for Labeling
        </Button>
      </ExportPanel>
    </div>
  )
}

// Export format: CSV with context
function exportBoundaryPoints(
  points: BoundaryPoint[],
  data: SpreadsheetData[]
): CSV {
  return {
    headers: [
      'index',
      'uncertainty_score',
      'ambiguous_between',
      'user_input',
      'agent_response',
      'llm_reasoning',
      'suggested_label'
    ],
    rows: points.map(bp => ({
      index: bp.index,
      uncertainty_score: bp.uncertainty,
      ambiguous_between: bp.nearestClusters.join(' vs '),
      user_input: data[bp.index].user_input,
      agent_response: data[bp.index].agent_response,
      llm_reasoning: bp.llmReasoning,
      suggested_label: ''  // User fills this in
    }))
  }
}
```

#### Visualization on Graph

```typescript
// Highlight boundary points with special styling
const pointStyles = {
  normal: { color: 'cluster-color', size: 4, opacity: 0.6 },
  boundary: {
    color: 'red',
    size: 8,
    opacity: 1.0,
    border: 'yellow',
    borderWidth: 2
  }
}

// Render boundary zone overlay
function renderBoundaryZones(canvas, clusterCenters, threshold) {
  // Draw semi-transparent regions between cluster centers
  // where uncertainty is high
}
```

---

### Feature 6: Embedding Composition Strategies

#### Input Options for Embedding Generation

```typescript
// src/lib/embedding-strategies.ts

enum EmbeddingStrategy {
  TURN_ONLY = 'turn-only',
  HISTORY_UNTIL_TURN = 'history-until-turn',
  TURN_PLUS_HISTORY = 'turn-plus-history',
  FULL_CONVERSATION = 'full-conversation',
  JUDGE_REASONING = 'judge-reasoning',
  CUSTOM = 'custom'
}

interface EmbeddingConfig {
  strategy: EmbeddingStrategy
  columns: string[]               // Which columns to include
  maxHistoryTurns?: number        // For history strategies
  separator?: string              // How to join text
  includeSystemPrompts?: boolean
}
```

#### Strategy Implementations

```typescript
// Strategy 1: Turn-level only
function turnOnly(row: SpreadsheetData, config: EmbeddingConfig): string {
  // Just the current turn
  return `User: ${row.user_input}\nAssistant: ${row.agent_response}`
}

// Strategy 2: History until this turn
function historyUntilTurn(
  row: SpreadsheetData,
  allRows: SpreadsheetData[],
  config: EmbeddingConfig
): string {
  const conversationId = row.conversation_id
  const currentIndex = allRows.indexOf(row)

  // Get all previous turns in same conversation
  const previousTurns = allRows
    .slice(0, currentIndex)
    .filter(r => r.conversation_id === conversationId)
    .slice(-config.maxHistoryTurns || -10)  // Last 10 turns by default

  return previousTurns
    .map(t => `User: ${t.user_input}\nAssistant: ${t.agent_response}`)
    .join('\n\n')
}

// Strategy 3: Turn + History (concat)
function turnPlusHistory(
  row: SpreadsheetData,
  allRows: SpreadsheetData[],
  config: EmbeddingConfig
): string {
  const history = historyUntilTurn(row, allRows, config)
  const current = turnOnly(row, config)

  return `${history}\n\n--- Current Turn ---\n${current}`
}

// Strategy 4: Full conversation
function fullConversation(
  row: SpreadsheetData,
  allRows: SpreadsheetData[],
  config: EmbeddingConfig
): string {
  const conversationId = row.conversation_id

  const allTurns = allRows
    .filter(r => r.conversation_id === conversationId)

  return allTurns
    .map(t => `User: ${t.user_input}\nAssistant: ${t.agent_response}`)
    .join('\n\n')
}

// Strategy 5: Judge reasoning
function judgeReasoning(row: SpreadsheetData, config: EmbeddingConfig): string {
  // Embed the LLM-as-a-judge output
  return row.judge_rationale || row.helpfulness_reasoning || ''
}

// Strategy 6: Custom column selection
function customStrategy(row: SpreadsheetData, config: EmbeddingConfig): string {
  return config.columns
    .map(col => `${col}: ${row[col]}`)
    .join(config.separator || '\n')
}
```

#### UI for Strategy Selection

```tsx
// EmbeddingConfigModal.tsx
export function EmbeddingConfigModal({ data, columns, onGenerate }) {
  const [strategy, setStrategy] = useState<EmbeddingStrategy>('turn-only')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])

  return (
    <Modal>
      <h2>Configure Embeddings</h2>

      {/* Strategy Selector */}
      <RadioGroup value={strategy} onChange={setStrategy}>
        <Radio value="turn-only">
          <strong>Turn-level only</strong>
          <p className="text-sm">Embed each turn independently</p>
          <CodePreview>User: {...}\nAssistant: {...}</CodePreview>
        </Radio>

        <Radio value="history-until-turn">
          <strong>Conversation history until turn</strong>
          <p className="text-sm">Include all previous turns</p>
          <Input
            label="Max history turns"
            type="number"
            defaultValue={10}
          />
        </Radio>

        <Radio value="turn-plus-history">
          <strong>Turn + History (concatenated)</strong>
          <p className="text-sm">Current turn with context</p>
        </Radio>

        <Radio value="full-conversation">
          <strong>Full conversation</strong>
          <p className="text-sm">All turns grouped by conversation_id</p>
          <Warning>Will create duplicate embeddings for same conversation</Warning>
        </Radio>

        <Radio value="judge-reasoning">
          <strong>LLM Judge Reasoning</strong>
          <p className="text-sm">Embed evaluation/reasoning columns</p>
          <ColumnSelector
            columns={columns.filter(c => /judge|reasoning|rationale/.test(c))}
            selected={selectedColumns}
            onChange={setSelectedColumns}
          />
        </Radio>

        <Radio value="custom">
          <strong>Custom column selection</strong>
          <ColumnMultiSelect
            columns={columns}
            selected={selectedColumns}
            onChange={setSelectedColumns}
          />
        </Radio>
      </RadioGroup>

      {/* Preview */}
      <PreviewPanel>
        <h3>Preview (First Row)</h3>
        <pre>{generatePreview(data[0], strategy, selectedColumns)}</pre>
      </PreviewPanel>

      {/* Model Selection */}
      <ModelSelector />

      <Button onClick={onGenerate}>Generate Embeddings</Button>
    </Modal>
  )
}
```

---

## PHASED IMPLEMENTATION ROADMAP

### Foundation Phase: Core Infrastructure (2-3 weeks)

**Goal**: Get embeddings generating and basic visualization working

#### Deliverables:
1. **Embedding Generation System**
   ```
   src/lib/
   ├── embedding-generator.ts       // Core embedding API calls
   ├── embedding-strategies.ts      // 6 composition strategies
   └── embedding-cache.ts           // IndexedDB caching

   New IndexedDB stores:
   - embeddings_cache (fileId + strategy hash → embeddings)
   - projection_cache (embedding hash → {x, y} coordinates)
   ```

2. **Embedding Atlas Integration**
   ```bash
   npm install embedding-atlas
   ```
   ```
   src/components/visualization/
   ├── AtlasViewer.tsx              // Wrapper around Atlas component
   └── EmbeddingConfigModal.tsx     // Strategy selector UI

   src/app/visualize/[fileId]/page.tsx  // New route
   ```

3. **Data Transformation Pipeline**
   ```
   src/lib/
   └── atlas-data-transformer.ts

   // SpreadsheetData → AtlasData
   interface AtlasData {
     x: number
     y: number
     id: string
     [metadataKey: string]: any  // All spreadsheet columns
   }
   ```

4. **UI Flow**
   ```
   SpreadsheetEditor → [Visualize] button → EmbeddingConfigModal
                                              ↓
                                    Select strategy + model
                                              ↓
                                    Generate embeddings (with progress)
                                              ↓
                                    Compute UMAP projection
                                              ↓
                                    /visualize/[fileId] → AtlasViewer
   ```

#### Technical Decisions:
- **Embedding Model**: Default to OpenAI `text-embedding-3-small` (1536D, cheap)
- **UMAP**: Use Atlas's WASM implementation (client-side)
- **Caching**: Store embeddings + projections in IndexedDB (persist across sessions)
- **Progress Tracking**: Reuse existing `generationProgress` pattern from AI columns

#### Acceptance Criteria:
- [ ] User can click "Visualize" in SpreadsheetEditor
- [ ] Modal shows 6 embedding strategies with previews
- [ ] Embeddings generate with progress indicator
- [ ] UMAP projection computes and renders in Atlas
- [ ] Points are interactive (click to see data)
- [ ] Embeddings cached and reused on reload

---

### Phase 1: Search & Metadata (2-3 weeks)

**Goal**: Add dual search and metadata overlays

#### Deliverables:

1. **String Search** (Atlas FlexSearch integration)
   ```
   src/lib/search/
   ├── string-search.ts             // FlexSearch index
   └── search-highlighter.ts        // Highlight on graph

   UI: Search bar in AtlasViewer → highlights matching points
   ```

2. **Semantic/Conceptual Search**
   ```
   src/lib/search/
   ├── semantic-search.ts           // Cosine similarity k-NN
   └── ann-index.ts                 // Optional: HNSW for large datasets

   UI:
   - Global search bar (embed query → find neighbors)
   - Context menu on point: "Find Similar" (k-NN from that point)
   ```

3. **Metadata Visualization System**
   ```
   src/lib/
   └── metadata-chart-mapper.ts     // Auto-infer chart types

   src/components/visualization/
   └── MetadataPanel.tsx

   Features:
   - Column list from spreadsheet
   - Toggle visibility on scatter plot
   - Auto-generate charts (bar, histogram, heatmap)
   - Color scheme picker
   - Linked selection (click chart → filter scatter)
   ```

4. **Chart Type Inference**
   ```typescript
   // Auto-detect and create charts
   categorical (<20 unique) → Bar chart
   categorical (>20 unique) → Stacked histogram
   numerical (price/cost)   → 2D heatmap
   numerical (other)        → Histogram
   datetime                 → Timeline
   ```

#### Integration with Atlas:
- Use Atlas's Mosaic charts (hide SQL/spec UI)
- Leverage linked selection (brushing)
- Metadata overlays on scatter plot (color by category)

#### Acceptance Criteria:
- [ ] String search highlights matching points
- [ ] Semantic search finds conceptually similar conversations
- [ ] Click point → "Find Similar" shows k nearest neighbors
- [ ] Metadata panel lists all spreadsheet columns
- [ ] Toggle column → overlays color on scatter plot
- [ ] Auto-generated charts appear for selected columns
- [ ] Click chart bar → filters scatter plot

---

### Phase 2: Clustering & LLM Labeling (3-4 weeks)

**Goal**: Automated cluster discovery and AI-generated labels

#### Deliverables:

1. **Clustering System**
   ```
   src/lib/clustering/
   ├── cluster-algorithms.ts        // HDBSCAN, k-means, DBSCAN
   ├── cluster-quality.ts           // Silhouette score, etc.
   └── cluster-colors.ts            // Color palette generation

   // Start with ml-clustering (JavaScript)
   // Optional: Python backend API for large datasets
   ```

2. **LLM Cluster Labeling**
   ```
   src/lib/clustering/
   ├── cluster-labeling.ts          // Generate labels with LLM
   ├── sample-selection.ts          // Diverse example sampling
   └── keyword-extraction.ts        // Extract keywords per cluster

   Flow:
   1. Cluster embeddings
   2. Sample 5-10 diverse examples per cluster
   3. Send to LLM (GPT-4, Claude) for labeling
   4. Parse label + keywords
   5. Display in UI
   ```

3. **Cluster Panel UI**
   ```
   src/components/visualization/
   ├── ClusterPanel.tsx             // List clusters with labels
   ├── ClusterCard.tsx              // Individual cluster info
   └── ClusterConfigModal.tsx       // Algorithm + params

   Features:
   - Run clustering (select algorithm + params)
   - Generate labels button
   - Edit labels manually
   - Click cluster → highlight on graph
   - Cluster statistics (size, density, silhouette)
   ```

4. **Visualization Enhancements**
   ```typescript
   // Color points by cluster
   // Draw cluster boundaries (convex hull or density contour)
   // Cluster centroids as stars/diamonds
   // Hover cluster → show label + size
   ```

#### Algorithm Selection UI:
```tsx
<ClusterConfigModal>
  <Select label="Algorithm">
    <Option value="hdbscan">HDBSCAN (auto-detect clusters)</Option>
    <Option value="kmeans">k-Means (specify k)</Option>
    <Option value="dbscan">DBSCAN (density-based)</Option>
  </Select>

  {algorithm === 'hdbscan' && (
    <>
      <Input label="Min Cluster Size" type="number" default={10} />
      <Input label="Min Samples" type="number" default={5} />
    </>
  )}

  {algorithm === 'kmeans' && (
    <Input label="Number of Clusters (k)" type="number" default={5} />
  )}

  <Button>Run Clustering</Button>
</ClusterConfigModal>
```

#### Acceptance Criteria:
- [ ] User can run clustering with parameter controls
- [ ] Points colored by cluster assignment
- [ ] LLM generates descriptive labels for each cluster
- [ ] Cluster panel shows labels, keywords, and statistics
- [ ] Click cluster in panel → highlights on graph
- [ ] User can edit labels manually
- [ ] Cluster boundaries visible on graph

---

### Phase 3: Strategic Sampling (Active Learning) (2-3 weeks)

**Goal**: Identify boundary cases for efficient labeling

#### Deliverables:

1. **Boundary Detection System**
   ```
   src/lib/active-learning/
   ├── boundary-detection.ts        // Uncertainty scoring
   ├── density-boundaries.ts        // Low-density regions
   └── overlap-analysis.ts          // Cluster overlap zones

   Methods:
   1. Distance-based: Points with similar distance to multiple centroids
   2. Density-based: Low-density regions between clusters
   3. Ensemble: Combine multiple signals
   ```

2. **LLM Boundary Analysis**
   ```
   src/lib/active-learning/
   └── boundary-reasoning.ts

   // For top N boundary points:
   // 1. Identify which clusters they're between
   // 2. Ask LLM why the example is ambiguous
   // 3. Suggest what label would help
   ```

3. **Strategic Sampling UI**
   ```
   src/components/visualization/
   ├── StrategicSamplingPanel.tsx   // Main panel
   ├── BoundaryCard.tsx             // Individual boundary point
   └── UncertaintyHistogram.tsx     // Distribution chart

   Features:
   - Show top N uncertain points
   - Uncertainty score (0-1)
   - Reason for uncertainty
   - LLM explanation
   - Click → highlight on graph
   - Export for labeling
   ```

4. **Graph Visualization**
   ```typescript
   // Highlight boundary points in red with large circles
   // Draw "uncertainty zones" between clusters
   // Hover → show uncertainty score + reasoning
   // Toggle: "Show only boundary points"
   ```

5. **Export System**
   ```
   src/lib/active-learning/
   └── boundary-export.ts

   CSV Format:
   - Row index
   - Uncertainty score
   - Ambiguous between (cluster labels)
   - All original columns
   - LLM reasoning
   - Suggested label (blank - user fills)
   ```

#### UI Flow:
```
1. User runs clustering + labeling
2. Click "Find Boundary Cases" button
3. System analyzes uncertainty
4. Strategic Sampling Panel appears
5. Shows ranked list of uncertain points
6. User reviews examples
7. Export top 50 for manual labeling
8. Import labeled data back (future: retrain)
```

#### Acceptance Criteria:
- [ ] Boundary detection identifies uncertain points
- [ ] Points ranked by uncertainty score
- [ ] Boundary points highlighted on graph (red circles)
- [ ] LLM explains why each point is ambiguous
- [ ] Strategic sampling panel shows top N cases
- [ ] User can export boundary cases as CSV
- [ ] Export includes all context + LLM reasoning
- [ ] Toggle to show/hide boundary-only view

---

### Phase 4: Polish & Advanced Features (2-3 weeks)

**Goal**: Production-ready with power user features

#### Deliverables:

1. **Selection Sync**
   ```
   // Click point in Atlas → highlight row in SpreadsheetTable
   // Select rows in table → highlight on graph
   // Bidirectional sync
   ```

2. **Multiple Visualization Configs**
   ```
   // Save different embedding configurations
   // e.g., "Turn-level view" vs "Full conversation view"
   // Quick switch between configs
   ```

3. **UMAP Parameter Tuning**
   ```
   <UMAPConfigModal>
     <Slider label="n_neighbors" min={2} max={100} default={15} />
     <Slider label="min_dist" min={0} max={1} step={0.05} default={0.1} />
     <Select label="metric">
       <Option value="cosine">Cosine</Option>
       <Option value="euclidean">Euclidean</Option>
     </Select>
     <Button>Re-compute Projection</Button>
   </UMAPConfigModal>
   ```

4. **Export Visualization**
   ```
   // Export as PNG/SVG
   // Export as interactive HTML (embed Atlas)
   // Export data as Parquet for external tools
   ```

5. **Incremental Updates**
   ```
   // When user adds new rows to spreadsheet
   // → Re-embed only new rows
   // → Update projection incrementally
   // → Avoid full recomputation
   ```

6. **Alternative Projections**
   ```
   <ProjectionSelector>
     <Option value="umap">UMAP (default)</Option>
     <Option value="tsne">t-SNE</Option>
     <Option value="pca">PCA</Option>
   </ProjectionSelector>
   ```

7. **Performance Optimizations**
   ```
   // Web Workers for embedding generation
   // Batch API calls (100 at a time)
   // Progressive rendering (show first 1000 points, then rest)
   // Virtual scrolling in boundary list
   ```

#### Acceptance Criteria:
- [ ] Click graph point → scrolls to row in table
- [ ] Select table rows → highlights on graph
- [ ] Multiple saved embedding configs
- [ ] UMAP parameters adjustable in UI
- [ ] Export graph as PNG/SVG
- [ ] Export data as Parquet
- [ ] Incremental embedding updates work
- [ ] Alternative projections (t-SNE, PCA) available
- [ ] Handles 10k+ points smoothly

---

## Technical Stack Summary

### New Dependencies:
```json
{
  "dependencies": {
    "embedding-atlas": "^0.11.0",
    "@uwdata/mosaic-core": "^0.19.0",
    "@uwdata/vgplot": "^0.19.0",
    "ml-clustering": "^6.0.0",           // HDBSCAN, k-means
    "flexsearch": "^0.7.43",             // String search
    "hdbscanjs": "^1.0.0",               // HDBSCAN (if ml-clustering insufficient)
    "parquetjs": "^0.11.2"               // Optional: Parquet export
  }
}
```

### New File Structure:
```
src/
├── app/
│   └── visualize/
│       └── [fileId]/
│           └── page.tsx                 // Visualization route
├── components/
│   └── visualization/
│       ├── AtlasViewer.tsx
│       ├── EmbeddingConfigModal.tsx
│       ├── MetadataPanel.tsx
│       ├── ClusterPanel.tsx
│       ├── StrategicSamplingPanel.tsx
│       └── SearchInterface.tsx
├── lib/
│   ├── embedding-generator.ts
│   ├── embedding-strategies.ts
│   ├── embedding-cache.ts
│   ├── atlas-data-transformer.ts
│   ├── metadata-chart-mapper.ts
│   ├── clustering/
│   │   ├── cluster-algorithms.ts
│   │   ├── cluster-labeling.ts
│   │   └── cluster-quality.ts
│   ├── active-learning/
│   │   ├── boundary-detection.ts
│   │   ├── boundary-reasoning.ts
│   │   └── boundary-export.ts
│   └── search/
│       ├── string-search.ts
│       └── semantic-search.ts
└── hooks/
    └── use-embeddings.ts                // Embedding state management
```

### IndexedDB Schema Extensions:
```typescript
// New object stores
interface EmbeddingCache {
  id: string                    // fileId + strategyHash
  fileId: string
  strategy: EmbeddingStrategy
  strategyHash: string
  embeddings: number[][]
  model: string
  dimensions: number
  createdAt: Date
}

interface ProjectionCache {
  id: string                    // embeddingHash + projectionMethod
  embeddingHash: string
  method: 'umap' | 'tsne' | 'pca'
  projections: {x: number, y: number}[]
  params: Record<string, any>
  createdAt: Date
}

interface ClusterCache {
  id: string                    // embeddingHash + clusterMethod
  embeddingHash: string
  method: ClusteringMethod
  params: Record<string, any>
  clusterIds: number[]
  clusterCenters: number[][]
  labels: string[]
  keywords: string[][]
  boundaryPoints: BoundaryPoint[]
  createdAt: Date
}
```

---

## Critical Implementation Notes

### 1. Atlas Component Usage (Need to verify)
Research needed:
- Does Atlas accept in-memory data or only Parquet files?
- Can we pass JSON directly to React component?
- How to access UMAP WASM directly?

**Action**: Install `embedding-atlas` and examine exports:
```bash
cd fluffy-viz
npm install embedding-atlas
```

### 2. Embedding API Rate Limits
```typescript
// Batch embeddings to avoid rate limits
async function generateEmbeddings(
  texts: string[],
  model: Model
): Promise<number[][]> {
  const BATCH_SIZE = 100  // OpenAI allows 100/min

  const batches = chunk(texts, BATCH_SIZE)
  const results = []

  for (const batch of batches) {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch
    })
    results.push(...response.data.map(d => d.embedding))

    // Rate limit delay
    await sleep(60000 / batches.length)
  }

  return results
}
```

### 3. UMAP Parameter Guidance
```typescript
// Recommended defaults
const UMAP_DEFAULTS = {
  n_neighbors: 15,     // Smaller = more local structure
  min_dist: 0.1,       // Smaller = tighter clusters
  metric: 'cosine',    // Best for embeddings
  n_components: 2      // 2D projection
}

// For large datasets (>10k points)
const UMAP_LARGE = {
  n_neighbors: 30,
  min_dist: 0.05,
  metric: 'cosine',
  n_components: 2
}
```

### 4. Cluster Count Heuristics
```typescript
// Auto-determine k for k-means
function estimateOptimalClusters(n_samples: number): number {
  // Rule of thumb: k ≈ sqrt(n/2)
  return Math.ceil(Math.sqrt(n_samples / 2))
}

// For HDBSCAN min_cluster_size
function estimateMinClusterSize(n_samples: number): number {
  // 0.5-1% of dataset, minimum 5
  return Math.max(5, Math.floor(n_samples * 0.01))
}
```

---

## Next Steps

1. **Foundation Phase Kickoff**
   - Install embedding-atlas and dependencies
   - Verify Atlas React component API
   - Set up /visualize/[fileId] route
   - Implement basic embedding generation

2. **Technical Validation**
   - Test Atlas with sample data
   - Verify UMAP WASM accessibility
   - Benchmark embedding generation speed
   - Test IndexedDB cache performance

3. **Prototype Development**
   - Build minimal EmbeddingConfigModal
   - Implement turn-only strategy
   - Generate sample embeddings
   - Render in Atlas component

---

## Risk Assessment

### High Risk
- **Atlas data format compatibility**: Unknown if JSON input works or requires Parquet
- **UMAP performance**: Large datasets (>10k) may be slow in WASM
- **Embedding costs**: OpenAI embeddings can be expensive at scale

### Medium Risk
- **Clustering quality**: JavaScript clustering may be inferior to Python scikit-learn
- **LLM labeling costs**: GPT-4 API calls for every cluster
- **Browser memory limits**: Large embedding matrices may cause crashes

### Mitigation Strategies
- Early Atlas integration testing (Week 1)
- Batch embedding generation with caching
- Optional Python backend for clustering
- Web Workers for CPU-intensive tasks
- Progressive loading for large datasets

---

## Success Metrics

### Foundation Phase
- Embedding generation time < 5 seconds per 100 rows
- UMAP projection time < 10 seconds for 1000 points
- Cache hit rate > 80% on reload

### Phase 1
- String search latency < 100ms
- Semantic search k-NN < 500ms for 1000 points
- Metadata charts render < 200ms

### Phase 2
- Clustering completes < 30 seconds for 1000 points
- LLM labeling < 2 seconds per cluster
- Cluster quality (silhouette score) > 0.3

### Phase 3
- Boundary detection < 10 seconds
- LLM reasoning < 3 seconds per boundary point
- Export generation < 5 seconds for 100 points

### Phase 4
- Selection sync latency < 50ms
- Export visualization < 3 seconds
- Handles 10k+ points without lag

---

## Conclusion

This implementation plan provides a comprehensive roadmap for integrating Embedding Atlas into FluffyViz with advanced features for AI/ML engineers. The phased approach ensures we deliver value incrementally while building toward a full-featured active learning platform.

Key differentiators:
- **Strategic sampling** for efficient labeling
- **LLM-powered cluster labeling** for interpretability
- **Multiple embedding strategies** for flexibility
- **Dual search** (string + semantic) for exploration
- **Local-first architecture** maintaining privacy

Estimated total development time: **10-13 weeks** (2.5-3 months)

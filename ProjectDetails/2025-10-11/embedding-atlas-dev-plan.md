Embedding Atlas Integration - Feature Development Roadmap

  Based on the technical plan and Atlas repository analysis, here's a feature-centric development approach for agentic
  implementation:

  ---
  Feature 1: Agent Trace Viewer with Embedding System

  What to Build

  Complete embedding generation and visualization system with multiple composition strategies,
  layer management, and interactive visualization. This is the foundation feature that enables
  users to create multiple "views" of their conversational data through different embedding lenses.

  ## UI Entry Point

  New tab in `/edit/[fileId]` page: **"Agent Trace Viewer"**
  - Always visible (even when no embeddings exist)
  - Empty state shows: "No Embedding Views Created Yet" with CTA button
  - Once embeddings created: Shows interactive scatter plot + controls

  ## Technical Architecture

  ### Storage Strategy (Hybrid: IndexedDB + OPFS)

  **IndexedDB** (for fast access):
  - Stores metadata for ALL embedding layers
  - Stores FULL data for ACTIVE layer only (currently selected in UI)
  - Stores composed text as new columns in spreadsheet data

  **OPFS (Origin Private File System)** (for large data):
  - Stores full embedding data for INACTIVE layers
  - Files named: `embedding_{layerId}.json`
  - Loaded on-demand when user switches views (~200ms load time)
  - No storage quota issues (several GB available)

  ### Data Model

  ```typescript
  // IndexedDB Table: Files (extend existing)
  interface StoredFile {
    id: string;
    name: string;
    data: { columns: string[]; rows: any[][] };
    // NEW FIELDS:
    embeddingLayers: Array<{
      id: string;
      name: string; // User-friendly: "Conversation History View"
      isActive: boolean; // Only one active at a time
      pointCount: number;
      compositionMode: 'single' | 'multi' | 'conversational';
      createdAt: string;
    }>;
    embeddingCompositionColumns: string[]; // ["_embedding_composition_1", "_embedding_composition_2"]
    nextCompositionColumnNumber: number; // For auto-incrementing column names
  }

  // IndexedDB Table: ActiveEmbeddingLayer (new table)
  interface ActiveEmbeddingLayer {
    id: string; // "emb_abc123"
    fileId: string;
    name: string; // User-provided name

    // Generation config
    provider: string; // "voyageai", "openai", "cohere"
    model: string; // "voyage-3-lite", "text-embedding-3-small"
    dimension: number; // 768, 1536, 3072, etc.

    compositionMode: 'single' | 'multi' | 'conversational';
    compositionConfig: {
      // Single mode
      sourceColumn?: string;

      // Multi mode
      columns?: string[];
      separator?: string; // "\n", ", ", " | "

      // Conversational mode
      conversationIdColumn?: string; // "session_id"
      sequenceColumn?: string; // "timestamp"
      strategy?: 'turn-only' | 'history-until' | 'turn-plus-n' | 'full-conversation';
      contextSize?: number; // For "turn-plus-n"
      turnFormatColumns?: string[]; // ["role", "message"]
    };

    // The actual embeddings + visualization data
    points: Array<{
      id: string; // "point_0"
      embedding: number[]; // The vector [0.123, -0.456, ...]
      coordinates2D: [number, number]; // Pre-computed UMAP/t-SNE
      sourceRowIndices: number[]; // Maps to source file rows
      label?: string; // For conversation-level: the conversation ID
      composedText: string; // The text that was embedded
      metadata?: Record<string, any>; // Aggregated metadata for conversation-level
    }>;

    // Metadata
    createdAt: string;
    lastAccessedAt: string;
  }

  // OPFS File Format (same structure as ActiveEmbeddingLayer)
  // Filename: embedding_{layerId}.json
  ```

  ### Multi-Step Creation Wizard

  **Step 0: Name Your View**
  ```
  View Name: [Conversation History Analysis________]
  Description: User provides friendly name for this embedding layer
  [Continue]
  ```

  **Step 1: Provider & Model Selection**
  Pattern: Reuse existing test-generation page implementation
  ```typescript
  // Load providers with embedding capability
  const embeddingProviders = getEnabledProviders(config)
    .filter(provider => hasCapability(config, provider, 'embedding'));

  // Filter models by selected provider
  const filteredModels = getEmbeddingModelsForEnabledProviders([selectedProvider]);
  ```
  UI:
  ```
  Provider (3 available): [Voyage AI ▼]
    ○ OpenAI
    ○ Cohere
    ● Voyage AI

  Model (5 available): [voyage-3-lite ▼]
    ○ voyage-3 (1024 dim)
    ● voyage-3-lite (1536 dim)
    ○ voyage-code-3 (1536 dim)

  [Back] [Continue]
  ```

  **Step 2: Composition Mode**
  ```
  What to Embed?

  ○ Single Column
    Select one column to embed

  ○ Multi-Column Concatenation
    Combine multiple columns from current row

  ● Conversational History
    Aggregate turns across rows by session

  [Back] [Continue]
  ```

  **Step 3A: Single Column Mode**
  ```
  Column: [user_message ▼]

  Preview (first 3 rows):
  ┌───────────────────────────────────────┐
  │ 1. "How do I reset my password?"      │
  │ 2. "What is your refund policy?"      │
  │ 3. "I need help with API integration" │
  └───────────────────────────────────────┘

  [Back] [Continue]
  ```

  **Step 3B: Multi-Column Mode**
  ```
  Selected Columns (drag to reorder):
  ┌───────────────────────────────────────┐
  │ 1. ≡ role                      [×]    │
  │ 2. ≡ message                   [×]    │
  │ 3. ≡ metadata.topic            [×]    │
  └───────────────────────────────────────┘

  [+ Add Column]

  Separator: [Newline ▼] (options: \n, ", ", " | ")

  Preview (first row):
  ┌───────────────────────────────────────┐
  │ user                                  │
  │ How do I reset my password?           │
  │ account_management                    │
  └───────────────────────────────────────┘

  [Back] [Continue]
  ```

  **Step 3C: Conversational History Mode**
  ```
  Conversation Identifier: [session_id ▼]
    Groups rows into conversations

  Sequence Identifier: [timestamp ▼]
    Orders turns within conversation

  Aggregation Strategy:
  ○ Turn only          (Just current row)
  ○ History until turn (All turns up to current)
  ● Turn plus N        (Current + N previous)
    N = [━━●━━━━━━━] 3 turns
  ○ Full conversation  (All turns in session)

  Turn Format (columns to include per turn):
  Selected: [role] [message]
  Available: [+ sentiment] [+ topic] [+ intent]

  Preview (session abc123, turn 3):
  ┌───────────────────────────────────────┐
  │ [Turn 1]                              │
  │ role: user                            │
  │ message: I need help with billing     │
  │ ---                                   │
  │ [Turn 2]                              │
  │ role: assistant                       │
  │ message: I can help with that         │
  │ ---                                   │
  │ [Turn 3] ← CURRENT                    │
  │ role: user                            │
  │ message: How do I cancel?             │
  └───────────────────────────────────────┘

  [Show Preview] [Back] [Continue]
  ```

  **Step 4: Review & Generate**
  ```
  Review Configuration

  View Name: Conversation History Analysis
  Provider: Voyage AI
  Model: voyage-3-lite (1536 dimensions)

  Composition:
  • Mode: Conversational History
  • Conversation ID: session_id
  • Sequence: timestamp
  • Strategy: Turn plus 3
  • Turn Format: role, message

  Estimated Output:
  • ~150 embedding points (150 unique sessions)
  • Storage size: ~6 MB

  [Back] [Generate Embeddings]
  ```

  **Step 5: Generation Progress**
  ```
  Generating Embeddings...

  Progress: [████████░░░░░░] 67% (100/150)

  • Composing text: ✓ Complete
  • Generating embeddings: Batch 2/3
  • Computing UMAP coordinates: Pending
  • Adding composition column: Pending

  Elapsed: 45s  •  Est. remaining: 22s

  [Cancel]
  ```

  ### Generation Pipeline

  1. **Compose Text** (client-side)
     ```typescript
     // For turn-level (1:1)
     const composedTexts = rows.map(row => composeText(row, config));

     // For conversation-level (many:1)
     const conversations = groupByConversation(rows, conversationIdColumn);
     const composedTexts = conversations.map(conv =>
       composeConversation(conv, config)
     );
     ```

  2. **Batch Embed** (API call using AI SDK)
     ```typescript
     import { embed } from 'ai';

     // Process in batches of 100
     for (let i = 0; i < composedTexts.length; i += 100) {
       const batch = composedTexts.slice(i, i + 100);
       const { embeddings } = await embed({
         model: voyageai.embedding('voyage-3-lite'),
         values: batch
       });
       allEmbeddings.push(...embeddings);
       updateProgress(i + batch.length, composedTexts.length);
     }
     ```

  3. **Compute UMAP Coordinates** (using Embedding Atlas)
     ```typescript
     import { createUMAP } from 'embedding-atlas';

     const umap = createUMAP(allEmbeddings, {
       n_neighbors: 15,
       min_dist: 0.1,
       metric: 'cosine'
     });
     const coordinates2D = await umap.fit();
     ```

  4. **Add Composed Text Column** (for ALL embedding types)
     ```typescript
     // For turn-level (1:1): Each row gets its composed text
     const columnName = `_embedding_composition_${nextNumber}`;
     rows.forEach((row, i) => {
       row[columnName] = composedTexts[i];
     });

     // For conversation-level (many:1): Duplicate composed text across all rows
     points.forEach(point => {
       point.sourceRowIndices.forEach(rowIdx => {
         rows[rowIdx][columnName] = point.composedText;
       });
     });
     ```

  5. **Store in IndexedDB**
     ```typescript
     const embeddingLayer: ActiveEmbeddingLayer = {
       id: generateId(),
       fileId,
       name: userProvidedName,
       provider,
       model,
       dimension: embeddings[0].length,
       compositionMode,
       compositionConfig,
       points: embeddings.map((emb, i) => ({
         id: `point_${i}`,
         embedding: emb,
         coordinates2D: coordinates2D[i],
         sourceRowIndices: getSourceRowIndices(i, compositionMode),
         composedText: composedTexts[i],
         label: compositionMode === 'conversational' ? conversationIds[i] : undefined
       })),
       createdAt: new Date().toISOString(),
       lastAccessedAt: new Date().toISOString()
     };

     await saveActiveEmbeddingLayer(fileId, embeddingLayer);
     ```

  ### Agent Trace Viewer UI (After Generation)

  ```
  ┌─────────────────────────────────────────────┐
  │ Agent Trace Viewer                          │
  ├─────────────────────────────────────────────┤
  │ Active View:                                │
  │ [● Conversation History (150) ▼] [+New] [⋮] │
  │                                             │
  │ Dropdown shows:                             │
  │ ● Conversation History (150 points)         │
  │   Full conversations • voyage-3-lite        │
  │   Created 2h ago                            │
  │                                             │
  │ ○ Turn-Level Analysis (1000 points)         │
  │   Column: user_message • text-emb-3-small   │
  │   Created 1d ago                            │
  │                                             │
  │ ○ Reasoning Clusters (1000 points)          │
  │   LLM judge reasoning • voyage-3            │
  │   Created 3h ago                            │
  ├─────────────────────────────────────────────┤
  │ [Interactive Scatter Plot]                  │
  │ • 150 points displayed                      │
  │ • Rendered with Embedding Atlas             │
  │ • Pan/zoom enabled                          │
  │                                             │
  │ Controls:                                   │
  │ Color by: [None ▼]                          │
  │ Search: [______________] 🔍                 │
  │ [📷 Download PNG]                           │
  ├─────────────────────────────────────────────┤
  │ Detail Panel (appears on point click)       │
  │ ┌─────────────────────────────────────────┐ │
  │ │ Conversation: session_abc123            │ │
  │ │ Turns: 5  •  Duration: 15min            │ │
  │ │                                         │ │
  │ │ [Turn 1] user                           │ │
  │ │ "I need help with billing"              │ │
  │ │                                         │ │
  │ │ [Turn 2] assistant                      │ │
  │ │ "I can help with that"                  │ │
  │ │                                         │ │
  │ │ ... (3 more turns) ...                  │ │
  │ │                                         │ │
  │ │ [Expand Full Conversation]              │ │
  │ └─────────────────────────────────────────┘ │
  └─────────────────────────────────────────────┘
  ```

  **"⋮" Kebab Menu:**
  - Edit Configuration
  - Duplicate View
  - Delete View
  - Download Embedding Data (JSON)

  ### Layer Switching Logic

  **When user selects different layer from dropdown:**
  1. Show loading overlay (~200ms)
  2. Save current active layer to OPFS (if exists)
  3. Delete current layer from IndexedDB ActiveEmbeddingLayer table
  4. Load new layer from OPFS into memory
  5. Store as active layer in IndexedDB
  6. Update file metadata (mark new layer as active)
  7. Render visualization with new data

  ```typescript
  async function switchEmbeddingLayer(newLayerId: string) {
    setLoading(true);

    const currentLayer = await getActiveEmbeddingLayer(fileId);
    if (currentLayer) {
      await saveLayerToOPFS(currentLayer);
      await deleteActiveEmbeddingLayer(fileId);
    }

    const newLayer = await loadLayerFromOPFS(newLayerId);
    await setActiveEmbeddingLayer(fileId, newLayer);
    await updateFileEmbeddingMetadata(fileId, newLayerId);

    setLoading(false);
  }
  ```

  ### Color-By Metadata (For Conversational Embeddings)

  **Aggregation computed on-demand:**
  ```typescript
  // When user selects "Color by: sentiment"
  function colorByMetadata(column: string, points: Point[], rows: Row[]) {
    points.forEach(point => {
      // Get values from source rows
      const values = point.sourceRowIndices.map(idx => rows[idx][column]);

      // Aggregate based on type
      const aggregated = isNumeric(values)
        ? average(values) // For numeric: average
        : mode(values);   // For categorical: most common

      point.color = mapValueToColor(aggregated);
    });
  }
  ```

  **Aggregation strategies:**
  - Numeric: Average, Median, Min, Max
  - Categorical: Mode (most common value)
  - Timestamp: First, Last

  ### PNG Download

  ```typescript
  import { toPng } from 'html-to-image';

  async function downloadVisualization() {
    const node = document.getElementById('atlas-viewer');
    const dataUrl = await toPng(node, {
      width: 1920,
      height: 1080,
      pixelRatio: 2
    });

    const link = document.createElement('a');
    link.download = `${embeddingLayerName}_${timestamp}.png`;
    link.href = dataUrl;
    link.click();
  }
  ```

  ## File Structure

  ```
  src/
  ├── app/
  │   ├── edit/[fileId]/
  │   │   └── page.tsx (ADD: Agent Trace Viewer tab)
  │   └── api/
  │       └── embeddings/
  │           └── generate/
  │               └── route.ts (NEW: SSE endpoint for progress)
  │
  ├── components/
  │   └── embedding-viewer/
  │       ├── agent-trace-viewer.tsx (NEW: Main container)
  │       ├── embedding-layer-dropdown.tsx (NEW)
  │       ├── embedding-wizard.tsx (NEW: Multi-step wizard)
  │       │   ├── step-0-name.tsx
  │       │   ├── step-1-provider-model.tsx
  │       │   ├── step-2-composition-mode.tsx
  │       │   ├── step-3a-single-column.tsx
  │       │   ├── step-3b-multi-column.tsx
  │       │   ├── step-3c-conversational.tsx
  │       │   ├── step-4-review.tsx
  │       │   └── step-5-progress.tsx
  │       ├── embedding-visualization.tsx (NEW: Atlas integration)
  │       ├── embedding-detail-panel.tsx (NEW)
  │       ├── embedding-controls.tsx (NEW: color-by, search, PNG)
  │       └── embedding-empty-state.tsx (NEW)
  │
  ├── lib/
  │   └── embedding/
  │       ├── storage.ts (NEW: IndexedDB + OPFS operations)
  │       ├── text-composer.ts (NEW: compose text from rows)
  │       ├── conversation-aggregator.ts (NEW: group by conversation)
  │       ├── batch-embedder.ts (NEW: batch API calls using AI SDK)
  │       ├── umap-reducer.ts (NEW: wrapper for Atlas UMAP)
  │       └── layer-switcher.ts (NEW: handle active layer switching)
  │
  └── types/
      └── embedding.ts (NEW: all embedding types)
  ```

  ## Atlas Components Used

  ```typescript
  import { createUMAP, EmbeddingView } from 'embedding-atlas';

  // UMAP for dimensionality reduction
  const umap = createUMAP(embeddings, {
    n_neighbors: 15,
    min_dist: 0.1,
    metric: 'cosine'
  });

  // EmbeddingView for scatter plot
  <EmbeddingView
    data={atlasFormattedData}
    onPointClick={handlePointClick}
    colorBy={selectedColumn}
  />
  ```

  ## Integration Points

  **Input:**
  - Existing spreadsheet data from `useFileStorage` hook
  - Provider configuration from `provider-config.json`
  - Model registry from `model-registry.yaml`

  **Output:**
  - New columns in spreadsheet: `_embedding_composition_N`
  - EmbeddingLayer data in IndexedDB + OPFS
  - Interactive visualization in Agent Trace Viewer tab

  **Reuse existing code:**
  - Provider/model selection: Pattern from `/test-generation` page
  - Batch embedding: Use AI SDK `embed()` function
  - File storage: Extend `useFileStorage` hook

  ## Acceptance Criteria

  - [ ] Agent Trace Viewer tab visible in `/edit/[fileId]` at all times
  - [ ] Empty state shows clear CTA: "Create Embedding View"
  - [ ] Multi-step wizard guides user through configuration
  - [ ] Step 1 loads providers with embedding capability only
  - [ ] Step 2 shows three composition modes (single/multi/conversational)
  - [ ] Step 3C includes slider for "Turn plus N" strategy
  - [ ] Step 4 shows review without API cost estimation
  - [ ] Step 5 shows progress with SSE updates from API
  - [ ] Batch embedding uses AI SDK with 100 texts per batch
  - [ ] UMAP coordinates computed during generation (pre-computed)
  - [ ] Composed text column added to table for ALL embedding types
  - [ ] For conversation-level: Composed text duplicated across all rows in conversation
  - [ ] Active layer stored in IndexedDB, others in OPFS
  - [ ] Layer dropdown shows all embedding views with metadata
  - [ ] Switching layers shows ~200ms loader
  - [ ] Scatter plot renders with Embedding Atlas
  - [ ] Click point → detail panel shows conversation/row data
  - [ ] Color-by dropdown aggregates metadata on-demand for conversation-level
  - [ ] PNG download button exports current visualization
  - [ ] No sync between table and visualization (simplified)
  - [ ] Handles 1000+ points smoothly
  - [ ] Kebab menu allows edit/delete/duplicate/export
  - [ ] Error handling: Shows warning for failed points, continues with successful ones
  - [ ] Supports multiple embedding layers per file (dropdown to switch)

  ---
  Feature 2: UMAP Projection & Atlas Viewer

  What to Build

  2D projection computation and interactive scatter plot

  Technical Scope

  // New files
  src/lib/embeddings/
  └── projection.ts         // UMAP wrapper + caching

  src/components/visualization/
  ├── AtlasViewer.tsx       // Wrapper around Atlas EmbeddingView
  └── ProjectionConfig.tsx  // UMAP parameter controls

  src/lib/atlas-integration.ts  // SpreadsheetData → Atlas format

  // New route
  src/app/visualize/[fileId]/page.tsx

  // IndexedDB schema
  interface ProjectionCache {
    id: string                    // embeddingHash + method + params
    method: 'umap' | 'tsne' | 'pca'
    projections: {x: number, y: number}[]
    params: UMAPParams
    createdAt: Date
  }

  Atlas Components Used

  import { createUMAP, EmbeddingView } from 'embedding-atlas'

  // Fork decision: Use npm package first, fork only if needed

  Key Implementation Details

  Data Transformation Pipeline:
  SpreadsheetData[]
    → generate embeddings
    → compute UMAP projection
    → format for Atlas:
        {
          table: MosaicTable,    // Convert rows to Mosaic format
          id: 'row_index',
          text: 'user_input',    // Or selected column
          projection: { x: 'proj_x', y: 'proj_y' }
        }

  UMAP Configuration:
  const UMAP_DEFAULTS = {
    n_neighbors: 15,
    min_dist: 0.1,
    metric: 'cosine',
    n_components: 2
  }

  Integration Points

  - Trigger: After Feature 1 completes, navigate to /visualize/[fileId]
  - Input: Cached embeddings from Feature 1
  - Output: Interactive scatter plot in new route

  Acceptance Criteria

  - UMAP computes 2D coordinates from embeddings
  - Projections cached (reuse on reload)
  - AtlasViewer renders scatter plot with zoom/pan
  - Click point → shows original row data in tooltip
  - Points colored by default (single color)
  - UMAP parameters adjustable via UI (n_neighbors, min_dist)
  - Handles 1000+ points smoothly (WebGPU rendering)
  - Loading states for computation steps

  ---
  Feature 3: Dual Search System

  What to Build

  String keyword search + semantic similarity search

  Technical Scope

  // New files
  src/lib/search/
  ├── string-search.ts      // FlexSearch integration
  ├── semantic-search.ts    // Cosine similarity k-NN
  └── search-ui.tsx         // Unified search interface

  // Add to AtlasViewer
  <SearchInterface
    data={spreadsheetData}
    embeddings={embeddings}
    onHighlight={(indices) => {}}
  />

  Search Types

  Type 1: String/Keyword Search
  - Use Atlas's built-in FlexSearch or integrate separately
  - Search across all text columns
  - Highlight matching points on graph

  Type 2: Semantic Search
  interface SemanticSearch {
    // Embed query text → find k-NN
    searchByText(query: string, k: number): number[]

    // Use clicked point's embedding for similarity
    findSimilar(pointIndex: number, k: number): number[]

    // Compute cosine similarity
    cosineSimilarity(vec1: number[], vec2: number[]): number
  }

  Performance Strategy:
  - Small datasets (<10k): Brute-force cosine similarity
  - Large datasets (>10k): Use Atlas's createKNN() or hnswlib-wasm

  Atlas Components Used

  import { createKNN } from 'embedding-atlas'

  // For large datasets
  const knn = createKNN(embeddings, { metric: 'cosine' })
  const neighbors = knn.query(queryVector, k)

  Integration Points

  - UI Location: Search bar at top of AtlasViewer
  - Outputs: Highlighted points on scatter plot + filtered table

  Acceptance Criteria

  - Search bar with mode toggle (String / Semantic)
  - String search highlights matching points (<100ms latency)
  - Semantic search embeds query → highlights k-NN
  - Right-click point → "Find Similar" context menu
  - Results show similarity scores
  - Search results persist when zooming/panning
  - Clear search button resets view

  ---
  Feature 4: Metadata Overlay System

  What to Build

  Dynamic column visualization with auto-generated charts

  Technical Scope

  // New files
  src/lib/visualization/
  ├── column-analyzer.ts    // Infer column types
  ├── chart-mapper.ts       // Column type → chart type
  └── color-schemes.ts      // Categorical color palettes

  src/components/visualization/
  ├── MetadataPanel.tsx     // Column list + controls
  ├── ColumnCard.tsx        // Individual column config
  └── ChartPreview.tsx      // Auto-generated chart

  Column Type Inference

  type ColumnType = 'categorical' | 'numerical' | 'datetime' | 'text'
  type ChartType = 'bar' | 'histogram' | 'heatmap' | 'timeline'

  function inferChartType(column: ColumnMetadata): ChartType {
    if (column.type === 'categorical') {
      return column.uniqueValues.length < 20 ? 'bar' : 'histogram'
    }
    if (column.type === 'numerical') {
      return /price|cost|amount/.test(column.name) ? 'heatmap' : 'histogram'
    }
    if (column.type === 'datetime') return 'timeline'
    return 'histogram'
  }

  Atlas Components Used

  // Atlas integrates with Mosaic for charts
  import { EmbeddingViewMosaic } from 'embedding-atlas'

  // Use Mosaic's declarative chart API (hide raw SQL/spec editor from user)

  Key Features

  1. Column List Panel (left sidebar in /visualize)
    - Shows all spreadsheet columns
    - Toggle visibility checkbox
    - Auto-shows chart when toggled on
  2. Color Overlay on Scatter Plot
    - Categorical: Each category gets unique color
    - Numerical: Color gradient (viridis, plasma, etc.)
  3. Linked Selection
    - Click bar in chart → filters scatter plot
    - Select points on scatter → updates chart
  4. Chart Configuration (per column)
    - Chart type dropdown (override auto-inference)
    - Color scheme picker
    - Bin count for histograms

  Integration Points

  - Data Source: Existing spreadsheet columns
  - Rendering: Sidebar panel in /visualize/[fileId]

  Acceptance Criteria

  - MetadataPanel lists all columns with types
  - Toggle column → scatter plot points change color
  - Auto-generated chart appears below toggle
  - Click chart element → filters scatter plot
  - Support 5+ simultaneous overlays
  - Color legend visible for active overlays
  - Chart type manually overrideable
  - No Mosaic SQL editor exposed to user

  ---
  Feature 5: Automated Clustering

  What to Build

  Density-based clustering with algorithm selection

  Technical Scope

  // New files
  src/lib/clustering/
  ├── algorithms.ts         // HDBSCAN, k-means, DBSCAN
  ├── quality-metrics.ts    // Silhouette score
  └── color-palette.ts      // Generate N distinct colors

  src/components/visualization/
  ├── ClusteringPanel.tsx   // Algorithm config + results
  └── ClusterCard.tsx       // Individual cluster info

  // IndexedDB schema
  interface ClusterCache {
    id: string                    // embeddingHash + method + params
    method: 'hdbscan' | 'kmeans' | 'dbscan'
    clusterIds: number[]          // One per data point
    clusterCenters: number[][]
    silhouetteScore: number
    params: ClusterParams
  }

  Clustering Algorithms

  Option A: Client-side (JavaScript)
  import { DBSCAN, KMeans } from 'ml-clustering'
  import hdbscanjs from 'hdbscanjs'

  Option B: Use Atlas's density clustering
  import { findClusters } from 'embedding-atlas'

  const clusters = findClusters(projections, {
    bandwidth: 0.1,
    minClusterSize: 10
  })

  Recommendation: Start with Atlas's findClusters(), fallback to ml-clustering for k-means

  UI Components

  ClusteringPanel (right sidebar):
  <Panel>
    <Select label="Algorithm">
      <Option value="hdbscan">HDBSCAN (auto-detect)</Option>
      <Option value="kmeans">k-Means (specify k)</Option>
      <Option value="atlas-density">Atlas Density</Option>
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

    <Button onClick={runClustering}>Run Clustering</Button>

    {clusterResult && (
      <ClusterList>
        {clusterResult.clusters.map(cluster => (
          <ClusterCard
            key={cluster.id}
            cluster={cluster}
            onHighlight={() => highlightCluster(cluster.id)}
          />
        ))}
      </ClusterList>
    )}
  </Panel>

  Integration Points

  - Input: Embeddings from Feature 1 OR projections from Feature 2
  - Output: Cluster assignments → color scatter plot points

  Acceptance Criteria

  - User selects algorithm + parameters
  - Clustering completes with progress indicator
  - Points colored by cluster on scatter plot
  - Cluster boundaries visible (convex hull or contours)
  - ClusterCard shows: size, centroid, color swatch
  - Click cluster card → highlights on graph
  - Silhouette score displayed as quality metric
  - Results cached in IndexedDB
  - Handles 1000+ points in <30 seconds

  ---
  Feature 6: LLM Cluster Labeling

  What to Build

  AI-powered descriptive labels for discovered clusters

  Technical Scope

  // New files
  src/lib/clustering/
  ├── labeling.ts           // LLM prompt generation
  ├── sample-selection.ts   // Diverse example sampling
  └── keyword-extraction.ts // Extract keywords per cluster

  // Extend ClusterCache schema
  interface ClusterCache {
    // ... existing fields
    labels?: string[]         // LLM-generated labels
    keywords?: string[][]     // Keywords per cluster
    labelingModel?: string
  }

  Labeling Pipeline

  Step 1: Sample Diverse Examples
  function sampleDiverseExamples(
    clusterPoints: SpreadsheetData[],
    clusterCenter: number[],
    count: number = 5
  ): SpreadsheetData[] {
    // Sort by distance to centroid
    // Take samples from percentiles: 0%, 25%, 50%, 75%, 100%
    // Ensures diversity within cluster
  }

  Step 2: Generate LLM Prompt
  const prompt = `
  You are analyzing a cluster of ${clusterSize} similar conversations.
  Here are ${samples.length} representative examples:

  ${samples.map((s, i) => `
  Example ${i+1}:
  User: ${s.user_input}
  Agent: ${s.agent_response}
  `).join('\n')}

  Generate:
  1. A concise label (2-4 words) describing the common theme
  2. 3-5 keywords

  Format:
  Label: <label>
  Keywords: <keyword1>, <keyword2>, ...
  `

  Step 3: Parse Response
  function parseLabelResponse(response: string): {
    label: string
    keywords: string[]
  }

  UI Integration

  Enhance ClusterCard:
  <ClusterCard>
    <div className="cluster-header">
      <ColorSwatch color={cluster.color} />
      <span className="cluster-id">Cluster {cluster.id}</span>
    </div>

    <div className="cluster-label">
      {cluster.label || (
        <Button onClick={() => generateLabel(cluster.id)}>
          Generate Label
        </Button>
      )}
    </div>

    {cluster.label && (
      <Input
        value={cluster.label}
        onChange={(e) => updateLabel(cluster.id, e.target.value)}
        placeholder="Edit label..."
      />
    )}

    <div className="cluster-keywords">
      {cluster.keywords?.map(kw => <Tag key={kw}>{kw}</Tag>)}
    </div>

    <div className="cluster-stats">
      Size: {cluster.size} | Density: {cluster.density.toFixed(2)}
    </div>
  </ClusterCard>

  Model Selection

  Reuse existing model infrastructure from src/lib/models.ts:
  - GPT-4 (best quality, expensive)
  - Claude Haiku (fast, cheap)
  - Groq Llama (very fast, free tier)

  Integration Points

  - Depends on: Feature 5 (clustering must complete first)
  - API: Reuse src/lib/ai-inference.ts pattern
  - UI: Button in ClusterCard

  Acceptance Criteria

  - "Generate Labels" button appears after clustering
  - LLM generates labels for all clusters in batch
  - Labels appear in ClusterCard within 2 seconds per cluster
  - User can manually edit labels
  - Keywords extracted and displayed as tags
  - Labeling model selectable (GPT-4, Claude, etc.)
  - Re-generate individual cluster label on click
  - Labels persist in IndexedDB cache

  ---
  Feature 7: Strategic Sampling (Boundary Detection)

  What to Build

  Active learning feature to identify high-value examples for labeling

  Technical Scope

  // New files
  src/lib/active-learning/
  ├── boundary-detection.ts     // Uncertainty scoring
  ├── density-boundaries.ts     // Low-density region detection
  └── export.ts                 // CSV export for labeling

  src/components/visualization/
  ├── StrategicSamplingPanel.tsx  // Main UI
  ├── BoundaryCard.tsx            // Individual uncertain point
  └── UncertaintyHistogram.tsx    // Distribution chart

  // IndexedDB schema (extend ClusterCache)
  interface ClusterCache {
    // ... existing fields
    boundaryPoints?: BoundaryPoint[]
  }

  interface BoundaryPoint {
    index: number
    uncertainty: number        // 0-1 score
    nearestClusters: number[]  // IDs of ambiguous clusters
    reasoning?: string         // LLM explanation
  }

  Uncertainty Scoring Methods

  Method 1: Centroid Distance Comparison
  function computeUncertainty(
    embedding: number[],
    clusterCenters: number[][]
  ): number {
    // Compute distance to all centroids
    const distances = clusterCenters.map(center =>
      cosineSimilarity(embedding, center)
    ).sort((a, b) => b - a)  // Descending

    const firstClosest = distances[0]
    const secondClosest = distances[1]

    // High uncertainty = similar distance to top 2 clusters
    return 1 - (firstClosest - secondClosest)
  }

  Method 2: Density-Based (using Atlas)
  // Points with low density AND near multiple clusters = boundaries
  function detectLowDensityBoundaries(
    projections: {x: number, y: number}[],
    densityMap: DensityEstimate,  // From Atlas
    clusters: ClusterResult
  ): BoundaryPoint[]

  LLM Reasoning Enhancement

  For top N boundary points, ask LLM:
  const prompt = `
  This conversation is ambiguous between clusters:
  - Cluster A: "${clusterLabels[0]}"
  - Cluster B: "${clusterLabels[1]}"

  Conversation:
  User: ${example.user_input}
  Agent: ${example.agent_response}

  Why is this difficult to categorize? (1 sentence)
  `

  UI Design

  StrategicSamplingPanel (bottom drawer):
  <Panel>
    <header>
      <h3>Strategic Sampling: {boundaryPoints.length} Uncertain Examples</h3>
      <p>Focus labeling efforts here for maximum impact</p>
    </header>

    <UncertaintyHistogram data={boundaryPoints} />

    <div className="boundary-list">
      {boundaryPoints.slice(0, 20).map(bp => (
        <BoundaryCard
          key={bp.index}
          point={bp}
          data={spreadsheetData[bp.index]}
          onHighlight={() => highlightOnGraph(bp.index)}
          onExplain={() => generateReasoning(bp)}
        />
      ))}
    </div>

    <footer>
      <Select label="Export Top N" options={[10, 25, 50, 100]} />
      <Button onClick={exportForLabeling}>Export CSV</Button>
    </footer>
  </Panel>

  Graph Visualization:
  - Boundary points rendered with red circles (larger size)
  - Yellow border for emphasis
  - Hover → shows uncertainty score + reasoning

  Export Format

  index,uncertainty_score,ambiguous_between,user_input,agent_response,llm_reasoning,suggested_label
  42,0.87,"Technical Support vs Billing",How do I reset password?,Here's how...,This combines account access (technical)
  with billing portal access,

  Integration Points

  - Depends on: Feature 5 (clustering) + Feature 6 (labels)
  - Trigger: "Find Boundary Cases" button in ClusteringPanel
  - Output: CSV export for human labeling

  Acceptance Criteria

  - Boundary detection runs after clustering completes
  - Points ranked by uncertainty score (highest first)
  - Top 50 boundary points highlighted on graph (red circles)
  - StrategicSamplingPanel shows ranked list
  - Click boundary card → highlights on graph + shows in table
  - "Explain Why" button generates LLM reasoning
  - Uncertainty histogram shows distribution
  - Export CSV includes all context + reasoning
  - Toggle "Show Only Boundaries" filters view
  - Handles 10k+ dataset in <10 seconds

  ---
  Feature 8: Bidirectional Selection Sync

  What to Build

  Link scatter plot selection with spreadsheet table

  Technical Scope

  // Modify existing components
  src/app/visualize/[fileId]/page.tsx
  src/components/spreadsheet/SpreadsheetTable.tsx

  // Add selection state management
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])

  // Bidirectional sync
  <AtlasViewer
    onSelectionChange={(indices) => {
      setSelectedIndices(indices)
      scrollTableToRow(indices[0])
    }}
  />

  <SpreadsheetTable
    selectedRows={selectedIndices}
    onRowSelect={(indices) => {
      setSelectedIndices(indices)
      highlightPointsOnGraph(indices)
    }}
  />

  Selection Behaviors

  From Graph → Table:
  - Click point → scroll to row in table + highlight
  - Brush select → highlight multiple rows
  - Double-click → open row in detail view

  From Table → Graph:
  - Click row → highlight point on graph + zoom to it
  - Multi-select rows → highlight multiple points
  - Ctrl+click → add to selection

  Atlas Integration

  // Atlas EmbeddingView supports selection callbacks
  <EmbeddingView
    selection={selectedIndices}
    onSelectionChange={(newSelection) => {
      // Handle selection update
    }}
  />

  Acceptance Criteria

  - Click graph point → table scrolls to row
  - Click table row → graph highlights + zooms to point
  - Multi-select works in both directions
  - Selection state persists when switching tabs
  - Selection cleared with Escape key
  - Selection visible in both views simultaneously
  - Latency <50ms for selection sync

  ---
  Feature 9: Export & Sharing

  What to Build

  Export visualizations and data in multiple formats

  Technical Scope

  // New files
  src/lib/export/
  ├── image-export.ts          // PNG/SVG export
  ├── html-export.ts           // Interactive HTML embed
  ├── parquet-export.ts        // Data export for external tools
  └── state-export.ts          // Save visualization config

  src/components/visualization/
  └── ExportMenu.tsx           // Export options dropdown

  Export Formats

  1. Static Image
  // Use Atlas's built-in canvas export
  async function exportAsPNG(
    atlasRef: EmbeddingViewRef,
    options: { width: number, height: number }
  ): Promise<Blob>

  async function exportAsSVG(
    atlasRef: EmbeddingViewRef
  ): Promise<string>

  2. Interactive HTML
  <!DOCTYPE html>
  <html>
    <head>
      <script src="https://unpkg.com/embedding-atlas"></script>
    </head>
    <body>
      <div id="atlas"></div>
      <script>
        // Embed full Atlas viewer with data
        const atlas = new EmbeddingAtlas({
          container: '#atlas',
          data: {{ embedded_data }}
        })
      </script>
    </body>
  </html>

  3. Parquet Data Export
  import parquet from 'parquetjs'

  async function exportAsParquet(
    data: SpreadsheetData[],
    embeddings: number[][],
    projections: {x: number, y: number}[],
    clusters: number[]
  ): Promise<Blob> {
    // Combine all data + derived fields
    // Write to Parquet format
    // Compatible with external tools (Python, R, Tableau)
  }

  4. Visualization State
  interface VisualizationState {
    fileId: string
    embeddingStrategy: EmbeddingStrategy
    embeddingModel: string
    umapParams: UMAPParams
    clusterMethod: ClusteringMethod
    clusterParams: Record<string, any>
    clusterLabels: string[]
    activeMetadataColumns: string[]
    viewportState: { zoom: number, center: [number, number] }
    colorScheme: string
  }

  // Export as JSON for re-importing

  UI Integration

  ExportMenu (toolbar in /visualize):
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Button>Export</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={exportPNG}>
        <ImageIcon /> Export as PNG
      </DropdownMenuItem>
      <DropdownMenuItem onClick={exportSVG}>
        <VectorIcon /> Export as SVG
      </DropdownMenuItem>
      <DropdownMenuItem onClick={exportHTML}>
        <CodeIcon /> Export Interactive HTML
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={exportParquet}>
        <DatabaseIcon /> Export Data (Parquet)
      </DropdownMenuItem>
      <DropdownMenuItem onClick={exportCSV}>
        <TableIcon /> Export Data (CSV)
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={exportState}>
        <SaveIcon /> Save Visualization State
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  Acceptance Criteria

  - Export PNG at current viewport or full graph
  - Export SVG with embedded labels
  - Interactive HTML includes full Atlas viewer
  - Parquet export includes all derived columns
  - CSV export matches Parquet data
  - State export saves all configuration
  - Import state recreates exact visualization
  - All exports complete in <3 seconds

  ---
  Feature 10: Incremental Updates

  What to Build

  Efficiently handle new rows added to spreadsheet

  Technical Scope

  // Modify existing caching system
  src/lib/embeddings/cache.ts

  interface EmbeddingCache {
    // ... existing fields
    rowHashes: string[]      // Hash of each row's content
    lastUpdated: Date
  }

  // Incremental update logic
  async function updateEmbeddings(
    fileId: string,
    newRows: SpreadsheetData[],
    existingCache: EmbeddingCache
  ): Promise<number[][]> {
    // 1. Identify new/changed rows by hash comparison
    // 2. Generate embeddings for only new rows
    // 3. Append to existing embedding array
    // 4. Update cache
  }

  UMAP Incremental Projection

  Challenge: UMAP doesn't support incremental updates natively

  Solution Options:

  Option A: Approximate Projection
  // Use existing UMAP model to project new points
  // into existing space (faster but less accurate)
  async function projectNewPoints(
    newEmbeddings: number[][],
    existingUMAP: UMAP
  ): Promise<{x: number, y: number}[]>

  Option B: Full Re-projection
  // Re-run UMAP on all points (slow but accurate)
  // Only trigger if >10% of data is new
  async function recomputeProjection(
    allEmbeddings: number[][]
  ): Promise<{x: number, y: number}[]>

  Recommendation: Use Option A for <100 new rows, Option B for larger updates

  UI Indicators

  Update Flow:
  User adds 50 new rows in SpreadsheetEditor
    → Auto-detect change via useFileStorage
    → Show toast: "Visualization outdated. Refresh?"
    → User clicks "Refresh"
    → Incremental embedding (only 50 new rows)
    → Append to projection
    → Re-render AtlasViewer with new points

  Visual Differentiation:
  - New points shown with distinct color/border
  - "Added Today" filter in MetadataPanel
  - Animation: new points fade in

  Integration Points

  - Trigger: useFileStorage detects file update
  - Input: Diff between cached and current data
  - Output: Updated visualization

  Acceptance Criteria

  - Detect when spreadsheet has new rows
  - Show "Refresh Visualization" prompt
  - Incremental embedding for <100 new rows
  - Full re-embedding for >100 new rows
  - Projection updates without full recompute (if <10% change)
  - New points visually distinguished
  - Cache invalidation prevents stale data
  - Refresh completes in <5 seconds for 50 new rows

  ---
  Atlas Component Inventory

  From npm Package (Direct Use)

  npm install embedding-atlas

  Available imports:
  // React Components
  import {
    EmbeddingAtlas,      // Full viewer (use in Feature 2)
    EmbeddingView,       // Core scatter plot (use in Feature 2)
    EmbeddingViewMosaic, // With Mosaic charts (use in Feature 4)
    Table                // Data table (optional)
  } from 'embedding-atlas'

  // Algorithms
  import {
    createUMAP,          // WASM UMAP (use in Feature 2)
    createKNN,           // k-NN search (use in Feature 3)
    findClusters         // Density clustering (use in Feature 5)
  } from 'embedding-atlas'

  From Forked Repository (If Customization Needed)

  git clone https://github.com/apple/embedding-atlas.git packages/atlas-fork

  Packages to extract:
  - packages/umap-wasm → If UMAP params need extension
  - packages/component → If scatter plot styling needs customization
  - packages/density-clustering → If clustering algorithm needs modification

  Fork decision checkpoint: After implementing Features 2-5, assess if npm package meets needs

  ---
  Dependencies to Install

  # Core Atlas
  npm install embedding-atlas @uwdata/mosaic-core @uwdata/mosaic-sql

  # Clustering (if not using Atlas's)
  npm install ml-clustering hdbscanjs

  # Search
  npm install flexsearch  # If Atlas's search insufficient

  # Export
  npm install parquetjs

  # Existing FluffyViz deps (already installed)
  # - OpenAI SDK (for embeddings)
  # - Next.js, React, TypeScript, Tailwind, IndexedDB

  ---
  Implementation Order Recommendation

  For agentic development, implement in this sequence to minimize blockers:

  1. Feature 1 (Embedding System) - No dependencies
  2. Feature 2 (UMAP + Atlas Viewer) - Depends on Feature 1
  3. Feature 4 (Metadata Overlays) - Depends on Feature 2 (needs Atlas viewer)
  4. Feature 3 (Search) - Depends on Features 1, 2 (needs embeddings + viewer)
  5. Feature 5 (Clustering) - Depends on Features 1, 2 (needs embeddings + viewer)
  6. Feature 6 (LLM Labeling) - Depends on Feature 5 (needs clusters)
  7. Feature 7 (Boundary Detection) - Depends on Features 5, 6 (needs labeled clusters)
  8. Feature 8 (Selection Sync) - Depends on Feature 2 (needs viewer + table)
  9. Feature 9 (Export) - Depends on Features 2-7 (needs full visualization)
  10. Feature 10 (Incremental Updates) - Depends on all (optimization layer)

  Parallel Development Possible:
  - Features 3, 4, 5 can be built simultaneously after Feature 2
  - Features 8, 9 are independent and can be built anytime after Feature 2
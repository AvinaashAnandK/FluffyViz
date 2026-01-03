# FluffyViz Product Overview

## What is FluffyViz?

FluffyViz is a **local-first web application** that transforms raw AI agent conversation logs into actionable spreadsheet data with AI-powered augmentation. Built for AI/ML engineers and product managers who need to analyze, enrich, and visualize their agent data without compromising privacy.

**Core Workflow**: Upload → Augment → Visualize

---

## Key Features

### 1. Multi-Format Data Import

Upload your agent data in any common format:

- **JSONL** - Message-centric conversation logs
- **JSON** - Langfuse spans, LangSmith runs, Arize traces
- **CSV** - Turn-level structured data

FluffyViz automatically detects your data format and flattens nested structures into clean spreadsheet columns using dot notation (e.g., `user.name`, `response.tokens`).

### 2. Spreadsheet Editor

View and edit your data in a familiar spreadsheet interface:

- **Pagination** - Handle large datasets efficiently (100 rows/page)
- **Sorting** - Sort by any column
- **Filtering** - Query with operators: `=`, `!=`, `>`, `<`, `LIKE`, `IS NULL`, etc.
- **Inline Editing** - Click any cell to edit
- **Column Width Persistence** - Your column sizes are remembered

### 3. AI-Powered Column Augmentation

Add intelligent columns using AI models:

**Built-in Templates**:
- Translate text to multiple languages
- Extract keywords
- Summarize content
- Analyze sentiment
- Classify into categories
- Custom prompts (single or multi-column input)

**Model Selection**:
- Search models from HuggingFace registry
- Choose from 10+ providers: OpenAI, Anthropic, Google, Perplexity, Groq, Together AI, Mistral, Cohere, Novita, HuggingFace
- Configure API keys per provider

**Prompt Editor**:
- Rich text editor with variable pills
- Type `@` to insert column references
- Preview interpolated prompts before generation

**Generation Settings**:
- Temperature control (creativity vs. focus)
- Max tokens limit
- Web search configuration

### 4. Web Search Augmentation

Enhance AI responses with real-time web information:

**How It Works**:
- Enable "Web Search" toggle in Generation Settings
- Configure location (City, Region, Country as ISO code)
- AI queries the web before generating responses
- Sources automatically saved to companion `_sources` column

**Supported Providers**:
| Provider | Search Type | Notes |
|----------|-------------|-------|
| OpenAI | Tool-based | Uses `web_search_preview` tool via Responses API |
| Perplexity | Built-in | Always searches, location optional |
| Google | Grounding | Search grounding for Gemini models |

**Location Settings**:
- City: Free text (e.g., "Bangalore")
- Region: Free text (e.g., "Karnataka")
- Country: ISO code (e.g., "IN" for India, "US" for USA)

**Output**:
- Main column: AI response with current information
- Sources column: JSON array of URLs used

### 5. Conversational History Aggregation

Transform multi-turn conversations into formatted context:

**Aggregation Strategies**:
- `turn_only` - Single turn
- `history_until_turn` - All turns up to current
- `turn_plus_n` - Current turn plus N previous
- `full_conversation` - Entire conversation

Uses `conversation_id` and `sequence_id` columns to group and order turns.

### 6. Structured Output Mode

Generate JSON responses validated against a schema:

**Features**:
- Define output fields with types (string, number, boolean, array)
- Schema validation ensures consistent output
- Automatic expansion into separate columns per field
- Works with all providers via Vercel AI SDK

### 7. Embedding Visualization

Generate and visualize semantic embeddings with advanced clustering and analysis tools:

**Composition Modes**:
- Single column embedding
- Multiple columns with separator
- Full conversational context (cross-row aggregation)

**Two-Stage UMAP Projection**:
- Stage 1: High-D → 15D (min_dist=0.0) for accurate clustering
- Stage 2: High-D → 2D (min_dist=0.1) for visualization
- Pre-computed k-nearest neighbors for fast search

**Hybrid Clustering (HDBSCAN + K-Means)**:
- HDBSCAN discovers natural cluster count (k) on 15D UMAP
- K-Means tests k-range with silhouette scoring on original embeddings
- L2-normalized embeddings for cosine-like distance in K-Means
- 100% point assignment (no outliers)
- Configurable parameters:
  - UMAP Neighbors (15-100): Higher = more global structure
  - Min Cluster Size (5-50): Minimum points to form a cluster
  - Min Samples (1-15): Core point threshold for HDBSCAN

**Interactive Visualization**:
- **View Modes**: Points or Density contours
- **Point Size Control**: Manual or automatic sizing
- **Auto Cluster Labels**: Label dense regions automatically
- **Re-clustering**: Adjust parameters and re-cluster on the fly
- **Cluster Statistics**: View cluster count, sizes, and silhouette score
- **State Persistence**: View settings saved per layer

**Save Filter**:
- Select points in the visualization
- Save selections as reusable filters
- Apply filters to spreadsheet view

### 8. Cluster Management UI

A comprehensive dialog for managing, naming, and organizing clusters:

**Overview Tab**:
- View all clusters as cards with sample conversations
- **Name All Clusters**: One-click LLM-based naming with configurable provider/model
- **Inline Editing**: Click to manually edit cluster titles
- **Cluster Cards**: Display title, labels, description, and sample texts
- **Advanced Settings**: Re-cluster with new parameters (UMAP neighbors, min cluster size, min samples)

**Agglomerate Tab**:
- Merge similar clusters into super-topics
- **Similarity Threshold**: Slider control (0.0 - 1.0, typically 0.70 - 0.90)
- **Linkage Methods**: Average (recommended), Complete (conservative), Single (aggressive)
- **Preview Results**: See merged groups before applying
- **Apply/Cancel**: Review and confirm before changes are saved

**Validate Tab** (Coming Soon):
- LLM validation of cluster quality
- Coherence scoring and improvement suggestions

### 9. Cluster Analysis Console Tools

Browser console tools (`window.clusterSim`) for advanced cluster exploration:

**Similarity Analysis**:
- Compute cosine similarity between cluster centroids
- Find most similar clusters (top-k neighbors)
- Discover all pairs above a similarity threshold
- Get full pairwise similarity matrix

**Agglomerative Clustering**:
- Merge clusters into super-topics based on similarity
- Three linkage methods: average, single, complete
- Configurable similarity threshold

**LLM-based Cluster Labeling**:
- Generate semantic titles, labels, and descriptions
- Sample conversations from clusters for context
- Batch labeling with configurable concurrency
- Cache results for repeated queries

See [technical_docs.md](./technical_docs.md) for usage examples.

### 10. Privacy-First Architecture

- **All data stays in your browser** - DuckDB WASM database
- **No server-side storage** - Files stored in IndexedDB
- **Provider API calls** - Only when you explicitly generate content
- **Max file size** - 50MB (warning at 30MB)

---

## Target Users

### ML Engineers

Transform raw agent logs into structured data for:
- Model performance analysis
- Quality evaluation (LLM-as-a-Judge)
- A/B testing insights
- Error pattern detection
- Semantic cluster analysis

### AI Product Managers

Gain insights into:
- User interaction patterns
- Feature performance metrics
- Conversation quality trends
- Content categorization
- Topic clustering

---

## User Workflow

### Step 1: Upload

1. Drag and drop or click to select file
2. FluffyViz auto-detects format with confidence scoring
3. Preview data structure before import
4. Override format if detection is incorrect

### Step 2: Edit & Explore

1. Browse data in spreadsheet view
2. Sort and filter to find patterns
3. Edit cells inline as needed
4. Navigate with pagination controls

### Step 3: Augment with AI

1. Click "Add Column" button
2. Select a template or write custom prompt
3. Choose AI model and provider
4. Configure Generation Settings:
   - Temperature and max tokens
   - Enable web search (optional)
   - Set location for local results
5. Map template variables to columns
6. Preview interpolated prompt
7. Generate augmented data

### Step 4: Review Results

- AI responses appear in new column
- Sources (if web search enabled) in `_sources` column
- Cell metadata tracks status (success/failed)
- Retry failed cells with different models

### Step 5: Iterate

- Add multiple AI columns
- Aggregate conversational history
- Generate embeddings for visualization

### Step 6: Visualize

1. Open Embedding Wizard
2. Select composition mode (Single/Multi/Cross-Row)
3. Choose columns to embed
4. Configure embedding provider (OpenAI, Cohere)
5. Generate embeddings with automatic clustering
6. Explore interactive scatter plot:
   - Switch between Points and Density views
   - Adjust point size
   - Enable/disable auto cluster labels
   - View cluster statistics
7. Click points to view full traces
8. Save point selections as filters

### Step 7: Manage Clusters

1. Click "Clusters" button in visualization toolbar
2. Use **Cluster Management Dialog**:
   - **Overview Tab**: View cluster cards with sample conversations
   - **Name All**: Generate LLM-based titles for all clusters
   - **Edit**: Click pencil icon to manually edit cluster names
   - **Advanced Settings**: Re-cluster with new parameters
3. **Agglomerate Tab**: Merge similar clusters into super-topics
   - Set similarity threshold (0.70 - 0.90 typical)
   - Choose linkage method (average recommended)
   - Preview and apply merges
4. Named clusters appear on the visualization

---

## Supported Data Formats

| Format | File Type | Description |
|--------|-----------|-------------|
| Message-Centric | JSONL | Simple `{role, content, timestamp}` turns |
| Langfuse Spans | JSON | Observations with type (SPAN/GENERATION/EVENT) |
| LangSmith Runs | JSON | LLM runs with inputs, outputs, metadata |
| Arize Traces | JSON | ML observability traces |
| Turn-Level | CSV | Pre-structured tabular data |

---

## AI Provider Support

| Provider | Free Tier | Text | Embeddings | Web Search | Streaming |
|----------|-----------|------|------------|------------|-----------|
| OpenAI | No | Yes | Yes | Yes | Yes |
| Perplexity | No | Yes | No | Built-in | Yes |
| Google AI | Yes | Yes | Yes | Yes | Yes |
| Anthropic | No | Yes | No | No | Yes |
| Groq | Yes | Yes | No | No | Yes |
| Cohere | Yes | Yes | Yes | No | Yes |
| Mistral | Yes | Yes | Yes | No | Yes |
| Together AI | Yes | Yes | No | No | Yes |
| HuggingFace | Yes | Yes | Yes | No | Yes |
| Novita AI | Yes | Yes | No | No | Yes |

---

## Built-in Templates

### Translation
Translate text to specified languages while preserving tone and context.

### Keyword Extraction
Extract relevant keywords and phrases from content.

### Summarization
Generate concise summaries of longer text.

### Sentiment Analysis
Classify sentiment as positive, negative, or neutral with confidence scores.

### Classification
Categorize content into user-defined classes.

### Custom Prompts
Write your own prompts with:
- Single column input - reference one data column
- Multi-column input - combine multiple columns
- Web search augmentation - get current information

### Conversational History
Aggregate multi-turn conversations with configurable strategies.

---

## Getting Started

### Prerequisites
- Modern browser (Chrome, Firefox, Safari, Edge)
- Optional: API keys for AI providers

### Quick Start

1. Open FluffyViz in your browser
2. Upload a sample file (JSON, JSONL, or CSV)
3. Explore the spreadsheet editor
4. Add an AI column using a template
5. Configure your provider API key
6. Enable web search for current information (optional)
7. Generate augmented data

### Sample Files

FluffyViz works with standard agent log formats:
- Message-centric JSONL
- Langfuse/LangSmith JSON exports
- Turn-level CSV files

---

## Performance Considerations

- **File size limit**: 50MB maximum
- **Large datasets**: Use filtering and pagination for datasets >1000 rows
- **Embedding generation**: Batch processing with progress tracking
- **Model selection**: Some providers have rate limits on free tiers
- **Web search**: Adds latency (~1-3 seconds per request)
- **Clustering**: Hybrid approach uses HDBSCAN + K-Means for accurate results

---

## Privacy & Security

FluffyViz is designed with privacy as a core principle:

- **No account required** - Start using immediately
- **Browser-only storage** - Data never leaves your machine
- **API keys stored locally** - In browser config, not transmitted to FluffyViz servers
- **Open source** - Audit the code yourself

**Note**: When generating AI content, data is sent to your selected provider (OpenAI, Anthropic, etc.) according to their privacy policies.

---

## Technical Highlights

### Hybrid Clustering System
FluffyViz uses a sophisticated two-stage clustering approach:
1. **HDBSCAN on 15D UMAP**: Discovers natural cluster count without requiring k upfront
2. **K-Means with Silhouette Scoring**: Tests k-range to find optimal clustering
3. **100% Assignment**: Unlike pure HDBSCAN, all points are assigned to clusters

This approach combines the best of density-based discovery with complete point assignment.

### Memory-Optimized WASM
FluffyViz manages multiple WASM modules (DuckDB, tiktoken, UMAP, embedding-atlas) carefully:
- Tiktoken encoder freed before UMAP projection
- UMAP memory cleared between clustering and visualization projections
- Clustering coordinates stored in OPFS for efficient re-clustering

---

## Use Cases

### Agent Quality Analysis
Upload agent logs → Classify response quality → Aggregate by conversation → Identify patterns → Visualize clusters

### Search-Augmented Responses
Upload questions → Enable web search → Generate current answers → Verify with sources

### Multi-Language Support
Upload conversations → Translate to target language → Extract sentiment → Compare across languages

### Error Detection
Upload traces → Classify error types → Generate summaries → Create debugging reports

### User Intent Mining
Upload interactions → Extract keywords → Classify intents → Visualize semantic clusters

### Performance Benchmarking
Upload runs → Generate embeddings → Visualize semantic similarity → Compare model outputs → Analyze clusters

---

## FAQ

**Q: Where is my data stored?**
A: All data is stored locally in your browser's DuckDB WASM database (backed by IndexedDB). Clearing your browser data will remove your files.

**Q: Do I need an API key?**
A: To use AI columns, you need API keys for your chosen providers (e.g., OpenAI, Perplexity). Keys are stored securely in your local browser storage.

**Q: Can I work offline?**
A: Yes! You can upload, view, and edit files completely offline. Only AI column generation requires an internet connection.

**Q: What file size limits apply?**
A: Maximum 50MB per file. A warning appears at 30MB. For larger datasets, consider pre-filtering your data.

**Q: How does web search work?**
A: When enabled, the AI provider searches the web before generating a response. Sources are saved to a companion column for verification.

**Q: Which providers support web search?**
A: OpenAI (via Responses API), Perplexity (built-in), and Google (search grounding).

**Q: How does clustering work?**
A: FluffyViz uses a hybrid approach: (1) HDBSCAN on 15D UMAP discovers the natural cluster count (k), (2) K-Means tests k in a range [k-2, k+5] using silhouette scoring to find the optimal k, (3) Final K-Means assigns all points to clusters. This gives 100% assignment with no outliers while using density-based discovery for the cluster count.

**Q: What are the console tools for?**
A: The `window.clusterSim` console tools enable advanced cluster analysis: compute similarity between clusters, build hierarchical super-topics via agglomerative clustering, and generate LLM-based labels for clusters. These are experimental features for power users.

---

## Known Issues

### Search-Preview Models Not Supported
Models like `gpt-4o-search-preview` don't work due to an AI SDK bug. Use:
- OpenAI Responses API models (GPT-4o, GPT-4.1) with web search tool
- Perplexity models (Sonar, Sonar Pro) with built-in search

See [PROVIDER_CONFIG.md](./PROVIDER_CONFIG.md) for details.

---

## Console Tools for Cluster Analysis

FluffyViz provides browser console tools (`window.clusterSim`) for advanced cluster exploration, hierarchical organization, and LLM-based labeling. Access via the browser's Developer Console (F12).

### Getting Started

```javascript
// Get layer ID from the embedding visualization URL or console log
const layerId = 'emb_xxxxx';

// Basic similarity analysis
await clusterSim.similarity(layerId, 9, 13)     // Compare two clusters
await clusterSim.neighbors(layerId, 9)          // Find similar clusters
await clusterSim.findSimilar(layerId, 0.85)     // Pairs above threshold
```

### Available Tools

| Category | Tool | Purpose |
|----------|------|---------|
| **Similarity** | `similarity(layerId, clusterA, clusterB)` | Cosine similarity between centroids |
| | `neighbors(layerId, clusterId, topK?)` | Top-k most similar clusters |
| | `findSimilar(layerId, threshold)` | All pairs above threshold |
| | `allSimilarities(layerId)` | Full pairwise similarity matrix |
| **Hierarchy** | `agglomerate(layerId, threshold, linkage?)` | Build super-topics via agglomerative clustering |
| **Labeling** | `labelCluster(layerId, clusterId, options?)` | Generate LLM label for one cluster |
| | `labelAllClusters(layerId, options?)` | Label all clusters in parallel |
| **Cache** | `clearCache()` | Clear centroid cache |
| | `clearLabelCache()` | Clear LLM label cache |
| | `getCachedLabels()` | Retrieve cached labels |

### Agglomerative Clustering

Merge semantically similar clusters into super-topics:

```javascript
// Three linkage methods available:
await clusterSim.agglomerate(layerId, 0.80)                   // average (default)
await clusterSim.agglomerate(layerId, 0.80, 'single')         // single linkage
await clusterSim.agglomerate(layerId, 0.80, 'complete')       // complete linkage
```

**Linkage Methods:**
- **Average**: Uses mean similarity between all pairs (balanced approach)
- **Single**: Uses maximum similarity (closest pair) → tends to chain clusters
- **Complete**: Uses minimum similarity (furthest pair) → creates compact clusters

### LLM Cluster Labeling

Generate semantic metadata for clusters using an LLM:

```javascript
// Label a single cluster
await clusterSim.labelCluster(layerId, 9)
await clusterSim.labelCluster(layerId, 9, { modelId: 'gpt-4o' })

// Label all clusters with concurrency control
await clusterSim.labelAllClusters(layerId)
await clusterSim.labelAllClusters(layerId, { concurrency: 5, modelId: 'gpt-4o' })
```

**Output format:**
```json
{
  "clusterId": 9,
  "title": "Python Debugging Requests",
  "labels": ["coding", "python", "troubleshooting", "debugging"],
  "description": "Users seeking help with Python errors, exceptions, and debugging techniques."
}
```

### Experimental Approaches

These tools enable exploration of different strategies for organizing clusters:

#### A. Embedding Agglomerative Clustering (Implemented)
Merge clusters based on **centroid embedding similarity** using hierarchical agglomeration.

#### B. Label Embedding Clustering (Planned)
Alternative approach: cluster on **LLM-generated label embeddings** instead of centroids.
More interpretable but requires LLM calls for each cluster first.

#### C. LLM Validation Pass (Planned)
After agglomerative clustering, have LLM validate each super-topic:
- Semantic coherence scoring
- Intent alignment evaluation
- Suggestions for splitting or reassigning

#### D. Manual Merge in UI (Planned)
Interactive cluster merging in the visualization interface.

See [technical_docs.md](./technical_docs.md) for implementation details.

---

## Roadmap

### Recently Completed
- ✅ Hybrid clustering with HDBSCAN + K-Means
- ✅ Two-stage UMAP for clustering and visualization
- ✅ Re-clustering with parameter tuning
- ✅ Cluster labeling with LLM (console tools + UI)
- ✅ Agglomerative super-topics with linkage options
- ✅ Silhouette scoring for cluster quality
- ✅ **Cluster Management Dialog** (Overview, Agglomerate tabs)
- ✅ **Cluster Cards** with inline editing
- ✅ **Batch LLM naming** for all clusters
- ✅ **Agglomeration preview** before applying

### Current Focus
- Cluster validation with LLM (Validate tab)
- Export functionality (CSV, JSON, Parquet)
- Manual cluster drag-and-drop merging

### Future Plans
- Label embedding clustering (alternative hierarchy approach)
- Cluster coherence evaluation
- Web Worker support for large files
- Virtual scrolling for 10k+ row datasets
- OAuth integration for providers
- Collaborative editing features

---

## Support

- **Documentation**: See technical_docs.md for implementation details
- **Issues**: Report bugs and feature requests on GitHub
- **Contributing**: Pull requests welcome

---

## Summary

FluffyViz empowers AI/ML teams to quickly analyze and augment their agent data:

- **Parse** any format with auto-detection
- **Augment** with 10+ AI providers and web search
- **Visualize** patterns with hybrid clustering and interactive scatter plots

All without:
- Writing custom scripts
- Setting up infrastructure
- Compromising data privacy
- Learning complex tools

**Upload your data. Augment with AI. Visualize insights.**

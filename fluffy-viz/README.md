# FluffyViz

**Transform AI agent logs into actionable insights with AI-powered augmentation**

A local-first web application for AI/ML engineers to parse, augment, and visualize conversation data.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FluffyViz                                       │
│                                                                              │
│     ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐     │
│     │  Upload  │ ──▶  │  Parse   │ ──▶  │ Augment  │ ──▶  │Visualize │     │
│     │  Files   │      │  & Edit  │      │  with AI │      │ Clusters │     │
│     └──────────┘      └──────────┘      └──────────┘      └──────────┘     │
│                                                                              │
│     JSONL/JSON/CSV    Spreadsheet       LLM Columns      Hybrid Clustering  │
│     Auto-detect       Sort/Filter       Web Search       HDBSCAN + K-Means  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

### Multi-Format Data Import
```
┌─────────────────────────────────────────┐
│           Supported Formats             │
├─────────────────────────────────────────┤
│  JSONL   │ Message-centric logs         │
│  JSON    │ Langfuse, LangSmith, Arize   │
│  CSV     │ Turn-level structured data   │
└─────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────┐
│         Auto-Detection Engine           │
│  ┌───────────────────────────────────┐  │
│  │ Confidence Scoring + Format Match │  │
│  └───────────────────────────────────┘  │
│          │                              │
│          ▼                              │
│  ┌───────────────────────────────────┐  │
│  │   Flatten Nested → Dot Notation   │  │
│  │   { user: { name } }              │  │
│  │        ↓                          │  │
│  │   { "user.name": value }          │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### AI-Powered Column Augmentation
```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Column Generation                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │  Templates  │    │   Prompt    │    │   Model Selection   │ │
│  │             │    │  Composer   │    │                     │ │
│  │ • Translate │    │             │    │  10+ Providers:     │ │
│  │ • Summarize │    │  @column    │    │  • OpenAI           │ │
│  │ • Sentiment │    │  references │    │  • Anthropic        │ │
│  │ • Classify  │    │             │    │  • Google           │ │
│  │ • Extract   │    │  Preview    │    │  • Perplexity       │ │
│  │ • Custom    │    │  before run │    │  • Groq, Cohere...  │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Web Search Augmentation
```
┌─────────────────────────────────────────────────────────────────┐
│                   Web Search Integration                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐        ┌──────────────────────────────┐ │
│   │   Enable Search  │───────▶│  Response Column             │ │
│   │   + Location     │        │  + _sources Column (URLs)    │ │
│   │   (ISO: IN, US)  │        │                              │ │
│   └──────────────────┘        └──────────────────────────────┘ │
│                                                                  │
│   Supported Providers:                                           │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  OpenAI (Responses API + web_search_preview tool)       │   │
│   │  Perplexity (Built-in search, always on)                │   │
│   │  Google (Search grounding)                              │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Embedding Visualization with Hybrid Clustering
```
┌─────────────────────────────────────────────────────────────────┐
│                    Embedding Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Select Columns    Generate Vectors     Hybrid Clustering       │
│        │                  │                    │                 │
│        ▼                  ▼                    ▼                 │
│   ┌─────────┐        ┌─────────┐        ┌─────────────────┐     │
│   │ Single  │        │ Batch   │        │  HDBSCAN → k    │     │
│   │ Multi   │───────▶│ Embed   │───────▶│  K-Means + sil  │     │
│   │ History │        │ API     │        │  100% assigned  │     │
│   └─────────┘        └─────────┘        └─────────────────┘     │
│                                                 │                │
│                                                 ▼                │
│                                          ┌─────────────────┐     │
│                                          │                 │     │
│                                          │  ● ●    ●      │     │
│                                          │    ●  ●   ●    │     │
│                                          │  ●    ●  ● ●   │     │
│                                          │    Interactive  │     │
│                                          │    Scatter Plot │     │
│                                          └─────────────────┘     │
│                                                                  │
│   Features:                                                      │
│   • Points / Density view modes                                  │
│   • Auto cluster labels                                         │
│   • Re-cluster with parameter tuning                            │
│   • Save selections as filters                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Browser Environment                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                        Next.js 15 App Router                         │    │
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

## Quick Start

```bash
# Clone repository
git clone https://github.com/AvinaashAnandK/FluffyViz.git
cd FluffyViz/fluffy-viz

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## Configuration

### Provider API Keys

Create `provider-config.json` (gitignored) or configure in the UI:

```json
{
  "version": "1.0.0",
  "providers": {
    "openai": {
      "apiKey": "sk-...",
      "enabled": true,
      "capabilities": { "text": true, "embedding": true }
    },
    "perplexity": {
      "apiKey": "pplx-...",
      "enabled": true,
      "capabilities": { "text": true }
    }
  }
}
```

See `provider-config.example.json` for full template.

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Workflow                                   │
└─────────────────────────────────────────────────────────────────────────────┘

     ┌────────────┐         ┌────────────┐         ┌────────────┐
     │   UPLOAD   │         │   AUGMENT  │         │  VISUALIZE │
     └─────┬──────┘         └─────┬──────┘         └─────┬──────┘
           │                      │                      │
           ▼                      ▼                      ▼
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │ Drag & Drop     │    │ Add AI Column   │    │ Embedding       │
  │ Format Detect   │───▶│ Configure Model │───▶│ Wizard          │
  │ Preview Data    │    │ Map Variables   │    │ UMAP Projection │
  │ Store in DuckDB │    │ Generate + Save │    │ Hybrid Cluster  │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
           │                      │                      │
           │                      │                      │
           ▼                      ▼                      ▼
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │  Spreadsheet    │    │  AI Response    │    │  Scatter Plot   │
  │  View & Edit    │    │  + Sources Col  │    │  Points/Density │
  │  Sort & Filter  │    │  Cell Metadata  │    │  Re-cluster     │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Clustering System

FluffyViz uses a **hybrid HDBSCAN + K-Means** approach for embedding clustering:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Hybrid Clustering Pipeline                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Stage 1: HDBSCAN k-discovery                                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • Run HDBSCAN on 15D UMAP projection (min_dist=0.0)                 │   │
│  │  • Discover natural cluster count (k_estimate)                        │   │
│  │  • No need to specify k upfront                                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  Stage 2: K-Means optimization                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • L2-normalize original embeddings                                   │   │
│  │  • Test k in range [k_estimate - 2, k_estimate + 5]                  │   │
│  │  • Select k with highest silhouette score                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  Result: 100% point assignment                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  • All points assigned to clusters (no outliers)                     │   │
│  │  • Silhouette score validates cluster quality                        │   │
│  │  • Re-cluster anytime with new parameters                            │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Provider Support

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Supported Providers                                │
├──────────────┬──────────┬──────────┬────────────┬──────────────────────────┤
│   Provider   │   Text   │ Embedding│ Web Search │          Notes           │
├──────────────┼──────────┼──────────┼────────────┼──────────────────────────┤
│ OpenAI       │    ✓     │    ✓     │     ✓      │ Responses API + tool     │
│ Anthropic    │    ✓     │    ✗     │     ✗      │ Claude models            │
│ Google       │    ✓     │    ✓     │     ✓      │ Gemini + grounding       │
│ Perplexity   │    ✓     │    ✗     │  Built-in  │ Always searches web      │
│ Groq         │    ✓     │    ✗     │     ✗      │ Fast inference           │
│ Cohere       │    ✓     │    ✓     │     ✗      │ Command + Embed          │
│ Mistral      │    ✓     │    ✓     │     ✗      │ EU-based                 │
│ Together     │    ✓     │    ✗     │     ✗      │ Open models              │
│ HuggingFace  │    ✓     │    ✓     │     ✗      │ Inference API            │
│ Novita       │    ✓     │    ✗     │     ✗      │ Alternative provider     │
└──────────────┴──────────┴──────────┴────────────┴──────────────────────────┘
```

## Project Structure

```
fluffy-viz/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Home - file upload
│   │   ├── edit/[fileId]/        # Spreadsheet editor
│   │   └── api/                  # Server routes
│   │       ├── generate-column/  # AI inference
│   │       ├── model-registry/   # Model definitions
│   │       └── prompts/          # Template loader
│   │
│   ├── components/
│   │   ├── spreadsheet/          # Data editing
│   │   │   ├── SpreadsheetEditor.tsx
│   │   │   ├── AddColumnModal.tsx
│   │   │   ├── GenerationSettings.tsx
│   │   │   └── PromptComposer.tsx
│   │   ├── embedding-viewer/     # Visualization
│   │   │   ├── embedding-wizard.tsx
│   │   │   ├── embedding-visualization.tsx
│   │   │   └── agent-trace-viewer.tsx
│   │   └── ui/                   # shadcn components
│   │
│   ├── lib/
│   │   ├── ai-inference.ts       # LLM + web search
│   │   ├── format-parser.ts      # Data parsing
│   │   ├── duckdb/               # Database layer
│   │   └── embedding/            # UMAP + clustering
│   │       ├── clustering.ts     # Hybrid HDBSCAN + K-Means
│   │       ├── kmeans.ts         # K-Means with silhouette
│   │       ├── cluster-similarity.ts # Console tools for analysis
│   │       └── umap-reducer.ts   # Two-stage UMAP
│   │
│   ├── config/
│   │   ├── models/model-registry.yaml  # Model definitions
│   │   ├── provider-settings.ts  # Provider metadata
│   │   └── prompts/              # YAML templates
│   │
│   └── types/
│       ├── models.ts             # AI model types
│       ├── embedding.ts          # Embedding & cluster types
│       └── web-search.ts         # Search config types
│
├── CLAUDE.md                     # AI assistant context
├── PROVIDER_CONFIG.md            # Provider setup guide
└── package.json
```

## Development

```bash
# Development server
npm run dev

# Production build
npm run build && npm start

# Run tests
npm test
npm run test:watch

# Lint
npm run lint
```

## Privacy & Security

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Privacy-First Design                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                     YOUR BROWSER                                  │      │
│   │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │      │
│   │  │   Your Data    │  │   DuckDB WASM  │  │   API Keys     │     │      │
│   │  │   (Files)      │  │   (IndexedDB)  │  │   (Local)      │     │      │
│   │  └────────────────┘  └────────────────┘  └────────────────┘     │      │
│   │                              │                                    │      │
│   │                              │ Only when you click "Generate"    │      │
│   │                              ▼                                    │      │
│   │                     ┌────────────────┐                           │      │
│   │                     │   AI Provider  │                           │      │
│   │                     │   (Your keys)  │                           │      │
│   │                     └────────────────┘                           │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│   • No FluffyViz servers store your data                                    │
│   • API keys never leave your browser (except to providers)                 │
│   • Works offline (except AI generation)                                    │
│   • Open source - audit the code                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Console Tools for Cluster Analysis

FluffyViz provides browser console tools (`window.clusterSim`) for advanced cluster analysis:

```javascript
// Access via browser Developer Console (F12)
const layerId = 'emb_xxxxx';  // Get from visualization URL

// Similarity analysis
await clusterSim.similarity(layerId, 9, 13)    // Compare two clusters
await clusterSim.neighbors(layerId, 9)          // Find similar clusters
await clusterSim.findSimilar(layerId, 0.85)    // Pairs above threshold

// Agglomerative clustering
await clusterSim.agglomerate(layerId, 0.80)             // average linkage
await clusterSim.agglomerate(layerId, 0.80, 'single')   // single linkage
await clusterSim.agglomerate(layerId, 0.80, 'complete') // complete linkage

// LLM-based labeling
await clusterSim.labelCluster(layerId, 9)       // Label single cluster
await clusterSim.labelAllClusters(layerId)      // Label all clusters
```

See [technical_docs.md](./technical_docs.md) for full documentation.

## Known Issues

- **OpenAI Search-Preview Models**: `gpt-4o-search-preview` and similar models don't work due to an AI SDK bug parsing the `annotations` field. Use Responses API models with `web_search_preview` tool instead.
- See [PROVIDER_CONFIG.md](./PROVIDER_CONFIG.md) for details and workarounds.

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | DuckDB WASM (browser-side SQL) |
| AI | Vercel AI SDK, 10+ provider integrations |
| Clustering | HDBSCAN-ts, ml-kmeans, silhouette scoring |
| Visualization | Embedding Atlas, UMAP-js |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

## License

MIT

---

**Built with privacy in mind. Your data, your control.**

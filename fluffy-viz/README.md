# FluffyViz

**Transform AI agent logs into actionable insights with AI-powered augmentation**

A local-first web application for AI/ML engineers to parse, augment, and visualize conversation data.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FluffyViz                                       │
│                                                                              │
│     ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐     │
│     │  Upload  │ ──▶  │  Parse   │ ──▶  │ Augment  │ ──▶  │Visualize │     │
│     │  Files   │      │  & Edit  │      │  with AI │      │  Embed   │     │
│     └──────────┘      └──────────┘      └──────────┘      └──────────┘     │
│                                                                              │
│     JSONL/JSON/CSV    Spreadsheet       LLM Columns      Embedding Atlas    │
│     Auto-detect       Sort/Filter       Web Search       2D UMAP Scatter    │
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

### Web Search Augmentation (NEW)
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

### Embedding Visualization
```
┌─────────────────────────────────────────────────────────────────┐
│                    Embedding Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Select Columns    Generate Vectors     UMAP → 2D              │
│        │                  │                  │                   │
│        ▼                  ▼                  ▼                   │
│   ┌─────────┐        ┌─────────┐        ┌─────────────────┐     │
│   │ Single  │        │ Batch   │        │                 │     │
│   │ Multi   │───────▶│ Embed   │───────▶│  ● ●    ●      │     │
│   │ History │        │ API     │        │    ●  ●   ●    │     │
│   └─────────┘        └─────────┘        │  ●    ●  ● ●   │     │
│                                          │    Interactive  │     │
│                                          │    Scatter Plot │     │
│                                          └─────────────────┘     │
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
│  │  │  (10+ providers) │  │   + Sources      │  │  UMAP Pipeline   │  │    │
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
  │ Store in DuckDB │    │ Generate + Save │    │ Interactive Plot│
  └─────────────────┘    └─────────────────┘    └─────────────────┘
           │                      │                      │
           │                      │                      │
           ▼                      ▼                      ▼
  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │  Spreadsheet    │    │  AI Response    │    │  Scatter Plot   │
  │  View & Edit    │    │  + Sources Col  │    │  Point Details  │
  │  Sort & Filter  │    │  Cell Metadata  │    │  Cluster View   │
  └─────────────────┘    └─────────────────┘    └─────────────────┘
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
│   │   │   ├── GenerationSettings.tsx  # NEW
│   │   │   └── PromptComposer.tsx
│   │   ├── embedding-viewer/     # Visualization
│   │   └── ui/                   # shadcn components
│   │
│   ├── lib/
│   │   ├── ai-inference.ts       # LLM + web search
│   │   ├── format-parser.ts      # Data parsing
│   │   ├── duckdb/               # Database layer
│   │   └── embedding/            # UMAP pipeline
│   │
│   ├── config/
│   │   ├── models/model-registry.yaml  # Model definitions
│   │   ├── provider-settings.ts  # Provider metadata
│   │   └── prompts/              # YAML templates
│   │
│   └── types/
│       ├── models.ts             # AI model types
│       └── web-search.ts         # Search config types  # NEW
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

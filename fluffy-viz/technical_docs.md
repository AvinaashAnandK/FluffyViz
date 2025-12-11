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
│  │  │  (10+ providers) │  │   + Sources      │  │  UMAP Pipeline   │  │    │
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

### UI Components
| Package | Purpose |
|---------|---------|
| @radix-ui/* | Accessible primitives (via shadcn) |
| @tiptap/react | Rich text editor |
| lucide-react | Icon library |
| sonner | Toast notifications |
| cmdk | Command palette |

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
│   │   │   ├── embedding-wizard.tsx
│   │   │   ├── embedding-visualization.tsx
│   │   │   └── agent-trace-viewer.tsx
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
│   │       ├── umap-reducer.ts       # UMAP projection
│   │       └── storage.ts            # Layer persistence
│   │
│   ├── hooks/
│   │   └── use-file-storage.ts       # React abstraction
│   │
│   ├── types/
│   │   ├── agent-data.ts             # Data format types
│   │   ├── models.ts                 # AI model types
│   │   ├── web-search.ts             # Web search config types
│   │   ├── embedding.ts              # Embedding types
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
EmbeddingWizard
  → Select composition mode (single/multi/conversational)
  → composeTexts() creates text array
  → generateEmbeddings() via provider API
  → umapReduce() projects to 2D
  → saveEmbeddingLayer() persists to DuckDB
  → EmbeddingVisualization renders with Mosaic
```

**Key Files**:
- `src/components/embedding-viewer/embedding-wizard.tsx`
- `src/lib/embedding/text-composer.ts`
- `src/lib/embedding/batch-embedder.ts`
- `src/lib/embedding/umap-reducer.ts`

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

// Save cell inference metadata
export async function saveCellMetadata(
  metadata: CellMetadata
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

### Web Search Configuration

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

### Source Extraction

Sources are extracted from different locations based on provider:

```typescript
function extractSources(result: any, providerId: string): SearchSource[] {
  const sources: SearchSource[] = [];

  // Direct sources (Perplexity)
  if (result.sources) {
    sources.push(...result.sources.map(s => ({ url: s.url, title: s.title })));
  }

  // Provider metadata - Perplexity
  if (result.providerMetadata?.perplexity?.sources) {
    sources.push(...result.providerMetadata.perplexity.sources);
  }

  // Provider metadata - OpenAI annotations
  if (result.providerMetadata?.openai?.annotations) {
    for (const ann of result.providerMetadata.openai.annotations) {
      if (ann.type === 'url_citation') {
        sources.push({ url: ann.url, title: ann.title });
      }
    }
  }

  // Tool results (OpenAI web_search_preview)
  if (result.toolResults) {
    for (const tr of result.toolResults) {
      if (tr.toolName?.includes('search') && tr.result?.sources) {
        sources.push(...tr.result.sources);
      }
    }
  }

  return sources;
}
```

---

## Template System

### Template Definition

```typescript
// src/config/ai-column-templates.ts
export const AI_COLUMN_TEMPLATES: ColumnTemplate[] = [
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate text to specified language',
    category: 'transformation',
    promptFile: 'translate.yaml',
    variables: [
      { id: 'input', name: 'Input Column', required: true },
      { id: 'target_language', name: 'Target Language', default: 'Spanish' }
    ]
  },
  // ... more templates
];
```

### YAML Structure

```yaml
# config/prompts/translate.yaml
category: Transformation
title: Translate Text
prompt_params:
  system_instruction: |
    You are a professional translator.
  prompt_template: |
    Translate to {{target_language}}:
    {{input}}
template_variables:
  - id: input
    display_name: Input Text
    required: true
  - id: target_language
    display_name: Target Language
    default: Spanish
inference_config:
  generation:
    max_new_tokens: 1000
    temperature: 0.3
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

---

## Type Definitions

### Core Types

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

// src/types/web-search.ts
export interface WebSearchConfig {
  enabled: boolean;
  contextSize: SearchContextSize;
  userLocation?: UserLocation;
}

// src/lib/duckdb/types.ts
export interface CellMetadata {
  fileId: string;
  columnId: string;
  rowIndex: number;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  errorType?: string;
  edited: boolean;
  sources?: Array<{ url: string; title?: string }>;
}
```

---

## Testing

### Test Structure

```
src/
├── lib/
│   └── __tests__/
│       ├── format-parser.test.ts
│       └── format-detector.test.ts
├── hooks/
│   └── __tests__/
│       └── use-file-storage.test.ts
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

---

## Browser Compatibility

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

Requires: IndexedDB, Web Workers, ES2020+

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
3. Add parser in `format-parser.ts`
4. Test with sample file

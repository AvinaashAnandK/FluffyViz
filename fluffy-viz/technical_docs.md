# FluffyViz Technical Documentation

## Architecture Overview

FluffyViz is a client-side web application built with Next.js 15 (App Router), React 19, and TypeScript. All data processing occurs in the browser using DuckDB WASM for storage and querying.

```
┌─────────────────────────────────────────────────────────┐
│                    Browser Environment                   │
├─────────────────────────────────────────────────────────┤
│  Next.js App Router                                      │
│  ├── Pages & Layouts                                     │
│  ├── API Routes (provider config, prompts)               │
│  └── Components (React 19)                               │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                              │
│  ├── DuckDB WASM (IndexedDB persistence)                 │
│  ├── Format Detection & Parsing                          │
│  └── File Storage Abstraction                            │
├─────────────────────────────────────────────────────────┤
│  AI Integration                                          │
│  ├── Vercel AI SDK (multi-provider)                      │
│  ├── HuggingFace Inference API                           │
│  └── Embedding Pipeline (UMAP reduction)                 │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.5.4 | App Router, API routes, Turbopack |
| React | 19.1.0 | UI components with React Compiler |
| TypeScript | 5.x | Strict type checking |
| Tailwind CSS | 4.x | Utility-first styling |

### Data & Storage
| Package | Purpose |
|---------|---------|
| @duckdb/wasm | In-browser SQL database |
| @uwdata/mosaic-core | Data binding for visualizations |
| papaparse | CSV parsing |
| js-yaml | YAML template parsing |

### AI Integration
| Package | Purpose |
|---------|---------|
| ai (Vercel AI SDK) | Unified LLM interface |
| @ai-sdk/openai | OpenAI models |
| @ai-sdk/anthropic | Claude models |
| @ai-sdk/google | Gemini models |
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
│   │   ├── page.tsx                  # Home page
│   │   ├── layout.tsx                # Root layout
│   │   ├── edit/[fileId]/page.tsx    # Spreadsheet editor
│   │   └── api/                      # API routes
│   │       ├── generate-column/      # AI inference endpoint
│   │       ├── prompts/[templateId]/ # Template loader
│   │       └── provider-config/      # Provider settings
│   │
│   ├── components/
│   │   ├── spreadsheet/              # Data editing components
│   │   │   ├── SpreadsheetEditor.tsx # Main editor (1500+ lines)
│   │   │   ├── SpreadsheetTable.tsx  # Table rendering
│   │   │   ├── AddColumnModal.tsx    # AI column workflow
│   │   │   ├── PromptComposer.tsx    # TipTap editor
│   │   │   ├── ModelSelector.tsx     # HuggingFace model search
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
│   │   ├── ai-inference.ts           # LLM integration
│   │   ├── format-detector.ts        # Format auto-detection
│   │   ├── format-parser.ts          # Data parsing & flattening
│   │   ├── conversational-history.ts # Turn aggregation
│   │   ├── prompt-serializer.ts      # TipTap → template conversion
│   │   ├── models.ts                 # HuggingFace model search
│   │   ├── providers.ts              # Provider definitions
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
│   │   ├── embedding.ts              # Embedding types
│   │   └── file-storage.ts           # Storage types
│   │
│   └── config/
│       ├── ai-column-templates.ts    # Template definitions
│       ├── parser.config.ts          # Parser limits
│       └── provider-settings.ts      # Provider metadata
│
├── config/
│   └── prompts/                      # YAML template files
│
├── public/
│   └── sample-*.{json,jsonl,csv}     # Sample data files
│
└── package.json
```

---

## Core Data Flow

### 1. File Upload & Parsing

```typescript
// EnhancedUpload.tsx
File upload
  → FormatDetector.detectFormat(content)     // Confidence scoring
  → parseFileContent(content, format)        // Flatten nested data
  → useFileStorage.saveFile(normalizedData)  // Persist to DuckDB
  → router.push(`/edit/${fileId}`)
```

**Key Files**:
- `src/lib/format-detector.ts` - Detection with confidence scores
- `src/lib/format-parser.ts` - Parsing with memoization (LRU cache)
- `src/hooks/use-file-storage.ts` - Storage abstraction

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

```typescript
// SpreadsheetEditor.tsx
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

```typescript
// AddColumnModal.tsx
Template selection
  → ModelSelector (HuggingFace API search)
  → ProviderSelector (filter by capability)
  → PromptComposer (TipTap with variable pills)
  → generateColumnData() via /api/generate-column
  → batchUpdateColumn() saves results
  → saveCellMetadata() tracks status per cell
```

**Key Files**:
- `src/components/spreadsheet/AddColumnModal.tsx`
- `src/components/spreadsheet/PromptComposer.tsx`
- `src/lib/ai-inference.ts`
- `src/app/api/generate-column/route.ts`

### 4. Embedding Pipeline

```typescript
// EmbeddingWizard.tsx
Select composition mode (single/multi/conversational)
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
- Supports arbitrary column additions

**Column Metadata** (`column_metadata` table):
```sql
CREATE TABLE column_metadata (
  file_id VARCHAR,
  column_id VARCHAR,
  column_name VARCHAR,
  template_id VARCHAR,
  model_id VARCHAR,
  provider VARCHAR,
  prompt_template VARCHAR,
  created_at TIMESTAMP
);
```

**Cell Metadata** (`cell_metadata` table):
```sql
CREATE TABLE cell_metadata (
  file_id VARCHAR,
  row_id INTEGER,
  column_id VARCHAR,
  status VARCHAR,         -- 'pending', 'completed', 'failed'
  failure_type VARCHAR,   -- 'rate_limit', 'auth', 'server_error', etc.
  error_message VARCHAR,
  attempts INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Client Initialization

```typescript
// src/lib/duckdb/client.ts
import * as duckdb from '@duckdb/duckdb-wasm';

let db: AsyncDuckDB | null = null;

export async function getDatabase(): Promise<AsyncDuckDB> {
  if (!db) {
    const bundle = await duckdb.selectBundle(/* ... */);
    const worker = new Worker(bundle.mainWorker);
    db = new duckdb.AsyncDuckDB(/* ... */);
    await db.instantiate(bundle.mainModule);
  }
  return db;
}
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
  columnName: string,
  defaultValue: any
): Promise<void>;

// Batch update column values
export async function batchUpdateColumn(
  fileId: string,
  columnName: string,
  updates: { rowId: number, value: any }[]
): Promise<BatchOperationResult>;

// Save cell inference metadata
export async function saveCellMetadata(
  fileId: string,
  rowId: number,
  columnId: string,
  metadata: Partial<CellMetadata>
): Promise<void>;
```

---

## AI Inference System

### Provider Architecture

```typescript
// src/lib/providers.ts
export const PROVIDER_META: Record<ProviderKey, ProviderMetadata> = {
  huggingface: {
    displayName: 'HuggingFace',
    hasFree: true,
    supportsText: true,
    supportsEmbeddings: true,
    supportsStreaming: true,
    requiresApiKey: true
  },
  openai: { /* ... */ },
  anthropic: { /* ... */ },
  // ... 10 providers total
};
```

### Inference Function

```typescript
// src/lib/ai-inference.ts
export async function generateCompletion(
  options: InferenceOptions
): Promise<InferenceResult> {
  const { model, provider, prompt, systemPrompt, apiKey } = options;

  // Route to correct SDK
  switch (provider) {
    case 'huggingface':
      return hfInference(model, prompt, systemPrompt, apiKey);
    case 'openai':
    case 'anthropic':
    case 'google':
    case 'groq':
    case 'mistral':
    case 'cohere':
      return aiSdkInference(provider, model, prompt, systemPrompt, apiKey);
    // ...
  }
}

// Batch column generation
export async function generateColumnData(
  rows: Row[],
  columnId: string,
  promptTemplate: string,
  model: string,
  provider: ProviderKey,
  onProgress?: (completed: number, total: number) => void
): Promise<GenerationResult[]>;
```

### Error Classification

```typescript
// src/lib/ai-inference.ts
export function classifyError(error: any): FailureType {
  const status = error?.status || error?.response?.status;
  const message = error?.message?.toLowerCase() || '';

  if (status === 429 || message.includes('rate limit')) return 'rate_limit';
  if (status === 401 || status === 403) return 'auth';
  if (status >= 500) return 'server_error';
  if (message.includes('network') || message.includes('fetch')) return 'network';
  return 'invalid_request';
}
```

### Embedding Generation

```typescript
// src/lib/ai-inference.ts
export async function generateEmbeddings(
  texts: string[],
  provider: ProviderKey,
  modelId: string,
  apiKey: string
): Promise<number[][]> {
  switch (provider) {
    case 'huggingface':
      return hfEmbeddings(texts, modelId, apiKey);
    case 'openai':
      return openaiEmbeddings(texts, modelId, apiKey);
    case 'google':
      return googleEmbeddings(texts, modelId, apiKey);
    // ...
  }
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
  // ... 8 templates total
];
```

### YAML Structure

```yaml
# config/prompts/translate.yaml
category: Transformation
title: Translate Text
prompt_params:
  system_instruction: |
    You are a professional translator. Translate the given text
    accurately while preserving tone and context.
  prompt_template: |
    Translate the following text to {{target_language}}:

    {{input}}
template_variables:
  - id: input
    display_name: Input Text
    slug: input
    required: true
  - id: target_language
    display_name: Target Language
    slug: target_language
    required: true
    default: Spanish
inference_config:
  generation:
    max_new_tokens: 1000
    temperature: 0.3
```

### Prompt Serialization

```typescript
// src/lib/prompt-serializer.ts

// Convert TipTap document to template string
export function serializePrompt(doc: TipTapDocument): string {
  // Variable pill nodes → {{column_slug}}
  // Text nodes → plain text
}

// Interpolate template with row data
export function interpolatePrompt(
  template: string,
  row: Record<string, any>,
  variableMap: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const columnName = variableMap[key];
    return row[columnName] ?? '';
  });
}
```

---

## Format Detection & Parsing

### Detection Algorithm

```typescript
// src/lib/format-detector.ts
export function detectFormat(content: string): DetectionResult {
  const results: FormatScore[] = [];

  // Try each format detector
  results.push(detectMessageCentric(content));
  results.push(detectLangfuse(content));
  results.push(detectLangsmith(content));
  results.push(detectArize(content));
  results.push(detectCSV(content));

  // Return highest confidence
  results.sort((a, b) => b.confidence - a.confidence);
  return {
    format: results[0].format,
    confidence: results[0].confidence,
    alternatives: results.slice(1)
  };
}
```

### Parsing Pipeline

```typescript
// src/lib/format-parser.ts
export function parseFileContent(
  content: string,
  format: SupportedFormat
): NormalizedAgentData[] {
  let parsed: any[];

  switch (format) {
    case 'message-centric':
      parsed = parseJSONL(content);
      break;
    case 'langfuse':
      parsed = parseLangfuse(content);  // Expands observations
      break;
    case 'langsmith':
      parsed = parseLangsmith(content);
      break;
    case 'csv':
      parsed = parseCSV(content);
      break;
    // ...
  }

  // Flatten all nested objects
  return parsed.map(row => flattenObject(row));
}

// Memoized flattening
const flattenCache = new LRUCache<string, Record<string, any>>(100);

function flattenObject(
  obj: any,
  prefix = '',
  depth = 0
): Record<string, any> {
  // Check cache
  const cacheKey = JSON.stringify(obj) + prefix;
  if (flattenCache.has(cacheKey)) {
    return flattenCache.get(cacheKey)!;
  }

  // Flatten logic...
  const result = { /* ... */ };
  flattenCache.set(cacheKey, result);
  return result;
}
```

---

## Type Definitions

### Core Data Types

```typescript
// src/types/agent-data.ts
export type SupportedFormat =
  | 'message-centric'
  | 'langfuse'
  | 'langsmith'
  | 'arize'
  | 'csv';

export interface NormalizedAgentData {
  [key: string]: string | number | boolean | null;
}

export interface AugmentedAgentData extends NormalizedAgentData {
  _sentiment?: string;
  _intent?: string;
  _quality_score?: number;
}
```

### AI Types

```typescript
// src/types/models.ts
export interface Model {
  id: string;
  name: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
}

export interface InferenceOptions {
  model: string;
  provider: ProviderKey;
  prompt: string;
  systemPrompt?: string;
  apiKey: string;
  maxTokens?: number;
  temperature?: number;
}

export interface InferenceResult {
  content: string;
  error?: string;
  errorType?: FailureType;
}
```

### Storage Types

```typescript
// src/lib/duckdb/types.ts
export interface FileMetadata {
  id: string;
  name: string;
  format: SupportedFormat;
  size: number;
  rowCount: number;
  columnNames: string[];
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface CellMetadata {
  fileId: string;
  rowId: number;
  columnId: string;
  status: 'pending' | 'completed' | 'failed';
  failureType?: FailureType;
  errorMessage?: string;
  attempts: number;
}

export type FailureType =
  | 'rate_limit'
  | 'auth'
  | 'server_error'
  | 'network'
  | 'invalid_request';
```

---

## API Routes

### Generate Column

**Endpoint**: `POST /api/generate-column`

```typescript
// Request
{
  fileId: string;
  columnId: string;
  model: string;
  provider: ProviderKey;
  promptTemplate: string;
  variableMap: Record<string, string>;
  rows: Array<{ rowId: number; data: Record<string, any> }>;
  apiKey: string;
}

// Response
{
  results: Array<{
    rowId: number;
    value: string;
    error?: string;
    errorType?: FailureType;
  }>;
}
```

### Load Template

**Endpoint**: `GET /api/prompts/[templateId]`

```typescript
// Response
{
  category: string;
  title: string;
  prompt_params: {
    system_instruction: string;
    prompt_template: string;
  };
  template_variables: Array<{
    id: string;
    display_name: string;
    slug: string;
    required: boolean;
    default?: string;
  }>;
  inference_config: {
    generation: {
      max_new_tokens: number;
      temperature: number;
    };
  };
}
```

### Provider Config

**Endpoint**: `GET/POST /api/provider-config`

```typescript
// Response (GET)
{
  providers: Record<ProviderKey, {
    enabled: boolean;
    apiKey: string;
  }>;
  defaultTextProvider: ProviderKey;
  defaultEmbeddingProvider: ProviderKey;
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
# All tests
npm test

# Watch mode
npm run test:watch

# Specific file
npm test -- src/lib/__tests__/format-parser.test.ts

# Coverage
npm test -- --coverage
```

### Test Patterns

```typescript
// Unit test example
describe('flattenObject', () => {
  it('flattens nested objects with dot notation', () => {
    const input = { user: { name: 'Alice' } };
    const result = flattenObject(input);
    expect(result).toEqual({ 'user.name': 'Alice' });
  });
});

// Mock DuckDB for storage tests
jest.mock('../duckdb/client', () => ({
  getDatabase: jest.fn(() => mockDatabase)
}));
```

---

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build
npm start

# Linting
npm run lint

# Type checking
npx tsc --noEmit
```

---

## Performance Optimizations

### Parser Memoization
- LRU cache (100 entries) for `flattenObject()`
- Prevents re-flattening same objects

### DuckDB Queries
- Pagination (100 rows/page default)
- SQL-level filtering and sorting
- Indexed by file_id for fast lookups

### Lazy Loading
- Embedding-atlas loaded dynamically
- Heavy visualizations only when needed

### Debouncing
- Search inputs: 300ms debounce
- Filter changes: 300ms debounce

### Batch Processing
- AI inference batched per column
- Embedding generation in chunks

---

## Error Handling

### Inference Errors

```typescript
// Retry logic in RetryModal.tsx
const handleRetry = async () => {
  const result = await generateCompletion({
    ...options,
    // Optionally different model/provider
  });

  if (result.error) {
    await saveCellMetadata(fileId, rowId, columnId, {
      status: 'failed',
      failureType: result.errorType,
      errorMessage: result.error,
      attempts: attempts + 1
    });
  } else {
    await saveCellMetadata(fileId, rowId, columnId, {
      status: 'completed',
      attempts: attempts + 1
    });
  }
};
```

### User Feedback
- Toast notifications via Sonner
- Cell-level status indicators
- Detailed error messages in modals

---

## Environment Configuration

### Required Environment Variables

None required for basic functionality. Provider API keys can be:
1. Entered in the UI (stored in browser)
2. Set as environment variables:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
HUGGINGFACE_API_KEY=hf_...
```

---

## Browser Compatibility

- **Chrome** 90+
- **Firefox** 90+
- **Safari** 14+
- **Edge** 90+

Requires:
- IndexedDB support
- Web Workers
- ES2020+ features

---

## Limitations

### Current
- No Web Worker support for parsing (large files may block UI)
- No virtual scrolling (10k+ rows slow)
- DuckDB WASM startup time (~2-3s)
- 50MB file size limit (IndexedDB)

### Planned Improvements
- Web Workers for file parsing
- Virtual scrolling for large datasets
- Streaming file processing
- OAuth for provider authentication

---

## Contributing

### Code Style
- TypeScript strict mode
- Prefer `@/` path aliases
- Component composition over inheritance
- Memoization for expensive operations

### Adding Features
1. Add types to `src/types/`
2. Add logic to `src/lib/`
3. Add UI to `src/components/`
4. Write tests in `__tests__/`

### Adding Providers
1. Add to `ProviderKey` type
2. Add metadata to `PROVIDER_META`
3. Add inference logic to `generateCompletion()`
4. Add embedding logic if supported

### Adding Data Formats
1. Add to `SupportedFormat` type
2. Add detector to `format-detector.ts`
3. Add parser to `format-parser.ts`
4. Add sample file to `public/`

---

## File Reference

### Entry Points
- `src/app/page.tsx` - Home page
- `src/app/edit/[fileId]/page.tsx` - Editor
- `src/app/layout.tsx` - Root layout

### Key Components
- `src/components/spreadsheet/SpreadsheetEditor.tsx` - Main editor
- `src/components/spreadsheet/AddColumnModal.tsx` - AI workflow
- `src/components/embedding-viewer/embedding-wizard.tsx` - Embeddings

### Core Logic
- `src/lib/ai-inference.ts` - LLM integration
- `src/lib/format-parser.ts` - Data parsing
- `src/lib/duckdb/index.ts` - Database operations

### Configuration
- `src/config/ai-column-templates.ts` - Templates
- `src/config/provider-settings.ts` - Providers
- `src/config/parser.config.ts` - Parser limits

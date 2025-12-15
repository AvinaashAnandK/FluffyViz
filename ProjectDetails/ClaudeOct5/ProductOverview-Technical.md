# FluffyViz - Technical Product Overview

## Architecture Summary

FluffyViz is a Next.js 15 (App Router) application with React 19, TypeScript, and Tailwind CSS v4. It's a local-first web app using DuckDB WASM for persistence, with API routes only for AI inference.

**Tech Stack**: Next.js 15 | React 19 | TypeScript | Tailwind CSS v4 | DuckDB WASM | shadcn/ui | Vercel AI SDK

---

## Component Architecture

### **Pages (Next.js App Router)**

#### `/src/app/page.tsx` - **Home** (Landing/Upload Page)
Main entry point with file upload interface. Uses `EnhancedUpload` component for drag-and-drop and format detection.

**Dependencies**: `EnhancedUpload`, `AppSidebar`, `WorkflowBreadcrumb`, `ThemeToggle`, `useFileStorage`

#### `/src/app/edit/[fileId]/page.tsx` - **EditPage** (Spreadsheet Editor)
Dynamic route for editing uploaded files. Loads file from IndexedDB and renders `SpreadsheetEditor`.

**Dependencies**: `SpreadsheetEditor`, `useFileStorage`

#### `/src/app/style-guide/page.tsx` - **StyleGuidePage**
Component demo/documentation page showing all UI components and patterns.

**Dependencies**: All UI components, `AIProviderConfigDemo`

#### `/src/app/layout.tsx` - **RootLayout**
Root layout with theme provider, sidebar provider, and global styles.

**Dependencies**: `ThemeProvider`, `SidebarProvider`, `AppSidebar`, `globals.css`

---

### **API Routes**

#### `/src/app/api/prompts/[templateId]/route.ts` - **GET /api/prompts/[templateId]**
Loads YAML prompt configurations from `/public/prompts/{templateId}.yaml`. Used by AI column templates.

**Dependencies**: `fs`, `path`, `yaml`

---

### **Core Components**

#### `/src/components/enhanced-upload.tsx` - **EnhancedUpload**
Smart file upload component with drag-and-drop, format detection, and automatic parsing. Exposes imperative handle via `forwardRef`.

**Exports**: `EnhancedUpload` (React.forwardRef), `EnhancedUploadHandle`
**Dependencies**: `FormatDetector`, `parseFileContent`, `useFileStorage`

#### `/src/components/app-sidebar.tsx` - **AppSidebar**
Application sidebar with file management, recent files list, and file selection.

**Exports**: `AppSidebar`
**Dependencies**: `useFileStorage`, `Sidebar` UI components, `WorkflowBreadcrumb`, `ThemeToggle`

#### `/src/components/workflow-breadcrumb.tsx` - **WorkflowBreadcrumb**
Breadcrumb navigation showing current workflow step (Upload → Augment → Visualize).

**Exports**: `WorkflowBreadcrumb`
**Dependencies**: `Breadcrumb` UI components

#### `/src/components/theme-toggle.tsx` - **ThemeToggle**
Light/dark mode toggle using `next-themes`.

**Exports**: `ThemeToggle`
**Dependencies**: `next-themes`, `Button`, `DropdownMenu`

#### `/src/components/ai-provider-config-demo.tsx` - **AIProviderConfigDemo**
Demo component for AI provider configuration UI (used only in style guide).

**Exports**: `AIProviderConfigDemo`
**Dependencies**: `ModelSelector`, `ProviderSelector`
**Status**: ⚠️ Demo-only component, not used in production

---

### **Spreadsheet Components**

#### `/src/components/spreadsheet/SpreadsheetEditor.tsx` - **SpreadsheetEditor**
Main spreadsheet editor with toolbar, column management, and AI column generation. Handles data mutations and auto-saves to IndexedDB.

**Exports**: `SpreadsheetEditor`
**Key Features**:
- Add/edit/delete columns
- AI column generation with progress tracking
- Data export (CSV/JSON)
- Auto-save to IndexedDB

**Dependencies**: `SpreadsheetTable`, `AddColumnModal`, `COLUMN_TEMPLATES`, `generateColumnData`

#### `/src/components/spreadsheet/SpreadsheetTable.tsx` - **SpreadsheetTable**
Spreadsheet table with editable cells, column visibility toggling, and horizontal scroll.

**Exports**: `SpreadsheetTable`
**Key Features**:
- Editable cells with auto-save
- Column show/hide
- Scrollable viewport
- Sticky header

**Dependencies**: `Table` UI components, `SpreadsheetData` types

#### `/src/components/spreadsheet/AddColumnModal.tsx` - **AddColumnModal**
Side drawer for configuring AI-powered columns. Includes template selection, model/provider pickers, prompt editor, and web search settings.

**Exports**: `AddColumnModal`
**Key Features**:
- AI column template selection
- Model search and selection (HuggingFace integration)
- Provider selection with compatibility filtering
- Web search toggle with automatic model/provider filtering
- Generation settings (temperature, maxTokens, search context size)
- Prompt interpolation preview
- Structured output schema builder

**Dependencies**: `ModelSelector`, `ProviderSelector`, `GenerationSettings`, `PromptComposer`

#### `/src/components/spreadsheet/GenerationSettings.tsx` - **GenerationSettings**
Component for configuring AI generation parameters.

**Exports**: `GenerationSettings`
**Key Features**:
- Temperature slider (0-2)
- Max tokens input (1-8192)
- Web search context size (low/medium/high)
- Optional user location for localized search

**Dependencies**: `Slider`, `Input`, `Select`

#### `/src/components/spreadsheet/ModelSelector.tsx` - **ModelSelector**
Searchable dropdown for selecting AI models (100+ from HuggingFace + recommended models).

**Exports**: `ModelSelector`
**Key Features**:
- Lazy search (debounced HuggingFace API calls)
- Categorization (recommended vs all models)
- Parameter display (size, context length)
- Keyboard navigation

**Dependencies**: `searchModels`, `getModelById`, `Model` types

#### `/src/components/spreadsheet/ProviderSelector.tsx` - **ProviderSelector**
Dropdown for selecting inference provider, with auto-filtering based on model compatibility.

**Exports**: `ProviderSelector`
**Key Features**:
- Auto-filter compatible providers
- Provider metadata (name, description)
- Default provider suggestion

**Dependencies**: `getCompatibleProviders`, `getDefaultProviderForModel`, `ModelProvider` types

#### `/src/components/spreadsheet/types.ts` - **Spreadsheet Types**
TypeScript types for spreadsheet data structures.

**Exports**: `Column`, `SpreadsheetData`

---

### **UI Components (shadcn/ui - 22 components)**

All in `/src/components/ui/`:
- `avatar.tsx`, `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `card.tsx`
- `command.tsx` ✨ (NEW - used by ModelSelector)
- `dialog.tsx`, `dropdown-menu.tsx`
- `hover-card.tsx` ✨ (NEW - used by ModelSelector)
- `input.tsx`, `label.tsx`
- `popover.tsx` ✨ (NEW - used by ProviderSelector)
- `progress.tsx`, `scroll-area.tsx` ✨ (NEW - used by SpreadsheetTable)
- `select.tsx`, `separator.tsx`, `sheet.tsx`
- `sidebar.tsx`, `skeleton.tsx`, `table.tsx`, `textarea.tsx`, `tooltip.tsx`

All are Radix UI-based primitives styled with Tailwind CSS.

---

## Library (lib/) - Core Business Logic

### **Data Processing**

#### `/src/lib/format-parser.ts` - **parseFileContent**, **flattenObject**
Intelligent multi-format parser with format-specific adapters and deep object flattening.

**Exports**:
- `parseFileContent(content: string, format: SupportedFormat): ParsedData`
- `flattenObject(obj: any, config?: FlattenConfig): Record<string, any>`
- `ParsedData` interface

**Features**:
- Format detection fallback
- Recursive object flattening with dot notation (e.g., `user.name`, `metadata.score`)
- Memoization cache (LRU-like) for repeated parsing
- Configurable depth/array limits (parser.config.ts)

**Dependencies**: `papaparse`, `parserConfig`, `agent-data` types
**Test Coverage**: ✅ `format-parser.test.ts`

#### `/src/lib/format-detector.ts` - **FormatDetector**
Auto-detects data format from file content with confidence scoring.

**Exports**: `FormatDetector` class

**Methods**:
- `detectFormat(content: string): FormatDetectionResult`
- `validateFormat(content: string, format: SupportedFormat): boolean`

**Features**:
- Confidence scoring (0-1)
- Heuristic-based detection (JSONL, JSON, CSV, agent formats)
- Suggestion generation for ambiguous formats

**Dependencies**: `papaparse`, `agent-data` types

#### `/src/lib/data-processor.ts` - **DataProcessor**
Processes and normalizes raw data to standardized schema.

**Exports**: `DataProcessor` class

**Methods**:
- `processData(data: any, format: SupportedFormat): NormalizedAgentData[]`
- Private format-specific processors

**Features**:
- Format-specific adapters (Langfuse, LangSmith, Arize, etc.)
- Metadata extraction
- Validation with error collection

**Dependencies**: `papaparse`, `agent-data` types

**Note**: ⚠️ Some overlap with `format-parser.ts` - consider consolidation.

---

### **AI/ML**

#### `/src/lib/ai-inference.ts` - **generateCompletion**, **generateStructuredCompletion**
AI inference interface using Vercel AI SDK with multi-provider support.

**Exports**:
- `generateCompletion(options, modelConfig): Promise<InferenceResult>`
- `generateStructuredCompletion(options, modelConfig): Promise<InferenceResult>`
- `interpolatePromptForRow(prompt, row): string`
- `getWebSearchTools(providerId, modelConfig, webSearch): ToolSet`

**Features**:
- Multi-provider support: OpenAI, Anthropic, Google, Groq, Cohere, Mistral, Perplexity
- Text and structured output modes
- Web search augmentation (OpenAI webSearchPreview, Google googleSearch, Perplexity native)
- OpenAI Responses API support for search-preview models
- Error classification for rate limits, auth failures, network issues

**Dependencies**: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/perplexity`, `ai`

#### `/src/lib/error-messages.ts` - **Error Display**
User-facing error messages for AI and web search errors.

**Exports**:
- `WEB_SEARCH_ERROR_MESSAGES` - Search-specific error messages
- `AI_ERROR_MESSAGES` - Standard AI error messages
- `formatErrorMessage(errorType)` - Get user-friendly message
- `isRetryableError(errorType)` - Check if error is retryable

#### `/src/types/web-search.ts` - **Web Search Types**
Type definitions for web search configuration.

**Exports**:
- `WebSearchConfig` - Configuration (enabled, contextSize, userLocation)
- `SearchSource` - Source citation (url, title, snippet)
- `SearchContextSize` - 'low' | 'medium' | 'high'
- `WebSearchErrorType` - Search-specific error types

#### `/src/lib/models.ts` - **searchModels**, **getModelById**, **RECOMMENDED_MODELS**
Model management and HuggingFace API integration.

**Exports**:
- `searchModels(params: ModelSearchParams): Promise<ModelSearchResponse>`
- `getModelById(id: string): Promise<Model | null>`
- `fetchHuggingFaceModels(query: string, limit?: number): Promise<Model[]>`
- `RECOMMENDED_MODELS: Model[]` (curated list)

**Features**:
- HuggingFace API integration via Axios
- Model categorization (chat, completion, etc.)
- Parameter extraction (size, context length, quantization)
- Search with pagination

**Dependencies**: `axios`, `Model` types

#### `/src/lib/providers.ts` - **INFERENCE_PROVIDERS**, **getCompatibleProviders**
Inference provider configuration and compatibility mapping.

**Exports**:
- `INFERENCE_PROVIDERS: ModelProvider[]` (OpenAI, Anthropic, Google, Groq, Cohere, Mistral, Perplexity)
- `getCompatibleProviders(modelId: string): ModelProvider[]`
- `getDefaultProviderForModel(modelId: string): ModelProvider | null`

**Features**:
- Provider metadata (name, description, base URL, supported models)
- Auto-filtering by model compatibility
- Default provider suggestions
- Web search capability detection

**Dependencies**: `ModelProvider` types

#### `/src/lib/model-registry-server.ts` - **Model Registry**
Server-side model configuration loaded from YAML.

**Exports**:
- `loadModelRegistryServer()` - Load and cache model registry
- `getModelById(modelId)` - Get model configuration
- `getAllModels()` - Get all registered models

**Model Fields**:
- `id`, `name`, `provider`, `contextWindow`, `inputCost`, `outputCost`
- `apiMode` - 'responses' | 'completions' (for OpenAI)
- `searchSupport` - Whether model supports web search tools
- `searchBuiltIn` - Whether search is always-on (Perplexity)

**Configuration**: `src/config/models/model-registry.yaml`

#### `/src/config/provider-settings.ts` - **Provider Configuration**
Provider API key management and settings.

**Exports**:
- `ProviderKey` - Union type of supported providers
- `PROVIDER_META` - Provider metadata (label, envVar, link)
- `getProviderApiKey(config, providerId)` - Get API key
- `isProviderEnabled(config, providerId)` - Check if provider is configured

**Dependencies**: `provider-config.json` (local file with API keys)

---

### **Utilities**

#### `/src/lib/utils.ts` - **cn**
Utility for merging Tailwind CSS classes with conflict resolution.

**Exports**: `cn(...inputs: ClassValue[]): string`

**Dependencies**: `clsx`, `tailwind-merge`

---

## Hooks (hooks/) - React Hooks

#### `/src/hooks/use-file-storage.ts` - **useFileStorage**
IndexedDB-based file storage hook with cross-tab synchronization.

**Exports**: `useFileStorage()`, `StoredFile` interface

**Methods**:
- `files: StoredFile[]` - All stored files
- `getFile(id: string): StoredFile | undefined`
- `saveFile(file: StoredFile): Promise<void>`
- `deleteFile(id: string): Promise<void>`
- `updateFile(id: string, updates: Partial<StoredFile>): Promise<void>`

**Features**:
- Optimistic concurrency control (version checking)
- Operation queue to prevent race conditions
- Cross-tab synchronization via `CustomEvent`
- File size limits (50MB max)
- Auto-refresh on external changes

**Dependencies**: None (pure IndexedDB)
**Test Coverage**: ✅ `use-file-storage.test.ts`

#### `/src/hooks/use-mobile.ts` - **useIsMobile**
Responsive mobile breakpoint detection (768px).

**Exports**: `useIsMobile(): boolean`

**Dependencies**: React

---

## Types (types/) - TypeScript Definitions

#### `/src/types/index.ts`
Re-exports all types from `agent-data.ts`.

#### `/src/types/agent-data.ts`
Comprehensive type definitions for agent data formats.

**Exports**:
- `NormalizedAgentData`, `AugmentedAgentData`, `EmbeddedAgentData`
- Format-specific types: `MessageCentricData`, `LangfuseSpanData`, `LangSmithRunData`, `TurnLevelData`, `ArizeTraceData`
- `SupportedFormat` (union type)
- `FormatDetectionResult`, `FieldMapping`, `ValidationError`, `DataSchema`, `UploadResult`

#### `/src/types/models.ts`
Model and provider type definitions.

**Exports**:
- `Model`, `ModelProvider`, `ModelCategory`
- `ModelSearchParams`, `ModelSearchResponse`
- `InferenceRequest`, `InferenceResponse`

#### `/src/types/file-storage.ts`
File selection event types for cross-component communication.

**Exports**: `FileSelectionSource`, `FileSelectionContext`, `FileSelectionEventDetail`

---

## Config (config/) - Configuration Files

#### `/src/config/ai-column-templates.ts` - **COLUMN_TEMPLATES**, **loadPromptConfig**
AI column template configurations with YAML prompt loading.

**Exports**:
- `COLUMN_TEMPLATES` - Array of template definitions
- `loadPromptConfig(templateId: string): Promise<string>`
- `interpolatePrompt(template: string, context: Record<string, any>): string`
- `getTemplateGroups(): { common: Template[], custom: Template[] }`

**Templates**:
- `translate` - Translate text to target language
- `extract_keywords` - Extract keywords from text
- `summarize` - Summarize long text
- `sentiment` - Sentiment analysis (positive/neutral/negative)
- `classify` - Custom classification
- `custom` - Blank template

**Dependencies**: `lucide-react` icons

#### `/src/config/parser.config.ts` - **parserConfig**
Parser configuration limits.

**Exports**: `parserConfig` object
- `maxFlattenDepth: 10`
- `maxArrayLength: 1000`
- `maxStringLength: 10000`

---

## Test Files

#### `/src/lib/__tests__/format-parser.test.ts`
Unit tests for `format-parser.ts` functionality.

#### `/src/hooks/__tests__/use-file-storage.test.ts`
Unit tests for `useFileStorage` hook.

---

## Styles

#### `/src/app/globals.css`
Global styles with Tailwind CSS v4, theme variables, and custom scrollbar.

**Features**:
- CSS custom properties for theming (light/dark)
- Tailwind CSS v4 imports
- Custom scrollbar styles
- Dark mode support via `data-theme` attribute

---

## Data Flow Diagrams

### File Upload Flow
```
User drops file
  → EnhancedUpload component
  → FormatDetector.detectFormat()
    → Heuristic analysis (JSONL, JSON, CSV)
    → Confidence scoring
  → parseFileContent(content, detectedFormat)
    → Format-specific adapter
    → flattenObject() for nested data
    → Memoization cache check
  → useFileStorage.saveFile()
    → Operation queue enqueue
    → IndexedDB transaction
    → Version tracking (concurrency control)
    → CustomEvent broadcast (cross-tab sync)
  → Navigate to /edit/{fileId}
```

### AI Column Generation Flow
```
User opens AddColumnModal
  → Select template from COLUMN_TEMPLATES
    → loadPromptConfig() fetches YAML
  → ModelSelector searches HuggingFace API
    → Lazy search with debounce
    → Category filtering (recommended/all)
  → ProviderSelector filters by compatibility
    → getCompatibleProviders(modelId)
  → User configures prompt
    → interpolatePrompt() with row context
  → generateColumnData() for each row
    → Mock AI response (future: real API)
    → 500-1500ms delay simulation
  → Update SpreadsheetData
  → useFileStorage.updateFile() auto-save
```

### Cross-Tab Synchronization
```
Tab 1: updateFile()
  → IndexedDB transaction
  → window.dispatchEvent(CustomEvent('file-updated'))

Tab 2: useEffect listener
  → CustomEvent received
  → loadFiles() refresh
  → UI updates automatically
```

---

## Key Architecture Decisions

### 1. **Local-First Design**
- No backend server—all processing client-side
- IndexedDB for persistence (50MB limit)
- Privacy-first (data never leaves browser except AI requests)

**Rationale**: Simplicity, privacy, no infrastructure costs

### 2. **Next.js App Router**
- File-based routing (`/edit/[fileId]`)
- React Server Components (RSC) where applicable
- Client components for interactivity

**Rationale**: Modern Next.js best practices, better performance

### 3. **TypeScript Strict Mode**
- Comprehensive type coverage
- Separate type files by domain
- Strong inference throughout

**Rationale**: Prevent bugs, better DX, self-documenting code

### 4. **shadcn/ui Component Strategy**
- Copy-paste components (not npm package)
- Radix UI primitives for accessibility
- Full control over styling

**Rationale**: Flexibility, no version lock-in, easy customization

### 5. **Memoization in Parser**
- LRU-like cache for repeated parsing
- Configurable limits (parser.config.ts)

**Rationale**: Performance optimization for large files

### 6. **Operation Queue in File Storage**
- Sequential operation processing
- Prevents race conditions in IndexedDB

**Rationale**: Data integrity, concurrent operation safety

### 7. **Mock AI Inference**
- Realistic delays (500-1500ms)
- Placeholder for future API integration

**Rationale**: UI/UX development without API dependency

---

## Performance Optimizations

1. **Memoization**: Parser cache for repeated operations
2. **Lazy Loading**: Model search only on user interaction
3. **Debouncing**: Model search input debounced (300ms)
4. **Operation Queue**: Prevents IndexedDB race conditions
5. **Virtual Scrolling**: Considered for large datasets (not implemented)
6. **Web Workers**: Future consideration for parsing

---

## Security Considerations

1. **Client-side only**: No server-side vulnerabilities
2. **File size limits**: 50MB max to prevent browser crashes
3. **XSS protection**: React's built-in escaping
4. **API key storage**: Future need for secure storage (localStorage with encryption?)
5. **No authentication**: Appropriate for local-first app

---

## Scalability Limitations

1. **Large datasets**: Current implementation may struggle with 100k+ rows
2. **IndexedDB limits**: Browser-dependent (typically 50% of available disk space)
3. **Memory constraints**: All data loaded into memory (no pagination)
4. **AI batch processing**: Sequential row processing (could parallelize)

**Recommendations**:
- Add virtual scrolling for 10k+ rows
- Implement pagination for very large files
- Use web workers for parsing
- Batch AI requests (provider-dependent)

---

## Unused/Orphaned Files

**None detected** - All 53 source files are actively used.

**Recently added files** (from git status):
- `command.tsx`, `hover-card.tsx`, `popover.tsx`, `scroll-area.tsx` - NEW shadcn components (dependencies for ModelSelector/ProviderSelector)

**Potential cleanup**:
- `/src/components/ai-provider-config-demo.tsx` - Demo-only component (used only in style guide)

---

## DuckDB Storage Layer

#### `/src/lib/duckdb/` - **DuckDB WASM Storage**
Browser-based SQL database for data persistence.

**Key Files**:
- `client.ts` - DuckDB connection management
- `schema.ts` - Table definitions and migrations
- `operations.ts` - CRUD operations
- `file-storage.ts` - File upload/list/delete
- `types.ts` - TypeScript interfaces

**Tables**:
- `files` - File metadata (id, name, format, size)
- `file_data_{fileId}` - Dynamic tables for parsed data
- `column_metadata` - AI column configuration (model, provider, prompt, web search settings)
- `cell_metadata` - Cell status, errors, sources

**Features**:
- OPFS persistence (survives browser refresh)
- Schema migrations for backwards compatibility
- Batch operations for performance
- Web search sources storage per-cell

---

## Technical Debt & Future Work

### Immediate Priority (🚨)
1. ~~**Implement real AI inference**~~ ✅ Completed
2. **Add error handling UI** - Toast notifications for errors
3. **Add loading states** - Better UX during AI generation

### Medium Priority (⚠️)
1. **Consolidate data-processor.ts and format-parser.ts** - Reduce overlap
2. **Add undo/redo** - Spreadsheet editor history
3. **Implement data export** - Export to CSV, JSON, Parquet
4. **Add logging infrastructure** - Structured logging for debugging

### Low Priority (💡)
1. **Virtual scrolling** - For large datasets
2. **Web workers** - Offload parsing to background thread
3. ~~**Batch AI requests**~~ ✅ Implemented with provider-specific batch sizes
4. **Real-time collaboration** - WebSocket/CRDT (out of scope)

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm/yarn/pnpm

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### Build
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

---

## File Count Summary

| Category | Count |
|----------|-------|
| **Pages** | 3 |
| **API Routes** | 1 |
| **Components** | 11 |
| **UI Components** | 22 |
| **Lib Functions** | 7 |
| **Hooks** | 2 |
| **Types** | 4 |
| **Config** | 2 |
| **Tests** | 2 |
| **Styles** | 1 |
| **TOTAL** | **53** |

---

## Component Dependency Graph

```
useFileStorage (2 dependencies)
├── EnhancedUpload
│   └── Home Page
└── AppSidebar
    └── RootLayout

FormatDetector
└── EnhancedUpload

format-parser
└── EnhancedUpload

SpreadsheetEditor
└── EditPage
    ├── SpreadsheetTable
    └── AddColumnModal
        ├── ModelSelector
        │   └── models lib
        │       └── HuggingFace API
        └── ProviderSelector
            └── providers lib

COLUMN_TEMPLATES
├── SpreadsheetEditor
└── AddColumnModal
    └── loadPromptConfig
        └── /api/prompts/[templateId]
```

---

## External Dependencies

### Production
- `next@15` - Framework
- `react@19`, `react-dom@19` - UI library
- `@radix-ui/*` - 15 Radix UI primitives
- `lucide-react` - Icons
- `next-themes` - Theme management
- `papaparse` - CSV parsing
- `axios` - HTTP client
- `yaml` - YAML parsing
- `clsx`, `tailwind-merge` - CSS utilities
- `@duckdb/duckdb-wasm` - Browser-based SQL database

### AI SDK (Vercel AI SDK)
- `ai` - Core AI SDK
- `@ai-sdk/openai` - OpenAI provider (includes Responses API)
- `@ai-sdk/anthropic` - Anthropic provider
- `@ai-sdk/google` - Google Generative AI provider
- `@ai-sdk/perplexity` - Perplexity provider (native search)
- `@ai-sdk/groq` - Groq provider
- `@ai-sdk/cohere` - Cohere provider
- `@ai-sdk/mistral` - Mistral provider

### Development
- `typescript@5.x` - Type checking
- `eslint@9` - Linting
- `@testing-library/*` - Testing
- `jest` - Test runner

---

## Conclusion

FluffyViz is a well-architected, modern Next.js application with strong type safety, modular design, and thoughtful performance optimizations. The codebase is clean, maintainable, and follows React/Next.js best practices.

**Key strengths**:
- Comprehensive TypeScript types
- Modular architecture with clear separation of concerns
- Performance-conscious (memoization, operation queues, batch processing)
- Multi-provider AI inference with web search augmentation
- DuckDB WASM for robust browser-based persistence
- Accessibility-first (Radix UI)

**Recent additions** (Dec 2025):
- Web search augmentation for AI columns
- Perplexity provider integration
- Generation settings UI
- DuckDB schema for sources storage

**No orphaned files detected** - the codebase is lean and purposeful.

---

**Last Updated**: December 2025
**Version**: Beta Build

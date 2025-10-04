# FluffyViz - Developer Overview

*Last Updated: October 10, 2025*

## Architecture Summary

FluffyViz is a Next.js 15 (App Router) application with TypeScript, React 19, and Tailwind CSS v4. It's a browser-based data transformation platform that processes AI agent logs and provides AI-powered spreadsheet augmentation. All data processing happens client-side using IndexedDB for persistence.

**Tech Stack:**
- Next.js 15.5.4 (App Router)
- React 19.1.0
- TypeScript 5 (strict mode)
- Tailwind CSS v4
- shadcn/ui + Radix UI
- IndexedDB (browser storage)
- PapaParse (CSV parsing)
- js-yaml (YAML configs)
- Jest + Testing Library (testing)

**Recent Improvements (October 2025):**
- ✅ Performance optimizations for file storage and parsing
- ✅ Comprehensive testing infrastructure (21 unit tests)
- ✅ Configurable limits for memory safety
- ✅ Race condition prevention with operation queuing

---

## Directory Structure

```
fluffy-viz/src/
├── app/                      # Next.js App Router
│   ├── page.tsx             # Homepage with upload
│   ├── edit/[fileId]/       # Spreadsheet editor route
│   ├── style-guide/         # Design system showcase
│   └── api/prompts/         # YAML prompt loader API
├── components/              # React components
│   ├── spreadsheet/         # Spreadsheet editor components
│   ├── ui/                  # shadcn/ui components
│   └── [other components]   # Upload, sidebar, header, etc.
├── lib/                     # Core business logic
│   └── __tests__/           # ✨ NEW: Unit tests
├── hooks/                   # Custom React hooks
│   └── __tests__/           # ✨ NEW: Hook tests
├── types/                   # TypeScript type definitions
└── config/                  # AI templates & prompts
    └── parser.config.ts     # ✨ NEW: Parser performance config
```

---

## Key Files & Components

### Pages (`/app`)

#### `page.tsx` - Homepage
Main landing page with file upload interface.
- Hero section with product description
- `<EnhancedUpload />` component for file upload
- 4-step workflow visualization
- Target audience information

#### `edit/[fileId]/page.tsx` - Spreadsheet Editor Page
Dynamic route for editing uploaded files.
- Loads file from IndexedDB by fileId
- Renders `<SpreadsheetEditor />` component
- Handles file deletion and redirects to home
- Listens for file selection/deletion events

#### `style-guide/page.tsx` - Design System Documentation
Comprehensive UI component showcase for the design system.

#### `api/prompts/[templateId]/route.ts` - Prompt API
REST API endpoint that loads YAML prompt configurations.
- Uses `js-yaml` to parse YAML files
- Serves AI column generation templates

---

### Components (`/components`)

#### `enhanced-upload.tsx` - Advanced File Upload System
Primary file upload interface with drag-and-drop.
- **Features**: Format auto-detection, validation, preview generation, progress tracking
- **Integrations**: `FormatDetector.detectFormat()`, `DataProcessor.processFile()`, `useFileStorage()` hook
- **Flow**: Upload → Detect → Preview → Validate → Process → Store → Redirect to `/edit/[fileId]`

#### `app-sidebar.tsx` - File Management Sidebar
File browser and management interface.
- **Features**: File list with metadata, drag-and-drop upload, rename/delete operations, "Delete All" with confirmation
- **Storage**: Syncs with IndexedDB, emits custom events for cross-component communication
- **LLM Config**: Button to configure LLM providers

#### `app-header.tsx` - Application Header [UNUSED/REMNANT]
Simple header component with disabled menu button. Not currently used in app.

#### `theme-toggle.tsx` - Dark Mode Toggle
Light/dark theme switcher using localStorage and system preference.

#### `workflow-breadcrumb.tsx` - Workflow Progress Indicators
Visual progress tracking components.
- **Variants**: `WorkflowBreadcrumb`, `CompactWorkflowBreadcrumb`, `VerticalWorkflowBreadcrumb`
- **States**: pending/current/completed

#### `ai-provider-config-demo.tsx` - AI Provider Configuration
AI inference provider management interface.
- **Providers**: HuggingFace, Google, Cohere, Mistral, Anthropic, OpenAI, Local
- **Features**: API key management (browser-only), capability toggles, free tier indicators

---

### Spreadsheet Components (`/components/spreadsheet/`)

#### `SpreadsheetEditor.tsx` - Main Spreadsheet Container
Orchestrates the spreadsheet editing workflow.
- **Responsibilities**: File loading, column management, AI column generation, save/export
- **Data Flow**: Load from IndexedDB → Parse with `parseFileContent()` → Render in `<SpreadsheetTable />` → Save/export
- **AI Integration**: Calls `generateColumnData()` for AI-powered columns with progress callbacks

#### `SpreadsheetTable.tsx` - Interactive Spreadsheet Grid
Excel-style spreadsheet interface component.
- **Features**: Excel column headers (A, B, C...), inline cell editing, drag-to-fill (autofill), cell selection, template-based column addition, column visibility toggles
- **UX**: Mimics familiar spreadsheet interactions

#### ~~`Spreadsheet.tsx`~~ - REMOVED ✅
Removed October 10, 2025. Was unused demo component with hardcoded data.

#### `AddColumnModal.tsx` - AI Column Configuration Modal
Modal for configuring AI-generated columns.
- **Features**: Column name input, prompt template editor, variable/column reference selector, model/provider selection, "Search the web" toggle
- **Integration**: Loads YAML templates via `loadPromptTemplate()`

#### `ModelSelector.tsx` - AI Model Picker
Search and select AI models from HuggingFace.
- **Features**: Debounced search, categorized models (Recommended vs All), model metadata display, HuggingFace API integration

#### `ProviderSelector.tsx` - Inference Provider Picker
Select inference provider for chosen model.
- **Features**: Auto-selects compatible providers, displays capabilities (streaming, context length, pricing), provider count indicator

#### `types.ts` - Spreadsheet Types
TypeScript type definitions for spreadsheet data structures.

---

### Core Business Logic (`/lib`)

#### `data-processor.ts` - Data Transformation Engine
Processes and normalizes various agent data formats.
- **Supported Formats**: Message-centric JSONL, Langfuse traces, LangSmith runs, Arize traces, Turn-level CSV
- **Features**: Format-specific parsers, data validation with error reporting, field mapping for custom schemas, conversation context tracking, metadata extraction, statistics generation
- **Key Function**: `processFile(content: string, format: string): Promise<NormalizedAgentData>`

#### `format-parser.ts` - Intelligent Data Flattening ✨ OPTIMIZED
Parses and flattens nested data structures for spreadsheet display.
- **Features**: Generic JSON/JSONL parsing, intelligent flattening (dot notation), array handling strategies, CSV parsing with PapaParse, configurable depth limiting
- **Performance**: LRU memoization cache (100 entries), configurable limits via `parser.config.ts`, array truncation (1000 item max), string truncation (10K char max)
- **Key Function**: `parseFileContent(content: string, format: string): { headers: string[], rows: string[][] }`
- **Config**: Uses `/config/parser.config.ts` for maxFlattenDepth (10), maxArrayLength (1000), maxStringLength (10000)

#### `format-detector.ts` - Format Auto-Detection
Automatically identifies data format with confidence scoring.
- **Features**: Confidence scoring, pattern matching for format-specific fields, JSON/JSONL structure analysis, CSV header validation
- **Key Function**: `detectFormat(content: string): FormatDetectionResult`

#### `models.ts` - Model Management
Fetches and manages AI models from HuggingFace.
- **Features**: Recommended models configuration, HuggingFace API integration, model search with filtering, parameter extraction
- **Key Functions**: `searchModels()`, `getRecommendedModels()`

#### `providers.ts` - Provider Management
Manages AI inference providers and model-provider compatibility.
- **Providers**: Groq, Together AI, Novita, OpenAI, Anthropic, Cohere
- **Features**: Pre-configured provider catalog, model-provider compatibility matching, auto-provider selection
- **Key Function**: `getProvidersForModel(model: string): ModelProvider[]`

#### `ai-inference.ts` - AI Generation Engine
Executes AI inference for column generation.
- **Current Implementation**: Mock inference (placeholder for production API)
- **Features**: Batch row processing, progress tracking callbacks, prompt interpolation with row data, error handling
- **Key Function**: `generateColumnData(rows, columnConfig, onProgress): Promise<string[]>`

#### `utils.ts` - Utility Functions
Tailwind CSS class merging utility using `clsx` and `tailwind-merge`.
- **Function**: `cn(...inputs: ClassValue[]): string`

---

### Custom Hooks (`/hooks`)

#### `use-file-storage.ts` - IndexedDB File Persistence ✨ OPTIMIZED
Browser-based file storage system using IndexedDB.
- **Features**: IndexedDB wrapper with async operations, file CRUD operations, global event system for cross-tab sync, file metadata tracking
- **Storage Schema**: `{ id, name, content, format, size, lastModified, version }` (v2 schema)
- **Performance & Safety**: Operation queue prevents race conditions, optimistic concurrency control with versioning, file size limits (50MB max, 10MB warning), version conflict detection
- **Events**: Emits `fileStorageUpdated`, `fileSelected`, `fileDeleted` custom events
- **Key Functions**: `saveFile()`, `renameFile()`, `deleteFile()`, `clearFiles()`
- **Database**: `FluffyVizDB` v2 with automatic migration from v1

#### `use-mobile.ts` - Responsive Breakpoint Detection
Detects mobile viewport (breakpoint: 768px) for responsive UI adaptations.

---

### Type Definitions (`/types`)

#### `agent-data.ts` - Agent Data Types
Core data structure types for agent conversation data.
- **Core Types**: `NormalizedAgentData`, `AugmentedAgentData`, `EmbeddedAgentData`
- **Format-Specific**: `MessageCentricData`, `LangfuseSpanData`, `LangSmithRunData`, `TurnLevelData`, `ArizeTraceData`
- **Processing Types**: `FormatDetectionResult`, `FieldMapping`, `ValidationError`, `UploadResult`

#### `models.ts` - AI Model Types
AI model and inference provider type definitions.
- **Types**: `Model`, `ModelProvider`, `ModelCategory`, `InferenceRequest`, `InferenceResponse`

#### `file-storage.ts` - File Storage Types
File storage event and metadata types.
- **Types**: `FileSelectionSource`, `FileSelectionContext`, `FileSelectionEventDetail`

#### ~~`tasks.ts`~~ - REMOVED ✅
Removed October 10, 2025. Was unused task type definitions.

#### `index.ts` - Type Exports
Re-exports commonly used types for cleaner imports.

---

### Configuration (`/config`)

#### `parser.config.ts` - Parser Performance Configuration ✨ NEW
Centralized configuration for data parsing and flattening performance limits.
- **Settings**: `maxFlattenDepth: 10`, `maxArrayLength: 1000`, `maxStringLength: 10000`, `showWarnings: true`
- **Purpose**: Prevents browser crashes from deeply nested data, massive arrays, or oversized strings
- **Usage**: Imported by `format-parser.ts` for all flattening operations

#### `ai-column-templates.ts` - AI Column Templates
Defines AI augmentation templates and their metadata.
- **Templates**: Translate, Extract Keywords, Summarize, Sentiment Analysis, Classify, Custom (single/multi-column)
- **Features**: YAML-based prompt loading, template grouping, prompt interpolation utilities
- **Key Function**: `loadPromptTemplate(templateId): Promise<AIColumnTemplate>`

#### `/config/prompts/*.yaml` - AI Prompt Configurations
YAML files containing prompt configurations for each template.
- **Files**: `translate.yaml`, `extract-keywords.yaml`, `summarize.yaml`, `sentiment-analysis.yaml`, `classify.yaml`, `custom.yaml`
- **Structure**: System instructions, prompt templates, template variables, response format specs, inference config

---

## Data Flow Architecture

### Upload Flow
```
User uploads file
  ↓
EnhancedUpload component
  ↓
FormatDetector.detectFormat() → Confidence scoring
  ↓
Format preview + validation → User confirmation
  ↓
DataProcessor.processFile() → Normalized data
  ↓
IndexedDB storage via useFileStorage hook
  ↓
Redirect to /edit/[fileId]
```

### Spreadsheet Editing Flow
```
Load file from IndexedDB
  ↓
parseFileContent() → Flatten nested data
  ↓
Display in SpreadsheetTable → Excel-style grid
  ↓
User adds AI column → AddColumnModal
  ↓
Select model + provider → ModelSelector, ProviderSelector
  ↓
Configure prompt → Template interpolation with {{column_name}}
  ↓
Generate data → ai-inference.ts (batch processing)
  ↓
Update cells with AI results
  ↓
Save/export → CSV download or IndexedDB update
```

### AI Column Generation Flow
```
User clicks "Add Column"
  ↓
Template selection → Load YAML config via /api/prompts/[templateId]
  ↓
Interpolate prompt with column references ({{column_name}})
  ↓
For each row:
  - Extract referenced column values
  - Interpolate prompt with row data
  - Call AI inference (mock or real API)
  - Store result in cell
  ↓
Progress updates → UI feedback
  ↓
Complete → Display results in spreadsheet
```

---

## Event System

### Custom Events
The app uses browser custom events for cross-component communication:

- **`fileStorageUpdated`**: Emitted when IndexedDB changes (any file operation)
- **`fileSelected`**: Emitted when user selects a file to edit
- **`fileDeleted`**: Emitted when user deletes a file

**Usage Example:**
```typescript
// Emit
window.dispatchEvent(new CustomEvent('fileSelected', {
  detail: { fileId, source: 'sidebar' }
}));

// Listen
useEffect(() => {
  const handler = (e: CustomEvent) => { /* ... */ };
  window.addEventListener('fileSelected', handler);
  return () => window.removeEventListener('fileSelected', handler);
}, []);
```

---

## Key Design Patterns

1. **Event-Driven Architecture**: Custom events for file operations across components
2. **Format Abstraction**: Unified `NormalizedAgentData` regardless of input format
3. **Progressive Enhancement**: Auto-detection with manual override capability
4. **Intelligent Flattening**: Nested objects → spreadsheet columns with configurable depth
5. **Template System**: YAML-based AI prompts with variable interpolation (`{{column_name}}`)
6. **Provider Abstraction**: Model-agnostic inference with provider compatibility matching
7. **Operation Queuing** ✨: Sequential execution of storage operations prevents race conditions
8. **Optimistic Concurrency** ✨: Version-based conflict detection for multi-tab safety
9. **Performance Limits** ✨: Configurable constraints prevent browser crashes
10. **Memoization** ✨: LRU cache for expensive flattening operations

---

## Integration Points

### External Services
- **HuggingFace API**: Model search and metadata (`/api/models`)
- **AI Providers**: Groq, Together AI, OpenAI, Anthropic, Cohere, Novita
- **Apple Embedding Atlas**: Export destination for visualization

### Browser APIs
- **IndexedDB**: File persistence and retrieval
- **FileReader API**: File content reading
- **Custom Events**: Cross-component communication
- **localStorage**: Theme preference, provider config

---

## ~~Unused/Remnant Files~~ - CLEANED UP ✅

**All remnant files removed on October 10, 2025:**
1. ✅ **`/components/Spreadsheet.tsx`** - Removed
2. ✅ **`/components/app-header.tsx`** - Removed
3. ✅ **`/types/tasks.ts`** - Removed

---

## Testing Infrastructure ✨ NEW

**Added October 10, 2025:**

### Test Setup
- **Framework**: Jest 30.2.0 with Next.js integration
- **Libraries**: @testing-library/react, @testing-library/jest-dom
- **Configuration**: `jest.config.js`, `jest.setup.js`
- **Scripts**: `npm test`, `npm test:watch`

### Test Coverage
- **`lib/__tests__/format-parser.test.ts`**: 13 tests - config integration, nesting, arrays, strings, performance
- **`hooks/__tests__/use-file-storage.test.ts`**: 8 tests - size limits, versioning, queue, validation
- **Total**: 21 passing tests ✓

### Remaining Test Coverage Needed
- `data-processor.ts`
- `format-detector.ts`
- `ai-inference.ts`

---

## Known Issues & Technical Debt

### ✅ Completed (October 10, 2025)
- ✅ **Performance**: Memory inefficiency with large files - Fixed with size limits
- ✅ **Performance**: Race conditions in file storage - Fixed with operation queue
- ✅ **Performance**: Inefficient nested object flattening - Fixed with memoization + config
- ✅ **Code Quality**: Clean up remnant components - All removed
- ✅ **Testing**: Add unit/integration tests - 21 tests added

### High Priority (P0/P1) - Remaining
- **Security**: API keys stored in localStorage (should use secure vaults)
- **Security**: Unsafe JSON parsing in format-parser.ts (use Zod validation)
- **Architecture**: AI inference uses mock data (needs real API integration)
- **Format Detection**: Rigid format detection (needs flexible/generic parser)

### Medium Priority (P2)
- **UX**: No loading states during AI generation
- **UX**: No error recovery for failed AI generations
- **Accessibility**: Improve keyboard navigation in spreadsheet
- **Code Quality**: Refactor large components (data-processor, enhanced-upload)

### Low Priority (P3)
- **SEO**: Add meta tags and descriptions
- **Config**: Add security headers to next.config.ts
- **Infrastructure**: Create validation.ts with Zod schemas
- **Infrastructure**: Create storage-adapter.ts abstraction

---

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linter
npm run lint

# Run tests ✨ NEW
npm test

# Run tests in watch mode ✨ NEW
npm test:watch
```

---

## Path Aliases

Configured in `tsconfig.json`:
- `@/*` → `./src/*`
- `@/components` → `./src/components`
- `@/lib` → `./src/lib`
- `@/hooks` → `./src/hooks`

---

## Environment Setup

No environment variables required for local development. API keys are managed through the UI and stored in browser localStorage.

---

## Testing

Currently no automated tests. See `AI-SHEETS-INTEGRATION-TEST-REPORT.md` for manual testing procedures.

---

## Future Development

### Phase 3 Enhancements (Planned)
- Real-time AI streaming for column generation
- Advanced column operations (formulas, aggregations)
- Built-in data visualization (charts, graphs)
- Export to multiple formats (Excel, Google Sheets)
- Collaboration features (share datasets)
- Automatic data validation and cleaning

---

## Resources

- **Main Documentation**: `/ProjectDetails/development-context.md`
- **Integration Plans**: `/ProjectDetails/AI-SpreadSheet-Integration-Final-Plan.md`
- **Backlog**: `/ProjectDetails/backlog.md`
- **Test Report**: `/AI-SHEETS-INTEGRATION-TEST-REPORT.md`

---

*For questions or contributions, see the project documentation in `/ProjectDetails/`.*

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FluffyViz** is a local-first web application for AI/ML engineers to transform raw AI agent conversation logs into actionable spreadsheet data with AI-powered augmentation. The workflow is: **Parse → Augment → Visualize**.

```
Agent Traces → Tabular Format → AI Columns (LLM-as-Judge) → Embedding Atlas (2D UMAP)
```

- **Tech Stack**: Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS v4
- **Storage**: DuckDB WASM (browser-based SQL) + IndexedDB persistence
- **UI Library**: shadcn/ui (Radix primitives)
- **Visualization**: Apple's Embedding Atlas for 2D embedding exploration
- **Architecture**: Client-side first, API routes for AI inference only

## Development Commands

All commands run from `/fluffy-viz` directory:

```bash
# Development
npm run dev              # Start dev server on http://localhost:3000

# Building
npm run build            # Production build
npm start                # Run production build locally

# Testing
npm test                 # Run all tests
npm run test:watch       # Run tests in watch mode

# Linting
npm run lint             # Run ESLint
```

### Running Individual Tests
```bash
# Run specific test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="format parser"

# Run with coverage
npm test -- --coverage
```

## Code Architecture

### Core Data Flow

```
User uploads file
  → FormatDetector auto-detects format (JSONL/JSON/CSV/agent formats)
  → parseFileContent() flattens nested objects with dot notation
  → saveFileToDuckDB() stores in DuckDB WASM table
  → Navigate to /edit/[fileId]
  → SpreadsheetEditor renders via DuckDB queries (pagination, sorting, filtering)
  → User adds AI column via AddColumnModal
  → API route /api/generate-column calls LLM provider (OpenAI, Anthropic, etc.)
  → Results stored in DuckDB with cell-level metadata (status, errors)
  → Embedding Wizard → UMAP projection → Embedding Atlas visualization
```

### Key Architectural Patterns

#### 1. **DuckDB WASM Storage Layer**
- All data stored in browser-based DuckDB (`src/lib/duckdb/`)
- Tables: `file_data_{fileId}` for each uploaded file
- Metadata tables: `column_metadata`, `cell_metadata` for AI column state
- Operations: `src/lib/duckdb/operations.ts` - CRUD, batch updates, queries
- File storage: `src/lib/duckdb/file-storage.ts` - upload, list, delete files
- Schema versioning: `src/lib/duckdb/schema.ts`
- **50MB file size limit**, 30MB warning threshold

#### 2. **Multi-Format Data Parsing**
The system handles 5 agent data formats through a two-layer architecture:

**Layer 1**: `format-detector.ts` - Auto-detection with confidence scoring
**Layer 2**: `format-parser.ts` - Generic parsing with memoization (LRU cache)

**Supported formats**:
- Message-Centric (JSONL)
- Langfuse Spans (JSON)
- LangSmith Runs (JSON)
- Arize Traces (JSON)
- Turn-Level CSV

The `flattenObject()` function converts nested data to spreadsheet columns using dot notation:
```typescript
{ user: { name: "Alice" } } → { "user.name": "Alice" }
```

**Configuration**: `src/config/parser.config.ts` (maxFlattenDepth: 10, maxArrayLength: 1000)

#### 3. **AI Column Generation**
- Templates defined in `src/config/ai-column-templates.ts`
- YAML prompt files in `src/config/prompts/*.yaml`
- Provider configuration: `src/config/provider-settings.ts` (OpenAI, Anthropic, Groq, Cohere, Google, Mistral, HuggingFace, Perplexity)
- API route: `src/app/api/generate-column/route.ts` - batch processing with provider-specific batch sizes
- Inference: `src/lib/ai-inference.ts` - supports text, structured output, and web search modes
- Model registry: `src/lib/model-registry-server.ts` - cached model definitions with `searchSupport` flags
- **Cell metadata tracks**: status (pending/succeeded/failed/edited), errors, original values, web search sources

#### 3a. **Web Search Augmentation**
AI columns can optionally use real-time web search to enhance generation quality:

- **Types**: `src/types/web-search.ts` - WebSearchConfig, SearchSource, SearchContextSize
- **Supported providers**:
  - **OpenAI**: Uses `webSearchPreview` tool with Responses API for search-preview models
  - **Google Gemini**: Uses `googleSearch` tool for grounding
  - **Perplexity**: Native built-in search (always-on for sonar models)
- **UI Components**:
  - `GenerationSettings.tsx` - Temperature, maxTokens, search context size, location settings
  - Web search toggle in AddColumnModal with automatic provider/model filtering
- **Storage**: Sources stored per-cell in `cell_metadata.sources` (JSON)
- **Error handling**: `src/lib/error-messages.ts` - user-friendly error messages for search-specific failures
- **Model fields**: `apiMode`, `searchSupport`, `searchBuiltIn` in model registry YAML

#### 4. **Embedding Visualization**
- Wizard: `src/components/embedding-viewer/embedding-wizard.tsx` - column selection, embedding configuration
- Visualization: `src/components/embedding-viewer/embedding-visualization.tsx` - Apple's Embedding Atlas
- Supports: single column, multi-column concatenation, conversational history aggregation

#### 5. **Component Structure**
```
App Layout (src/app/layout.tsx)
├── ThemeProvider (next-themes)
├── SidebarProvider
│   ├── AppSidebar (file management)
│   └── Main Content
│       ├── Home (src/app/page.tsx)
│       │   └── EnhancedUpload (drag-drop, format detection)
│       └── Edit Page (src/app/edit/[fileId]/page.tsx)
│           └── SpreadsheetEditor
│               ├── SpreadsheetTable (pagination, sorting, filtering, editable cells)
│               ├── AddColumnModal (template selection, prompt composer, schema builder)
│               ├── RetryModal (few-shot learning from edits, scope selection)
│               └── EmbeddingViewer (wizard → atlas visualization)
```

### Important Implementation Details

#### Path Aliases
Always use `@/` prefix for imports:
```typescript
import { parseFileContent } from '@/lib/format-parser';
import { useFileStorage } from '@/hooks/use-file-storage';
```

#### TypeScript Types Organization
- `src/types/agent-data.ts` - Data format types (NormalizedAgentData, SupportedFormat, etc.)
- `src/types/models.ts` - AI model and provider types
- `src/types/file-storage.ts` - File selection events
- `src/types/web-search.ts` - Web search configuration and source types
- `src/types/structured-output.ts` - Structured output schema types
- `src/lib/duckdb/types.ts` - DuckDB storage types (ColumnMetadata, CellMetadata)
- Component-specific types in same file or adjacent `types.ts`

#### Template System
AI column templates use YAML files loaded via API route:
- Config: `src/config/ai-column-templates.ts`
- YAML files: `src/config/prompts/{templateId}.yaml`
- API: `src/app/api/prompts/[templateId]/route.ts`
- Interpolation: `{{column_id}}` syntax for runtime replacement

#### Prompt Composer
- Location: `src/components/spreadsheet/PromptComposer.tsx`
- Uses `@` trigger for column references (variable pills)
- Schema builder for structured output (JSON schema generation)
- Preview accordion shows interpolated prompt

## Testing Strategy

### Current Test Coverage
- `src/lib/__tests__/format-parser.test.ts` - Parser functionality
- `src/hooks/__tests__/use-file-storage.test.ts` - IndexedDB operations

### Test File Locations
Place tests in `__tests__` directory next to source:
```
src/lib/
├── format-parser.ts
└── __tests__/
    └── format-parser.test.ts
```

### Running Tests for New Features
When adding features, write tests BEFORE implementation:
1. Create `*.test.ts` file in appropriate `__tests__/` directory
2. Run `npm run test:watch` for TDD workflow
3. Use Testing Library for component tests
4. Mock IndexedDB operations in unit tests

## Common Pitfalls & Solutions

### IndexedDB Race Conditions
**Problem**: Concurrent operations corrupting data
**Solution**: Always use the operation queue in `useFileStorage`—never direct IndexedDB access

### Parser Memory Issues
**Problem**: Large files (>10k rows) causing browser slowdown
**Solution**:
- Parser has built-in memoization (100-item LRU cache)
- Consider using Web Workers for files >5MB (not yet implemented)
- Configuration limits in `parser.config.ts` prevent runaway flattening

### AI Inference Errors
**Problem**: Column generation fails with API errors
**Solution**:
- Check provider API key in environment variables (e.g., `OPENAI_API_KEY`)
- Check `src/config/provider-settings.ts` for provider configuration
- Batch size is configurable per provider (default: 5)

### Column Dropdown Not Showing Data
**Problem**: Empty column list in AddColumnModal
**Solution**: Ensure `existingColumns` and `data.rows[0]` are passed from SpreadsheetEditor

## File Organization Rules

### When to Edit vs. Create
- **ALWAYS prefer editing** existing files over creating new ones
- Only create new files when adding entirely new features
- Add new UI components to `src/components/ui/` (shadcn pattern)
- Add new utilities to `src/lib/`
- Add new hooks to `src/hooks/`

### shadcn/ui Component Pattern
This project uses copy-paste shadcn components (not npm package):
```bash
# Add new component (run from fluffy-viz/)
npx shadcn@latest add [component-name]
```
Components appear in `src/components/ui/`. Do not modify these directly; create wrapper components if customization needed.

### Format-Specific Parsers
If adding support for new agent data formats:
1. Add format type to `src/types/agent-data.ts` (`SupportedFormat` union)
2. Add detection logic to `src/lib/format-detector.ts`
3. Add parsing logic to `src/lib/format-parser.ts` (in `parseByFormat()`)
4. Add sample file to `/public/` for testing

## Documentation References

**Project docs location**: `ProjectDetails/`

Key docs:
- `2025-12-02/feature-enhancements.md` - Current roadmap and priorities
- `2025-12-02/codebase-audit.md` - Known issues and technical debt
- `ClaudeOct5/ProductOverview-Technical.md` - Complete file inventory

**Sample data**: `/public/sample-*.{json,jsonl,csv}` - Use for testing parsers

## Current Priorities (as of Dec 2025)

See `ProjectDetails/2025-12-02/feature-enhancements.md` for full roadmap.

**Recently Completed**:
- Web search augmentation (OpenAI, Google, Perplexity)
- Perplexity provider integration with sonar models
- Generation settings UI (temperature, maxTokens, search context)
- DuckDB persistence for AI column metadata and sources

**P0 - Core Features**:
1. Embedding Atlas deep integration (pass all columns, hover/color config, search)
2. LLM-as-a-Judge column templates (quality scores, failure modes, intent classification)

**P1 - Export & Polish**:
1. Export functionality (CSV, JSON, Parquet)
2. Single-cell retry with few-shot learning

**P2 - Quality of Life**:
1. HuggingFace model search improvements (caching, better UX)
2. Parser cache management for large datasets

## Git Workflow

### Commit Message Format
Use conventional commits with Claude Code signature:
```
type: brief description

Detailed explanation if needed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

### Branch Strategy
Main branch: `main`

## Performance Considerations

### Large Dataset Handling
- **Current limit**: 50MB file size in DuckDB
- **Parser**: Memoization with LRU cache (100 items), `clearParserCache()` available
- **Rendering**: Server-side pagination via DuckDB queries (100 rows default)
- **Sorting/Filtering**: Handled by DuckDB, not in-memory

### Optimization Checklist
When adding features that process data:
- [ ] Debounce user input (300ms)
- [ ] Memoize expensive computations (`useMemo`)
- [ ] Use `useCallback` for callbacks passed to children
- [ ] Check parser config limits won't be exceeded
- [ ] Test with large sample files (>1000 rows)

## Integration Points for External Tools

### HuggingFace API
- Endpoint: `https://huggingface.co/api`
- Used by: `src/lib/models.ts` for model search
- No auth required for public models
- Rate limits: Unknown—add caching if issues arise

### Embedding Atlas
- Already integrated via `embedding-atlas` npm package
- Uses Mosaic Framework for coordinated views
- Provides: scatter plot, table view, point details, density clustering
- See `src/components/embedding-viewer/` for implementation

## When Stuck

1. **Check existing implementations**: Similar features likely exist (e.g., model selector pattern → provider selector)
2. **Read type definitions**: `src/types/` files document expected data shapes
3. **Check technical docs**: `ProjectDetails/ClaudeOct5/ProductOverview-Technical.md` has full component descriptions
4. **Review recent commits**: `git log --oneline -10` shows recent work patterns
5. **Test with sample data**: Use files in `/public/sample-*` for realistic testing

## Project Philosophy

- **Local-first**: Privacy-focused—data stays in browser
- **Type-safe**: Strict TypeScript—no `any` types without justification
- **Component composition**: Small, focused components over monoliths
- **Progressive enhancement**: Core features work without AI API (upload/view/edit)
- **Performance-conscious**: Memoization, operation queues, size limits throughout

## Maintaining This Document

**Update CLAUDE.md after significant changes:**
- New architectural patterns or data flows
- New key files or directories
- Changed priorities or roadmap
- New common pitfalls discovered
- Integration with new external tools/APIs
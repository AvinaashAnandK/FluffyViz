# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FluffyViz** is a local-first web application for AI/ML engineers to transform raw AI agent conversation logs into actionable spreadsheet data with AI-powered augmentation. The workflow is: **Upload → Augment → Visualize**.

- **Tech Stack**: Next.js 14 (App Router), React 19, TypeScript (strict), Tailwind CSS v4, IndexedDB
- **UI Library**: shadcn/ui (Radix primitives)
- **Architecture**: Client-side only, no backend—all data processing in browser

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
  → useFileStorage hook saves to IndexedDB with optimistic concurrency
  → Navigate to /edit/[fileId]
  → SpreadsheetEditor renders data with SpreadsheetTable
  → User adds AI column via AddColumnModal
  → generateColumnData() creates new column (currently mock, needs real API)
  → Auto-save updates IndexedDB
```

### Key Architectural Patterns

#### 1. **Local-First Storage (useFileStorage hook)**
- All files stored in IndexedDB (50MB limit)
- Optimistic concurrency control with version tracking
- Operation queue prevents race conditions
- Cross-tab synchronization via CustomEvents
- Location: `src/hooks/use-file-storage.ts`

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

#### 3. **AI Column Generation (Current State: Mock)**
- Templates defined in `src/config/ai-column-templates.ts`
- YAML prompt files in `/public/prompts/`
- Model selection via HuggingFace API integration (`src/lib/models.ts`)
- Provider configuration in `src/lib/providers.ts` (OpenAI, Anthropic, Groq, Together AI, Novita, Cohere)
- **⚠️ CRITICAL**: `src/lib/ai-inference.ts` returns mock data—real API integration needed

#### 4. **Component Structure**
```
App Layout (src/app/layout.tsx)
├── ThemeProvider (next-themes)
├── SidebarProvider
│   ├── AppSidebar (file management, uses useFileStorage)
│   └── Main Content
│       ├── Home (src/app/page.tsx)
│       │   └── EnhancedUpload (drag-drop, format detection)
│       └── Edit Page (src/app/edit/[fileId]/page.tsx)
│           └── SpreadsheetEditor
│               ├── SpreadsheetTable (editable cells)
│               └── AddColumnModal (side drawer)
│                   ├── ModelSelector (HuggingFace search)
│                   └── ProviderSelector (compatibility filtering)
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
- Component-specific types in same file or adjacent `types.ts`

#### Template System
AI column templates use YAML files loaded via API route:
- Config: `src/config/ai-column-templates.ts`
- YAML files: `/public/prompts/{templateId}.yaml`
- API: `src/app/api/prompts/[templateId]/route.ts`
- Interpolation: `{{column_name}}` syntax for runtime replacement

#### Prompt Editor (In Development)
**Location**: See `ProjectDetails/PromptEditorRevamp/tech-plan.md`

The new prompt editor will use:
- **TipTap** rich text editor with custom "variable pill" nodes
- **@ trigger** for column references (e.g., type `@` → select column → inserts pill)
- Pills show column name + first-row preview in combobox
- Validation warns about unmapped variables
- Preview accordion shows final `{{column_slug}}` syntax

**Integration point**: Replaces textarea in `AddColumnModal.tsx`

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

### AI Inference Not Working
**Problem**: `generateColumnData()` returns placeholder text
**Solution**: This is expected—mock implementation. Real API integration is the #1 priority (see `ProjectDetails/ClaudeOct5/files-requiring-changes.md`)

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
- `FluffyVizOverview.md` - High-level product vision
- `ClaudeOct5/ProductOverview-Technical.md` - Complete file inventory (53 files)
- `ClaudeOct5/files-requiring-changes.md` - Prioritized implementation roadmap
- `PromptEditorRevamp/tech-plan.md` - Rich text prompt editor spec

**Sample data**: `/public/sample-*.{json,jsonl,csv}` - Use for testing parsers

## Current Priorities (as of Oct 2025)

See `ProjectDetails/ClaudeOct5/files-requiring-changes.md` for full roadmap.

**Immediate (High Priority)**:
1. Implement real AI inference in `src/lib/ai-inference.ts`
2. Add API key management (environment variables + secure storage)
3. Migrate YAML templates to enhanced format with pill metadata
4. Build TipTap-based PromptComposer to replace AddColumnModal textarea

**Next Phase (Medium Priority)**:
1. Refactor overlap between `data-processor.ts` and `format-parser.ts`
2. Replace TypeScript `any` types with proper definitions
3. Add comprehensive error handling for network failures
4. Expand test coverage (integration + E2E)

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
Current branch: `ai-sheets-integration-claude`
Main branch: (not specified—check with user before creating PRs)

## Performance Considerations

### Large Dataset Handling
- **Current limit**: 50MB file size in IndexedDB
- **Parser**: Memoization for repeated operations
- **Rendering**: No virtual scrolling yet—may struggle with 10k+ rows
- **Future**: Consider Web Workers for parsing, virtual scrolling for table

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

### Embedding Atlas (Future)
Export integration planned but not implemented. When adding:
- Research Atlas input format requirements
- Add export button to SpreadsheetEditor toolbar
- Implement data transformation in new `src/lib/atlas-export.ts`

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

# FluffyViz - Files Requiring Changes

This document identifies files that need changes, improvements, or completion, prioritized by urgency and impact.

---

## 1. INCOMPLETE IMPLEMENTATIONS (Must Complete)

### 🚨 **HIGH PRIORITY**

#### `/fluffy-viz/src/lib/ai-inference.ts`
**Status**: Mock implementation only
**What's needed**: Real API integration with all providers

**Current state**:
- Returns placeholder text: `[AI Generated: ${model.name}]`
- Simulates 1-second delay
- No actual API calls

**Required changes**:
- Implement OpenAI SDK integration
- Implement Anthropic SDK integration
- Implement Groq API integration
- Implement Together AI API integration
- Implement Novita AI API integration
- Implement Cohere API integration
- Add API key management
- Add streaming support
- Implement retry logic with exponential backoff
- Add proper error handling and error types
- Implement rate limiting and quota management
- Support different provider API formats

**Effort**: LARGE (2-3 weeks)
**Dependencies**: API key management, environment configuration, error handling infrastructure

---

#### `/fluffy-viz/src/components/ai-provider-config-demo.tsx`
**Status**: Demo component with no backend
**What's needed**: API key storage and management

**Current state**:
- Has UI for API key input
- No actual storage or encryption
- Currently only used in style guide page

**Required changes**:
- Implement secure API key storage (encrypted localStorage or environment variables)
- Add validation for API keys
- Implement connection testing per provider
- Add key rotation functionality
- Move from demo to production component

**Effort**: MEDIUM (1 week)
**Dependencies**: ai-inference.ts implementation

---

#### Environment Configuration Files
**Status**: Missing
**What's needed**: `.env` configuration for API keys

**Current state**:
- No `.env.local` or `.env.example` files found
- API keys would need to be hardcoded

**Required changes**:
- Create `.env.example` with all required variables:
  ```
  OPENAI_API_KEY=
  ANTHROPIC_API_KEY=
  GROQ_API_KEY=
  TOGETHER_API_KEY=
  NOVITA_API_KEY=
  COHERE_API_KEY=
  ```
- Add `.env.local` to `.gitignore` (verify)
- Add environment variable validation on app startup
- Document required variables in README

**Effort**: SMALL (1-2 hours)
**Dependencies**: None

---

### 🟡 **MEDIUM PRIORITY**

#### Export to Embedding Atlas
**Status**: Not implemented
**What's needed**: Complete export functionality

**Current state**:
- Mentioned in project overview at `/ProjectDetails/FluffyVizOverview.md`
- No implementation found in codebase
- SpreadsheetEditor has basic export (CSV/JSON) but not Atlas format

**Required changes**:
- Research Embedding Atlas input format requirements
- Create export handler that formats data for Embedding Atlas
- Add export button/action to SpreadsheetEditor toolbar
- Implement data transformation to Atlas format
- Add embeddings generation if required by Atlas
- Add export progress indication for large datasets

**Effort**: LARGE (2 weeks)
**Dependencies**: Need to research Embedding Atlas API/format specification

---

## 2. TECHNICAL DEBT (Refactor/Improve)

### 🚨 **HIGH PRIORITY**

#### Overlap: `/fluffy-viz/src/lib/data-processor.ts` + `/fluffy-viz/src/lib/format-parser.ts`
**Status**: Code duplication and unclear separation
**What's needed**: Refactor to eliminate overlap

**Current issues**:
- Both files handle parsing for Langfuse, LangSmith, Arize formats
- `data-processor.ts`: Normalizes to `NormalizedAgentData`
- `format-parser.ts`: Flattens to generic `ParsedData`
- Different transformation approaches causing confusion
- Duplicate parsing logic

**Recommended refactor**:
- Keep `format-parser.ts` for low-level generic parsing/flattening
- Keep `data-processor.ts` for high-level agent-specific normalization
- Extract common parsing utilities to `lib/parsing-utils.ts`
- Clear separation: format-parser = generic, data-processor = domain-specific
- Add tests to ensure no regression

**Effort**: MEDIUM (1 week)
**Dependencies**: Comprehensive testing required

---

#### Network Error Handling
**Status**: Insufficient error handling
**What's needed**: Comprehensive error handling for all API calls

**Files affected**:
- `/fluffy-viz/src/lib/models.ts` - HuggingFace API calls
- `/fluffy-viz/src/lib/ai-inference.ts` - Future provider API calls
- `/fluffy-viz/src/components/enhanced-upload.tsx` - File processing errors

**Required changes**:
- Add user-friendly error messages (not just console.error)
- Implement retry logic for network failures
- Add offline mode/fallbacks where possible
- Create error boundary components for React errors
- Add toast notifications for errors (install a toast library like sonner)
- Implement proper error types/classes

**Effort**: MEDIUM (1 week)
**Dependencies**: None (but should be done before AI inference implementation)

---

### 🟡 **MEDIUM PRIORITY**

#### TypeScript `any` Usage
**Status**: 22 instances of `any` type found
**What's needed**: Replace with proper type definitions

**Files affected**:
- `/fluffy-viz/src/lib/ai-inference.ts`: `rows: any[]` parameter
- `/fluffy-viz/src/lib/data-processor.ts`: Multiple helper functions
- `/fluffy-viz/src/lib/format-parser.ts`: `obj: any` parameters
- `/fluffy-viz/src/components/spreadsheet/SpreadsheetEditor.tsx`: `[key: string]: any`
- `/fluffy-viz/src/types/agent-data.ts`: Various `any` in type definitions

**Recommended approach**:
- Define proper row data types (e.g., `SpreadsheetRow`, `AgentDataRow`)
- Use generic types where flexibility is needed: `flattenObject<T>(obj: T): Record<string, any>`
- Replace `any` with `unknown` where type is truly unknown, then narrow with type guards
- Add stricter TypeScript config if not already enabled

**Effort**: MEDIUM (3-4 days)
**Dependencies**: None

---

#### Console.log Cleanup
**Status**: 36 console statements found
**What's needed**: Remove debug logs, keep strategic error logs

**Files affected**: Nearly all major components and lib files

**Recommended approach**:
- Remove all development `console.log()` statements
- Keep strategic `console.error()` for production debugging
- Consider adding a logger service (e.g., `lib/logger.ts`) for production
- Add ESLint rule to prevent future console.log additions

**Effort**: SMALL (2-3 hours)
**Dependencies**: None

---

#### Model Selection API Improvements
**Status**: Basic implementation, needs enhancement
**What's needed**: Caching, offline fallback, better error handling

**File**: `/fluffy-viz/src/lib/models.ts`

**Current issues**:
- No caching of HuggingFace model list
- No offline fallback (recommended models only)
- API errors just log to console
- Every search hits the API (could be rate-limited)

**Required changes**:
- Add localStorage caching for model list (expire after 24 hours)
- Implement offline fallback to RECOMMENDED_MODELS
- Add retry logic for HF API failures
- Show user-friendly error messages
- Consider pre-fetching popular models on app load

**Effort**: SMALL (2-3 days)
**Dependencies**: None

---

### 🔵 **LOW PRIORITY**

#### Hardcoded API URLs
**Status**: URLs hardcoded in code
**What's needed**: Move to configuration

**Files affected**:
- `/fluffy-viz/src/lib/providers.ts` - Provider API URLs
- `/fluffy-viz/src/lib/models.ts` - HuggingFace API URL

**Current hardcoded values**:
```typescript
const HUGGINGFACE_API_BASE = 'https://huggingface.co/api'
// Provider URLs for Groq, Together AI, Novita, OpenAI, Anthropic, Cohere
```

**Recommended change**:
- Move to environment variables or `config/api.ts`
- Allows easier switching between dev/staging/prod endpoints
- Enables testing with mock API servers

**Effort**: SMALL (1-2 hours)
**Dependencies**: None

---

## 3. PERFORMANCE ISSUES (Optimize)

### 🟡 **MEDIUM PRIORITY**

#### Large File Handling
**Status**: No chunking/streaming for large datasets
**What's needed**: Performance optimizations for 10k+ row files

**Current issues**:
- Parser reads entire file into memory
- No progress indication for large file parsing
- AI generation processes rows sequentially (blocking UI)
- SpreadsheetTable renders all rows (no virtualization)

**Recommended improvements**:
- Implement streaming parser for JSONL files
- Add Web Workers for parsing (offload from main thread)
- Add batch processing with parallelization for AI generation
- Show progress bars for operations >5 seconds
- Implement virtual scrolling for SpreadsheetTable (react-window or similar)
- Add pagination option for very large datasets

**Files affected**:
- `/fluffy-viz/src/lib/format-parser.ts`
- `/fluffy-viz/src/components/spreadsheet/SpreadsheetEditor.tsx`
- `/fluffy-viz/src/components/spreadsheet/SpreadsheetTable.tsx`

**Effort**: LARGE (2 weeks)
**Dependencies**: None

---

### 🔵 **LOW PRIORITY**

#### Memory Leak Risk - Parser Cache
**Status**: Unbounded cache growth potential
**What's needed**: Memory monitoring and limits

**File**: `/fluffy-viz/src/lib/format-parser.ts`

**Issue**:
- Memoization cache (`flattenCache`) with LRU eviction at 100 items
- For large files with many unique objects, cache could grow large
- No memory monitoring

**Recommended change**:
- Add configurable cache size (environment variable)
- Add memory usage monitoring
- Clear cache when file storage changes
- Consider WeakMap for automatic garbage collection

**Effort**: SMALL (1 day)
**Dependencies**: None

---

#### React Component Re-renders
**Status**: Some inefficient hook usage
**What's needed**: Optimization with useMemo/useCallback

**Files affected**:
- `/fluffy-viz/src/components/spreadsheet/SpreadsheetEditor.tsx` - Regenerates column references on every render
- `/fluffy-viz/src/components/spreadsheet/AddColumnModal.tsx` - Effect dependencies could be optimized

**Recommended changes**:
- Wrap expensive computations in `useMemo`
- Wrap callback functions passed to children in `useCallback`
- Use React DevTools Profiler to identify hot spots
- Add performance monitoring (React Profiler API)

**Effort**: SMALL (2-3 days)
**Dependencies**: None

---

## 4. TESTING INFRASTRUCTURE (Add Tests)

### 🟡 **MEDIUM PRIORITY**

#### Test Coverage Gaps
**Status**: Only 2 test files, minimal coverage
**What's needed**: Comprehensive test suite

**Current tests**:
- ✅ `/fluffy-viz/src/lib/__tests__/format-parser.test.ts`
- ✅ `/fluffy-viz/src/hooks/__tests__/use-file-storage.test.ts`

**Missing tests**:
- ❌ Integration tests for AI generation flow
- ❌ Unit tests for all parsers (Langfuse, LangSmith, Arize, Message-Centric, Turn-Level)
- ❌ Component tests for SpreadsheetEditor, AddColumnModal
- ❌ E2E tests for upload → augment → export workflow
- ❌ Mock API responses for provider testing
- ❌ Error handling tests
- ❌ Edge case tests (empty files, malformed JSON, huge files)

**Recommended approach**:
- Add Jest tests for all lib functions
- Add React Testing Library tests for components
- Add Playwright/Cypress E2E tests for critical paths
- Aim for 80%+ code coverage on critical paths

**Effort**: LARGE (2-3 weeks)
**Dependencies**: None, but should be ongoing

---

## 5. UI/UX ENHANCEMENTS (Polish)

### 🔵 **LOW PRIORITY**

#### Prompt Editor Enhancement
**Status**: Basic textarea, missing advanced features
**What's needed**: Autocomplete and validation

**File**: `/fluffy-viz/src/components/spreadsheet/AddColumnModal.tsx`

**Current state**:
- Simple textarea for prompt input
- No column reference autocomplete
- No syntax highlighting

**Missing features** (based on screenshots in `.playwright-mcp/`):
- Column reference autocomplete with `@` trigger (e.g., `@user_input`)
- Syntax highlighting for `{{column}}` template variables
- Template variable validation (warn if column doesn't exist)
- Preview of interpolated prompt with sample row data
- Multi-line prompt support with better formatting

**Recommended implementation**:
- Use a rich text editor (e.g., Draft.js, Slate, or custom ContentEditable)
- Add autocomplete dropdown triggered by `@` or `{{`
- Add real-time validation
- Show preview panel with sample interpolation

**Effort**: MEDIUM (1 week)
**Dependencies**: None

---

## 6. DOCUMENTATION (Add Guides)

### 🟡 **MEDIUM PRIORITY**

#### Missing Documentation Files
**Status**: Minimal documentation
**What's needed**: Comprehensive guides

**Currently missing**:
- ❌ README.md at root (or it's minimal)
- ❌ API documentation for providers
- ❌ CONTRIBUTING.md
- ❌ Setup/installation instructions
- ❌ Environment variable documentation
- ❌ Architecture decision records (ADRs)
- ❌ User guide / How-to docs
- ❌ Troubleshooting guide

**Recommended additions**:
- README.md with quick start, features, tech stack
- CONTRIBUTING.md with development setup, code style, PR process
- docs/SETUP.md with detailed installation instructions
- docs/API.md documenting all provider integrations
- docs/ARCHITECTURE.md explaining design decisions
- docs/TROUBLESHOOTING.md for common issues

**Effort**: MEDIUM (1 week)
**Dependencies**: None

---

## PRIORITIZED ROADMAP

### 🚨 **Sprint 1: Core Functionality (Week 1-2)**
**Goal**: Make AI inference actually work

1. **Environment Configuration** - Setup .env files (2 hours)
2. **API Key Management** - Secure storage and validation (1 week)
3. **AI Inference Implementation** - Real API integration (2 weeks)
4. **Error Handling** - Network and API errors (1 week)

**Deliverable**: Users can generate AI columns with real AI models

---

### 🟡 **Sprint 2: Stability & Quality (Week 3-4)**
**Goal**: Fix technical debt and improve reliability

5. **Data Processor Refactor** - Eliminate duplication (1 week)
6. **TypeScript Typing** - Replace `any` types (4 days)
7. **Testing Infrastructure** - Add critical tests (ongoing)
8. **Console.log Cleanup** - Remove debug statements (3 hours)

**Deliverable**: Cleaner codebase, better type safety, basic test coverage

---

### 🔵 **Sprint 3: Performance & UX (Week 5-6)**
**Goal**: Handle large datasets and improve user experience

9. **Performance Optimization** - Large file handling with Web Workers (2 weeks)
10. **Model API Improvements** - Caching and offline fallback (3 days)
11. **Export to Embedding Atlas** - Complete integration (2 weeks)
12. **Documentation** - Add guides and API docs (1 week)

**Deliverable**: Fast performance with 100k+ rows, export to Atlas works

---

### 💎 **Sprint 4: Polish (Week 7-8)**
**Goal**: UI/UX improvements and final touches

13. **Prompt Editor UX** - Autocomplete and validation (1 week)
14. **Component Optimization** - Reduce re-renders (3 days)
15. **Config Externalization** - Move hardcoded URLs (2 hours)
16. **Memory Monitoring** - Cache optimization (1 day)

**Deliverable**: Production-ready application

---

## CRITICAL PATH

```
Environment Config → API Keys → AI Inference → Error Handling
                                      ↓
                               Testing (parallel)
                                      ↓
                            Performance + Export
                                      ↓
                              Polish & Docs
```

---

## EFFORT SUMMARY

| Priority | Tasks | Total Effort |
|----------|-------|--------------|
| 🚨 HIGH  | 5     | 6-7 weeks    |
| 🟡 MEDIUM| 7     | 4-5 weeks    |
| 🔵 LOW   | 4     | 1-2 weeks    |
| **TOTAL**| **16**| **11-14 weeks** |

**Estimated Time to MVP** (High Priority Only): **6-7 weeks** with 1-2 developers

---

## FILES NOT REQUIRING CHANGES

The following files are well-implemented and don't need changes:

✅ `/fluffy-viz/src/app/layout.tsx` - Clean layout implementation
✅ `/fluffy-viz/src/app/page.tsx` - Well-structured home page
✅ `/fluffy-viz/src/app/edit/[fileId]/page.tsx` - Good dynamic routing
✅ `/fluffy-viz/src/components/enhanced-upload.tsx` - Solid upload logic
✅ `/fluffy-viz/src/components/app-sidebar.tsx` - Good sidebar implementation
✅ `/fluffy-viz/src/components/workflow-breadcrumb.tsx` - Simple and effective
✅ `/fluffy-viz/src/components/theme-toggle.tsx` - Clean theme switching
✅ `/fluffy-viz/src/components/spreadsheet/SpreadsheetTable.tsx` - Well-structured table
✅ `/fluffy-viz/src/components/spreadsheet/ModelSelector.tsx` - Good model search UI
✅ `/fluffy-viz/src/components/spreadsheet/ProviderSelector.tsx` - Clean provider UI
✅ `/fluffy-viz/src/hooks/use-file-storage.ts` - Excellent IndexedDB implementation
✅ `/fluffy-viz/src/hooks/use-mobile.ts` - Simple and effective
✅ `/fluffy-viz/src/lib/utils.ts` - Standard utility
✅ `/fluffy-viz/src/lib/format-detector.ts` - Good detection logic
✅ `/fluffy-viz/src/lib/providers.ts` - Clean provider config
✅ `/fluffy-viz/src/config/ai-column-templates.ts` - Well-structured templates
✅ `/fluffy-viz/src/config/parser.config.ts` - Simple config
✅ All UI components in `/fluffy-viz/src/components/ui/` - shadcn components are good
✅ All type files in `/fluffy-viz/src/types/` - Comprehensive types

---

**Last Updated**: October 5, 2025
**Next Review**: After Sprint 1 completion

# AI Column Retry & Few-Shot Learning Architecture

**Date:** November 9, 2025
**Feature:** AI Column Regeneration with Manual Edit Feedback Loop

## Overview

This architecture transforms AI column failure handling into an active learning feature. When users manually edit AI-generated cells, those edits become few-shot examples that improve subsequent generations. This creates a feedback loop where the AI learns from user corrections.

**Core Insight:** User edits are not just corrections—they're training data.

## Table of Contents

1. [Data Model](#data-model)
2. [Column Type System](#column-type-system)
3. [Few-Shot Sampling Strategy](#few-shot-sampling-strategy)
4. [DuckDB Storage Schema](#duckdb-storage-schema)
5. [Retry Modal UX](#retry-modal-ux)
6. [Model/Provider Change Flow](#modelprovider-change-flow)
7. [Filter Integration](#filter-integration)
8. [Error Handling](#error-handling)
9. [Data Flow](#data-flow)
10. [Component Architecture](#component-architecture)

---

## Data Model

### Column Metadata Structure

```typescript
type Column = {
  id: string                    // "ai_sentiment"
  name: string                  // "Sentiment Analysis"
  type: ColumnType              // "data" | "ai-generated" | "computed"

  // Only for AI-generated columns
  generatedBy?: {
    type: "ai-inference"
    model: string               // "gpt-4-turbo"
    provider: string            // "openai"
    prompt: string              // Original prompt with {{placeholders}}
    createdAt: number           // Timestamp
  }

  // Only for computed columns (conversational history, formulas)
  computedBy?: {
    type: "conversational-history" | "formula"
    config: any
  }
}
```

### Cell Metadata Structure

```typescript
type CellMetadata = {
  status: "pending" | "success" | "failed"
  error?: string                // Error message if failed
  errorType?: FailureType       // Classified error type
  edited: boolean               // User manually changed value
  originalValue?: string        // AI's value before user edit
  lastEditTime?: number         // Timestamp of most recent edit
}

type FailureType =
  | "rate_limit"      // 429 or rate limit in message
  | "network"         // Connection issues
  | "auth"            // 401/403 - invalid API key
  | "invalid_request" // 400 - bad prompt/params
  | "server_error"    // 500/503 - provider issues
```

### In-Memory Row Structure

```typescript
// How data looks in React state
type Row = {
  row_index: number
  user_input: string
  conversation_text: string
  ai_sentiment: string                    // Plain value: "positive"
  ai_sentiment__meta?: CellMetadata       // Metadata attached with __ suffix
}
```

**Why `__meta` suffix?**
- Clear separation between data and metadata
- Doesn't pollute data namespace
- Easy to strip when exporting CSV
- Consistent pattern for all AI columns

---

## Column Type System

### Three Column Types

| Type | Description | Has Cell Metadata | Retry/Recalculate | Examples |
|------|-------------|-------------------|-------------------|----------|
| **data** | User-uploaded columns | No | No | `user_input`, `timestamp`, `session_id` |
| **ai-generated** | Async LLM inference | Yes | Retry button | `ai_sentiment`, `ai_summary` |
| **computed** | Synchronous transformation | No | None (auto-recalculates) | `conversational_history` |

### Column Header UI Treatment

**AI-Generated Column:**
```
┌────────────────────────────────┐
│ [🤖] ai_sentiment [3 failed] [↻] │
└────────────────────────────────┘
```
- Robot icon
- Badge showing failed count (if any)
- Retry button (always visible)

**Computed Column:**
```
┌────────────────────────────────┐
│ conv_history                    │
└────────────────────────────────┘
```
- No icon, no retry button
- Deterministic—no need for manual retry

**Data Column:**
```
┌────────────────────────────────┐
│ user_input                      │
└────────────────────────────────┘
```
- Plain text, no special treatment

---

## Few-Shot Sampling Strategy

### Modular Sampling Functions

Located in `src/lib/few-shot-sampling.ts`:

```typescript
export type FewShotExample = {
  input: Record<string, any>  // Original row data
  output: string              // User's edited value
  rowIndex: number
  editedAt: number
}

export type SamplingStrategy = (
  examples: FewShotExample[],
  maxExamples: number
) => FewShotExample[]

/**
 * Random sampling - no bias, uniform selection
 * This is the initial implementation.
 */
export const randomSample: SamplingStrategy = (examples, maxExamples) => {
  if (examples.length <= maxExamples) {
    return examples
  }

  const shuffled = [...examples].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, maxExamples)
}

// Export default strategy (can swap easily later)
export const selectFewShotExamples = randomSample
```

### Future Enhancement Ideas

**Add to `few-shot-sampling.ts` as comments:**

```typescript
/**
 * Future enhancement ideas for sampling strategies:
 *
 * 1. diversitySample()
 *    - Pick examples with different output values
 *    - Ensures variety in few-shot examples
 *    - Good for classification tasks with multiple classes
 *
 * 2. errorWeightedSample()
 *    - Prioritize edits where AI was most wrong
 *    - Uses edit distance or semantic similarity
 *    - Focuses on correcting specific failure modes
 *
 * 3. recentBiasSample()
 *    - Weight recent edits higher using exponential decay
 *    - Reflects user's latest thinking/preferences
 *    - Good for evolving labeling criteria
 *
 * 4. clusterSample()
 *    - Representative sampling from edit clusters
 *    - Groups similar edits, picks 1-2 from each cluster
 *    - Balances coverage and diversity
 *
 * 5. semanticSample()
 *    - Embedding-based diversity sampling
 *    - Requires computing embeddings for inputs
 *    - Maximizes semantic diversity in examples
 */
```

### Extensibility Pattern

```typescript
// Easy to swap strategies later
import { diversitySample } from '@/lib/few-shot-sampling'

const examples = diversitySample(editedCells, 10)
```

### Default Configuration

- **Max examples:** 10 (balances context vs. prompt size)
- **Selection:** Random (uniform probability)
- **Sorting:** By `lastEditTime DESC` before sampling (most recent first)

---

## DuckDB Storage Schema

### Three Tables

#### 1. Main Data Table (per file)

```sql
CREATE TABLE file_abc (
  row_index INTEGER PRIMARY KEY,
  user_input TEXT,
  conversation_text TEXT,
  ai_sentiment TEXT,        -- Plain value: "positive"
  ai_summary TEXT           -- Plain value: "User is happy..."
)
```

**Characteristics:**
- Clean, queryable values (no JSON)
- Can index on values
- Standard SQL operations
- One table per uploaded file

#### 2. Column Metadata Table

```sql
CREATE TABLE column_metadata (
  file_id TEXT,
  column_id TEXT,
  column_type TEXT,         -- "data" | "ai-generated" | "computed"

  -- AI generation config (NULL for non-AI columns)
  model TEXT,               -- "gpt-4-turbo"
  provider TEXT,            -- "openai"
  prompt TEXT,              -- "Classify the sentiment of {{conversation_text}}"
  created_at INTEGER,       -- Unix timestamp

  PRIMARY KEY (file_id, column_id)
)
```

**Purpose:**
- Stores column-level metadata
- Identifies AI vs. data vs. computed columns
- Preserves generation configuration for retry

#### 3. Cell Metadata Table

```sql
CREATE TABLE cell_metadata (
  file_id TEXT,
  column_id TEXT,
  row_index INTEGER,

  status TEXT,              -- "pending" | "success" | "failed"
  error TEXT,               -- Error message if failed
  error_type TEXT,          -- "rate_limit" | "network" | "auth" | etc.
  edited BOOLEAN,           -- User manually changed the value
  original_value TEXT,      -- AI's value before user edit
  last_edit_time INTEGER,   -- Timestamp of most recent edit

  PRIMARY KEY (file_id, column_id, row_index)
)
```

**Characteristics:**
- Sparse table (only for AI-generated columns)
- Only rows with special status (failed, edited, pending)
- Enables querying: "Find all failed cells in file X"

### Why Separate Tables?

**Advantages:**
1. **Clean data model** - Main table stays normalized
2. **Queryable** - Can run SQL filters on status/errors
3. **Sparse storage** - Metadata only exists where needed
4. **Future-proof** - Easier to add server-side features

**Trade-offs:**
- More complex reads (requires JOIN)
- More writes (2-3 tables per operation)
- Worth it for data cleanliness

### Data Loading Pattern

```typescript
const loadFileData = async (fileId: string) => {
  // 1. Get all data rows
  const rows = await db.query(
    "SELECT * FROM ?? ORDER BY row_index",
    [getTableName(fileId)]
  )

  // 2. Get column metadata
  const columns = await db.query(
    "SELECT * FROM column_metadata WHERE file_id = ?",
    [fileId]
  )

  // 3. Get cell metadata (for AI columns only)
  const cellMeta = await db.query(`
    SELECT column_id, row_index, status, error, error_type, edited,
           original_value, last_edit_time
    FROM cell_metadata
    WHERE file_id = ?
  `, [fileId])

  // 4. Build cell metadata map for fast lookup
  const cellMetaMap = new Map<string, CellMetadata>()
  cellMeta.forEach(meta => {
    const key = `${meta.column_id}:${meta.row_index}`
    cellMetaMap.set(key, meta)
  })

  // 5. Enrich rows with metadata
  const enrichedRows = rows.map(row => {
    const enriched = { ...row }

    columns.forEach(col => {
      if (col.column_type === 'ai-generated') {
        const key = `${col.column_id}:${row.row_index}`
        const meta = cellMetaMap.get(key)

        if (meta) {
          enriched[`${col.column_id}__meta`] = meta
        }
      }
    })

    return enriched
  })

  return { rows: enrichedRows, columns }
}
```

---

## Retry Modal UX

### Modal Layout

```
┌───────────────────────────────────────────────────────┐
│ Regenerate Column: ai_sentiment                       │
│                                              [✕ Close] │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Current model: GPT-4 Turbo (OpenAI)                   │
│ [Change Model/Provider]                               │
│                                                       │
│ Status:                                               │
│ • 3 cells failed (2 rate limits, 1 network error)    │
│ • 5 cells manually edited                            │
│ • 992 cells succeeded                                │
│                                                       │
│ ☑️ Include manual edits as examples                   │
│    5 edits will be used to improve generation         │
│                                                       │
│    Preview:                                           │
│    • Row 23: "positive" → "neutral"                   │
│    • Row 104: "negative" → "mixed"                    │
│    • Row 507: "positive" → "sarcastic"                │
│    ... and 2 more                                     │
│                                                       │
│ Regenerate scope:                                     │
│ ○ Only failed cells (3 cells)                         │
│ ○ Failed + edited cells (8 cells)                     │
│ ○ Entire column (1,000 cells)                         │
│                                                       │
│ [Cancel]  [Regenerate]                                │
└───────────────────────────────────────────────────────┘
```

### Three Key Decisions

1. **Include examples** (checkbox, default: ON)
   - Uses manual edits as few-shot examples
   - Recommended for improving quality

2. **Scope** (radio buttons, default: "Only failed")
   - Only failed cells
   - Failed + edited cells
   - Entire column

3. **Action** (button)
   - "Regenerate" or "Regenerate with [Model Name]"

### Few-Shot Preview

**Show first 3 examples + count:**
```
Preview:
• Row 23: "positive" → "neutral"
• Row 104: "negative" → "mixed"
• Row 507: "positive" → "sarcastic"
... and 2 more
```

**If >10 edits:**
```
Preview:
• Row 23: "positive" → "neutral"
• Row 104: "negative" → "mixed"
• Row 507: "positive" → "sarcastic"
... and 12 more (10 will be randomly selected)
```

---

## Model/Provider Change Flow

### Triggering Model Change

User clicks **"Change Model/Provider"** button in retry modal:

1. Opens familiar model/provider selector (reuse `ModelSelector` + `ProviderSelector` from `AddColumnModal`)
2. User selects new model (e.g., Claude Opus)
3. Modal updates to show warning and force scope

### Updated Modal with Model Change

```
┌───────────────────────────────────────────────────────┐
│ Regenerate Column: ai_sentiment                       │
├───────────────────────────────────────────────────────┤
│                                                       │
│ Current model: GPT-4 Turbo (OpenAI)                   │
│ New model: Claude 3 Opus (Anthropic)                  │
│ [Change Model/Provider]                               │
│                                                       │
│ ⚠️ Changing model will regenerate the entire column   │
│    All 1,000 cells will be reprocessed to maintain    │
│    consistency (no mixed model provenance)            │
│                                                       │
│ ☑️ Include manual edits as examples                   │
│    5 edits will be used to improve generation         │
│                                                       │
│    Preview:                                           │
│    • Row 23: "positive" → "neutral"                   │
│    • Row 104: "negative" → "mixed"                    │
│    • Row 507: "positive" → "sarcastic"                │
│    ... and 2 more                                     │
│                                                       │
│ Regenerate scope:                                     │
│ ● Entire column (1,000 cells)  ← Forced, grayed out  │
│                                                       │
│ [Cancel]  [Regenerate with Claude Opus]               │
└───────────────────────────────────────────────────────┘
```

### Behavioral Changes When Model Changed

| Element | Normal State | Model Changed State |
|---------|--------------|---------------------|
| Model display | Shows current only | Shows "Current → New" |
| Warning callout | Hidden | Shown (explains full regeneration) |
| Scope radio buttons | All enabled | All disabled except "Entire column" |
| Regenerate button | "Regenerate" | "Regenerate with [Model Name]" |

### Enforcement Logic

```typescript
const [newModel, setNewModel] = useState<Model | null>(null)

const scopeOptions = useMemo(() => {
  if (newModel) {
    // Model changed - force entire column
    return [
      { value: 'all', label: 'Entire column', disabled: false, selected: true }
    ]
  } else {
    // Normal - allow all scopes
    return [
      { value: 'failed', label: 'Only failed cells', disabled: false, selected: true },
      { value: 'failed-edited', label: 'Failed + edited cells', disabled: false },
      { value: 'all', label: 'Entire column', disabled: false }
    ]
  }
}, [newModel])
```

### After Regeneration

```typescript
const handleRegenerate = async () => {
  if (newModel) {
    // Update column metadata with new model
    await db.query(`
      UPDATE column_metadata
      SET model = ?, provider = ?
      WHERE file_id = ? AND column_id = ?
    `, [newModel.name, newProvider.id, fileId, columnId])

    // Clear all cell metadata (fresh start)
    await db.query(`
      DELETE FROM cell_metadata
      WHERE file_id = ? AND column_id = ?
    `, [fileId, columnId])
  }

  // Proceed with regeneration
  await retryFailedCells(fileId, columnId, scope, includeFewShot)
}
```

### Rationale: No Mixed Provenance

**Why force entire column regeneration?**

1. **Consistency** - All cells generated by same model
2. **Reproducibility** - Column metadata accurately reflects generation
3. **User expectation** - Changing model implies "try a different approach"
4. **Avoid confusion** - No "997 GPT-4 + 3 Claude" situations

**Alternative approach (rejected):**
- Allow partial regeneration with different model
- Track model per cell in `cell_metadata`
- Column header shows: "Generated by GPT-4 (95%) and Claude (5%)"
- **Reason for rejection:** Too complex, confusing mental model

---

## Filter Integration

### Challenge

User applies filter (e.g., `ai_sentiment = "positive"`), but some failed cells are hidden by filter. What happens when they retry?

### Solution: Retry All, Notify About Hidden

**Flow:**

1. User applies filter → 200 rows visible
2. Column header still shows "3 failed" badge (knows about hidden failures)
3. User clicks retry button
4. Modal opens showing all 3 failed cells (even hidden ones)
5. User configures and clicks "Regenerate"

### Toast Notifications

**During retry (info toast):**
```
ℹ️ Retrying 3 cells (2 hidden by current filter)
```

**After success (success toast with action):**
```
✓ 3 cells regenerated. Clear filter to view 2 updated cells.
  [Clear Filter]
```

**If all visible (simpler):**
```
ℹ️ Retrying 3 cells
✓ 3 cells regenerated
```

### Implementation

```typescript
const handleRetry = async () => {
  // Get all failed cells (ignores filters)
  const allFailedCells = data.filter(row =>
    row[`${columnId}__meta`]?.status === 'failed'
  )

  // Get visible failed cells (respects filters)
  const visibleFailedCells = filteredData.filter(row =>
    row[`${columnId}__meta`]?.status === 'failed'
  )

  const hiddenCount = allFailedCells.length - visibleFailedCells.length

  // Show toast immediately
  if (hiddenCount > 0) {
    toast.info(
      `Retrying ${allFailedCells.length} cells (${hiddenCount} hidden by current filter)`
    )
  } else {
    toast.info(`Retrying ${allFailedCells.length} cells`)
  }

  // Perform retry (works on ALL failed cells, even hidden)
  await retryFailedCells(fileId, columnId, scope, includeFewShot)

  // After completion
  if (hiddenCount > 0) {
    toast.success(
      `${allFailedCells.length} cells regenerated. Clear filter to view ${hiddenCount} updated cells.`,
      {
        action: {
          label: "Clear Filter",
          onClick: () => clearAllFilters()
        }
      }
    )
  } else {
    toast.success(`${allFailedCells.length} cells regenerated`)
  }
}
```

### Key Insight

Database operations work on **full dataset**, UI filtering is just a **view layer**.

---

## Error Handling

### No Auto-Retry

**Philosophy:** All retries are user-initiated.

- No background timers
- No automatic retry loops
- No exponential backoff workers

**User must:**
- Click retry button on column header
- Click "Resume generation" banner (if page reloaded with pending cells)

### Error Classification

```typescript
type FailureType =
  | 'rate_limit'      // Show clock icon, suggest waiting
  | 'network'         // Show wifi icon, suggest retry
  | 'auth'            // Show key icon, link to settings
  | 'invalid_request' // Show warning icon, show full error
  | 'server_error'    // Show alert icon, suggest retry

const classifyError = (error: any): FailureType => {
  // Dual detection: HTTP status + fuzzy string match
  if (error.status === 429 || /rate limit|quota exceeded|rpm exceeded/i.test(error.message)) {
    return 'rate_limit'
  }
  if (error.status === 401 || error.status === 403) {
    return 'auth'
  }
  if (error.status >= 500) {
    return 'server_error'
  }
  if (!navigator.onLine || /network/i.test(error.message)) {
    return 'network'
  }
  return 'invalid_request'
}
```

### Rate Limit Detection Strategy

**Dual approach:**

1. **HTTP status code** (most reliable)
   - Check for `error.status === 429`

2. **Fuzzy string match** on error message
   - Keywords: `"rate limit"`, `"too many requests"`, `"quota exceeded"`, `"rpm exceeded"`
   - Handles poorly designed APIs that return 200 with error in body

### Error Icons by Type

| Error Type | Icon | Message | User Action |
|------------|------|---------|-------------|
| `rate_limit` | ⏱️ Clock | "Rate limited" | Wait 60s, or change provider |
| `network` | 📡 WifiOff | "Network error" | Check connection, retry |
| `auth` | 🔑 Key | "Invalid API key" | Update settings |
| `invalid_request` | ⚠️ AlertCircle | Full error message | Fix prompt/params |
| `server_error` | 🔥 ServerCrash | "Server error" | Retry or change provider |

### Cell Rendering by Status

```typescript
const AiCell = ({ value, metadata }: AiCellProps) => {
  if (!metadata) {
    return <span>{value}</span>
  }

  if (metadata.status === 'pending') {
    return <Spinner />
  }

  if (metadata.status === 'failed') {
    const Icon = getErrorIcon(metadata.errorType)
    return (
      <div className="flex items-center gap-1">
        <Icon className="h-4 w-4 text-destructive" />
        <Tooltip content={metadata.error}>
          <span className="truncate">{metadata.error}</span>
        </Tooltip>
      </div>
    )
  }

  // Success (with optional edit indicator)
  return (
    <div className="flex items-center gap-1">
      <span>{value}</span>
      {metadata.edited && (
        <Tooltip content={`Edited from: "${metadata.originalValue}"`}>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Tooltip>
      )}
    </div>
  )
}
```

---

## Data Flow

### Creating AI Column

```
1. User fills AddColumnModal
   ↓
2. Selects model, provider, prompt
   ↓
3. SpreadsheetEditor.addColumn() called
   ↓
4. DuckDB writes:
   - ALTER TABLE file_abc ADD COLUMN ai_sentiment TEXT
   - INSERT INTO column_metadata (model, provider, prompt, ...)
   - INSERT INTO cell_metadata (status='pending' for all rows)
   ↓
5. React state updated with pending cells
   ↓
6. generateColumnData() processes each row
   ↓
7. For each row:
   - Call AI API with prompt + row data
   - If success:
     * UPDATE file_abc SET ai_sentiment = 'positive' WHERE row_index = X
     * UPDATE cell_metadata SET status='success' WHERE ...
   - If failure:
     * UPDATE cell_metadata SET status='failed', error='...', error_type='...'
   ↓
8. React state updated per cell
   - Loading spinner → value (success) or error icon (failed)
```

### Editing Cell

```
1. User edits cell value in table
   ↓
2. updateCellValue(rowIndex, columnId, newValue) called
   ↓
3. DuckDB writes:
   - UPDATE file_abc SET ai_sentiment = 'neutral' WHERE row_index = 23
   - UPDATE cell_metadata SET
       edited = true,
       last_edit_time = NOW(),
       original_value = 'positive'
     WHERE row_index = 23
   ↓
4. React state updated
   ↓
5. Column header badge updates (now shows "5 edited")
```

### Retrying Failed Cells

```
1. User clicks retry button on column header
   ↓
2. RetryModal opens:
   - Query cell_metadata for failed/edited counts
   - Show stats, few-shot toggle, scope options
   ↓
3. User configures:
   - Include examples: YES
   - Scope: Failed + edited cells
   - Clicks "Regenerate"
   ↓
4. Toast notification: "Retrying 3 cells (2 hidden by filter)"
   ↓
5. For each target cell:
   - UPDATE cell_metadata SET status='pending'
   - React state updated (show spinner)
   - Call AI API with few-shot examples in prompt
   - If success:
     * UPDATE file_abc SET ai_sentiment = 'new value'
     * UPDATE cell_metadata SET status='success', error=NULL
   - If failure:
     * UPDATE cell_metadata SET status='failed', error='...'
   - React state updated (show value or error)
   ↓
6. Toast notification: "3 cells regenerated. Clear filter to view 2 updated cells."
```

### Changing Model

```
1. User clicks "Change Model/Provider" in RetryModal
   ↓
2. ModelSelector opens (same component as AddColumnModal)
   ↓
3. User selects Claude Opus
   ↓
4. RetryModal updates:
   - Shows current → new model
   - Warning callout about full regeneration
   - Forces scope to "Entire column"
   - Button becomes "Regenerate with Claude Opus"
   ↓
5. User clicks "Regenerate with Claude Opus"
   ↓
6. DuckDB writes:
   - UPDATE column_metadata SET model='claude-opus', provider='anthropic'
   - DELETE FROM cell_metadata WHERE file_id=X AND column_id=Y
   - INSERT INTO cell_metadata (status='pending' for ALL rows)
   ↓
7. Regenerate all 1,000 cells (same flow as initial generation)
   ↓
8. All cells now have consistent provenance from Claude Opus
```

---

## Component Architecture

### Component Hierarchy

```
SpreadsheetEditor
├── SpreadsheetTable (dumb renderer)
│   ├── ColumnHeader
│   │   ├── Badge (failed/pending count)
│   │   └── RetryButton
│   └── TableBody
│       └── AiCell (status-aware rendering)
│           ├── Spinner (pending)
│           ├── ErrorDisplay (failed)
│           └── ValueDisplay (success + edit indicator)
├── RetryModal
│   ├── ModelSelector (reused from AddColumnModal)
│   ├── ProviderSelector (reused from AddColumnModal)
│   ├── FewShotPreview
│   └── ScopeSelector
└── ResumeGenerationBanner (shown if pending cells exist)
```

### State Management

```typescript
// SpreadsheetEditor.tsx
const [data, setData] = useState<Row[]>([])                    // Full dataset
const [columns, setColumns] = useState<Column[]>([])           // With metadata
const [filteredData, setFilteredData] = useState<Row[]>([])    // For display
const [isRetryModalOpen, setIsRetryModalOpen] = useState(false)
const [selectedColumn, setSelectedColumn] = useState<Column | null>(null)

// Column statistics (for badges)
const columnStats = useMemo(() => {
  return columns.reduce((acc, col) => {
    if (col.type !== 'ai-generated') return acc

    const failed = data.filter(row =>
      row[`${col.id}__meta`]?.status === 'failed'
    ).length

    const edited = data.filter(row =>
      row[`${col.id}__meta`]?.edited === true
    ).length

    const pending = data.filter(row =>
      row[`${col.id}__meta`]?.status === 'pending'
    ).length

    acc[col.id] = { failed, edited, pending }
    return acc
  }, {} as Record<string, ColumnStats>)
}, [data, columns])
```

### Component Responsibilities

**`<SpreadsheetTable>`**
- Receives `filteredData` (not full `data`)
- Renders `<AiCell>` for AI columns based on `column.type`
- No retry logic, just visual states

**`<AiCell>`**
- Renders based on `metadata.status`
- Shows appropriate icon for error type
- Edit indicator if `metadata.edited === true`
- Tooltip with full error message or original value

**`<ColumnHeader>`**
- Shows column name
- Badges for pending/failed counts (from `columnStats`)
- Retry button (only for AI-generated columns)
- Opens `RetryModal` on click

**`<RetryModal>`**
- Fetches edited cells from database
- Builds few-shot preview (first 3 + count)
- Model/provider selector (reused components)
- Scope selection with smart defaults
- Triggers regeneration
- Shows toast notifications

**`<ResumeGenerationBanner>`**
- Shown on mount if any cells have `status === 'pending'`
- Actions: Resume, Clear pending state, Dismiss banner

---

## Implementation Phases

### Phase 1: Data Structure (Foundation)

1. Create DuckDB tables:
   - `column_metadata`
   - `cell_metadata`

2. Update TypeScript types:
   - `Column` with `generatedBy` / `computedBy`
   - `CellMetadata` type
   - `FailureType` enum

3. Migration utilities:
   - Convert existing AI columns to new format
   - Backfill `column_metadata` table

4. Update data loading logic to JOIN tables and enrich rows

**Files to modify:**
- `src/lib/duckdb.ts` - Schema creation
- `src/types/agent-data.ts` - Type definitions
- `src/hooks/use-file-storage.ts` - Data loading

### Phase 2: UI Components

1. `<AiCell>` component
   - Pending state (spinner)
   - Success state (value + edit indicator)
   - Failed state (error icon + tooltip)

2. `<ColumnHeader>` enhancements
   - Badge for failed/pending counts
   - Retry button (AI columns only)

3. Column type identification
   - Mark existing AI columns in state
   - Visual distinction in headers

**Files to create:**
- `src/components/spreadsheet/AiCell.tsx`

**Files to modify:**
- `src/components/spreadsheet/SpreadsheetTable.tsx`
- `src/components/spreadsheet/SpreadsheetEditor.tsx`

### Phase 3: Retry Logic

1. Few-shot sampling utilities
   - `src/lib/few-shot-sampling.ts`
   - `randomSample()` implementation
   - Comments for future strategies

2. `<RetryModal>` component
   - Status display
   - Few-shot toggle + preview
   - Scope selection
   - Model/provider change integration

3. Retry orchestration
   - Query failed/edited cells
   - Build few-shot prompt
   - Partial regeneration (only selected rows)
   - Update cell metadata

**Files to create:**
- `src/lib/few-shot-sampling.ts`
- `src/components/spreadsheet/RetryModal.tsx`

**Files to modify:**
- `src/lib/ai-inference.ts` - Accept few-shot examples
- `src/components/spreadsheet/SpreadsheetEditor.tsx` - Retry handlers

### Phase 4: Advanced Features

1. Error classification
   - Rate limit detection (status + fuzzy match)
   - Error type storage in `cell_metadata`

2. Filter integration
   - Toast notifications for hidden cells
   - Clear filter action button

3. Model change flow
   - Force entire column regeneration
   - Update column metadata
   - Prevent mixed provenance

4. Resume generation banner
   - Detect pending cells on mount
   - Resume/Clear/Dismiss actions

**Files to modify:**
- `src/lib/ai-inference.ts` - Error classification
- `src/components/spreadsheet/SpreadsheetEditor.tsx` - Model change, filter notifications
- `src/components/ResumeGenerationBanner.tsx` (new)

---

## Open Questions

### 1. Few-Shot Prompt Injection

**How to inject examples into user's prompt?**

**Approach: Prepend to user prompt**
```
Original prompt: "Classify the sentiment of {{conversation_text}}"

With examples:
"""
Here are some examples of how to classify sentiment:

Example 1:
Input: "Great job, really appreciate the help!"
Output: neutral

Example 2:
Input: "This is terrible and I hate it"
Output: mixed

Example 3:
Input: "Oh wonderful, another bug"
Output: sarcastic

Now classify the sentiment of the following:
{{conversation_text}}
"""
```

**Rationale:**
- Works with all providers (doesn't require system message support)
- Clear separation between examples and task
- User can see exactly what prompt was used

### 2. Few-Shot Preview - Show All or Truncate?

**Options:**

A) **Collapsed** (show count only)
```
☑️ Include manual edits as examples
   5 edits will be used
   [Show examples ▼]
```

B) **Expanded with limit** (show first 3)
```
☑️ Include manual edits as examples
   • Row 23: "positive" → "neutral"
   • Row 104: "negative" → "mixed"
   • Row 507: "positive" → "sarcastic"
   ... and 2 more
```

C) **Scrollable list** (show all)
```
☑️ Include manual edits as examples
   [Scrollable div showing all 5 examples]
```

**Recommendation:** Option B
- Gives user confidence examples are being used
- Doesn't overwhelm with long list
- "... and X more" indicates there's more

### 3. "Edited" vs "Generated Then Edited"

**Scenario:**
- New AI column created (all cells empty)
- Before AI runs, user manually types "positive" in row 5
- Is this an "edit"?

**Current logic:** Only track as "edited" if overwriting AI-generated value

**Implementation:**
```typescript
const original_value = currentCellMeta?.status === 'success'
  ? currentCellValue  // AI generated this, now user is editing
  : null              // User filled empty cell (not an edit)
```

**Rationale:**
- Few-shot examples should be corrections, not manual data entry
- Prevents noise in examples (user randomly filling cells)

### 4. Resume Generation Banner Behavior

**When to show:**
```typescript
useEffect(() => {
  const hasPendingCells = data.some(row =>
    Object.values(row).some(cell =>
      cell?.__meta?.status === 'pending'
    )
  )

  if (hasPendingCells) {
    setShowResumeBanner(true)
  }
}, [])
```

**Banner actions:**
- **Resume** → Retry all pending cells (same as clicking retry on column)
- **Clear** → Set all pending to failed (user gives up)
- **Dismiss** → Hide banner, keep pending state

**Recommendation:** Show banner prominently at top of spreadsheet

---

## Future Enhancements

### Advanced Sampling Strategies

1. **Diversity sampling** - Pick examples with different output values
2. **Error-weighted sampling** - Prioritize high-confidence corrections
3. **Semantic sampling** - Use embeddings to maximize input diversity
4. **Cluster sampling** - Representative samples from edit clusters

### Multi-Turn Refinement

- User regenerates with examples → AI improves
- User edits a few more cells → regenerates again
- Iterative improvement loop

### Analytics Dashboard

- Which columns have most edits? (user engagement)
- Which models perform best? (fewest edits needed)
- Cost tracking per column/model

### Batch Operations

- "Apply examples to all similar columns"
- Share few-shot examples across multiple AI columns

### Versioning

- Track prompt evolution (multiple regenerations)
- "Undo regeneration" - restore previous cell values
- Compare model performance (GPT-4 vs Claude side-by-side)

---

## Files Requiring Changes

### New Files to Create

1. `src/lib/few-shot-sampling.ts` - Sampling strategies
2. `src/components/spreadsheet/AiCell.tsx` - Cell renderer
3. `src/components/spreadsheet/RetryModal.tsx` - Retry UI
4. `src/components/ResumeGenerationBanner.tsx` - Pending state banner

### Existing Files to Modify

1. `src/lib/duckdb.ts` - Add tables, CRUD operations
2. `src/types/agent-data.ts` - Type definitions
3. `src/hooks/use-file-storage.ts` - Data loading with JOINs
4. `src/components/spreadsheet/SpreadsheetEditor.tsx` - Retry handlers, model change
5. `src/components/spreadsheet/SpreadsheetTable.tsx` - Render AiCell
6. `src/lib/ai-inference.ts` - Error classification, few-shot injection

---

## Success Metrics

### User Experience

- **Reduced friction:** Failed cells don't require full column regeneration
- **Improved quality:** Few-shot learning yields better results
- **Transparency:** User sees exactly what's happening (badges, toasts)

### Technical

- **Data integrity:** Separate metadata doesn't corrupt data table
- **Performance:** JOIN queries remain fast (<100ms for 10k rows)
- **Maintainability:** Modular sampling strategies easy to extend

### Product

- **Engagement:** Track how often users edit AI-generated cells
- **Iteration:** Measure regenerations per column (lower = better initial quality)
- **Cost:** Track token usage with/without few-shot (justify feature value)

---

**Last Updated:** November 9, 2025
**Status:** Design finalized, ready for implementation
**Next Steps:** Begin Phase 1 (Data Structure)

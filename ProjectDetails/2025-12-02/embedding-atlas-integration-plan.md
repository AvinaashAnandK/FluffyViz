# Embedding Atlas Deep Integration - Implementation Plan

**Date:** 2025-12-13
**Status:** Planning
**Scope:** Feature 1 from feature-enhancements.md
**Estimate:** 16-22 hours

---

## Executive Summary

This document outlines the implementation strategy for deeply integrating Apple's Embedding Atlas into FluffyViz. The goal is to transform the current minimal visualization into a fully-featured exploration tool where users can color, filter, search, and explore their augmented agent trace data.

**Scope Decisions:**
- Conversational mode (N:1 row mapping) is **out of scope** for this iteration
- Focus on single-column and multi-column embedding modes (1:1 row mapping)
- Use DuckDB for all queries (no in-memory fallbacks)
- Spreadsheet edits before visualization is the 99% case; no reactive sync needed

---

## Current State Analysis

### What We Have

```
embedding-visualization.tsx (lines 108-124)
├── coordinator: Mosaic WASM connector to DuckDB ✓
├── data.table: 'embedding_points_view' ✓
├── data.id: 'point_id' ✓
├── data.projection: { x: 'x', y: 'y' } ✓
├── data.text: 'composed_text' ✓
└── colorScheme: 'light' (hardcoded) ✓
```

**DuckDB Tables:**
```sql
embedding_points_view:
  - layer_id, point_id, x, y, composed_text, label, source_row_indices

file_data_{fileId}:
  - row_index (PK), all original columns, AI-generated columns
```

### What's Missing

| Feature | Current | Target |
|---------|---------|--------|
| Spreadsheet columns in viz | None | ALL columns available |
| Color by column | No | User selects any column |
| Hover tooltip fields | `composed_text` only | User-selected columns |
| Search | None | Keyword (ILIKE) + Conceptual (cosine) |
| Save filter | None | Save selection → apply in spreadsheet |
| Theme | Light only | Light/Dark based on app theme |

---

## Embedding Atlas API Reference

Based on documentation at https://apple.github.io/embedding-atlas/ (and verified against `embedding-atlas` v0.11.0 in `fluffy-viz/package.json`).

### EmbeddingAtlas Component (High-Level)

We should continue using `EmbeddingAtlas` (not lower-level `EmbeddingView`) because it provides:
- Coordinated Table view
- Point details panel
- Density clustering with auto-labels
- Built-in search infrastructure

**Available Props We're Not Using:**

| Prop | Type | Use Case |
|------|------|----------|
| `searcher` | `Searcher \| null` | Custom search (keyword + conceptual) |
| `embeddingViewConfig` | `EmbeddingViewConfig` | Point size, density mode, labels |
| `embeddingViewLabels` | `Label[]` | Override / precompute labels |
| `tableCellRenderers` | `Record<string, CustomCell \| "markdown">` | Custom cell formatting in Table view |
| `onExportSelection` | `(predicate, format) => Promise<void>` | Export/save current selection |
| `onExportApplication` | `() => Promise<void>` | Export the viewer as an archive |
| `onStateChange` | `(state) => void` | Persist/restore full viewer state |
| `initialState` | `EmbeddingAtlasState` | Restore previous view configuration |
| `cache` | `Cache` | Cache for faster initialization |

### Searcher Interface

The `searcher` prop accepts an object with search methods:

```typescript
interface Searcher {
  // Full-text search (called with current selection predicate)
  fullTextSearch?(
    query: string,
    options?: {
      limit: number;
      predicate: string | null;
      onStatus: (status: string) => void;
    }
  ): Promise<{ id: any }[]>;

  // Vector search: EmbeddingAtlas passes the raw query string; we embed it ourselves
  vectorSearch?(
    query: string,
    options?: {
      limit: number;
      predicate: string | null;
      onStatus: (status: string) => void;
    }
  ): Promise<{ id: any; distance?: number }[]>;

  // Nearest neighbor: called with a row id (point id)
  nearestNeighbors?(
    id: any,
    options?: {
      limit: number;
      predicate: string | null;
      onStatus: (status: string) => void;
    }
  ): Promise<{ id: any; distance?: number }[]>;
}
```

This is the hook point for implementing both keyword and conceptual search.

### Table Component (Built-in)

EmbeddingAtlas includes a coordinated Table view. Key props passed internally:

- `columns`: Which columns to display
- `filter`: Mosaic Selection for cross-filtering
- `highlightedRows`: Highlight matches from search
- `columnConfigs`: Column widths, visibility

We can configure this by ensuring our `data.table` contains all desired columns (Phase 1 layer table).

---

## Implementation Architecture

### Data Flow Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DuckDB (Single Source of Truth)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  file_data_{fileId}              embedding_points                        │
│  ┌──────────────────┐           ┌────────────────────────┐              │
│  │ row_index (PK)   │           │ layer_id               │              │
│  │ conversation_id  │           │ point_id               │              │
│  │ content          │           │ embedding DOUBLE[]     │              │
│  │ timestamp        │           │ coordinates_2d [x,y]   │              │
│  │ quality_score    │◄─────────►│ composed_text          │              │
│  │ judge_reasoning  │  JOIN on  │ source_row_indices[]   │              │
│  │ failure_mode     │  source   │                        │              │
│  │ ...              │  row_idx  │                        │              │
│  └──────────────────┘           └────────────────────────┘              │
│            │                              │                              │
│            └──────────────┬───────────────┘                              │
│                           │                                              │
│                           ▼                                              │
│               embedding_layer_{layerId}  (Layer Table)                  │
│               ┌─────────────────────────────────────────┐                │
│               │ point_id, x, y, composed_text           │                │
│               │ + conversation_id, content, timestamp   │                │
│               │ + quality_score, judge_reasoning, ...   │                │
│               │ (Embeddings stay in embedding_points)   │                │
│               └─────────────────────────────────────────┘                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   EmbeddingAtlas    │
                         │                     │
                         │  data.table ────────┼── embedding_layer_{layerId}
                         │  searcher ──────────┼── FluffySearcher (custom)
                         │  tableCellRenderers ┼── Column-aware renderers
                         │  onExportSelection ─┼── Save filter handler
                         │                     │
                         └─────────────────────┘
```

### Phase 1: Pass ALL Columns to Embedding Layer (as a TABLE, not a VIEW)

**Objective:** Create a DuckDB table that JOINs embedding points with source file data.

**Key Insight:** For 1:1 modes (single/multi), `source_row_indices` contains exactly one index. We JOIN on that:

```sql
-- NOTE: EmbeddingAtlas mutates `data.table` (ALTER TABLE / UPDATE) to create
-- derived category/binned columns for coloring & legends, so this must be a
-- real table (not a view).
CREATE OR REPLACE TABLE embedding_layer_{layerId} AS
SELECT
  ep.point_id,
  ep.coordinates_2d[1] AS x,
  ep.coordinates_2d[2] AS y,
  ep.composed_text,
  -- Explicitly select file_data columns, aliasing any that conflict
  {safeFileDataColumns}
FROM embedding_points ep
JOIN file_data_{fileId} fd
  ON fd.row_index = ep.source_row_indices[1]
WHERE ep.layer_id = '{layerId}'
```

**Column Collision Handling:**

The `{safeFileDataColumns}` placeholder must be generated dynamically to avoid conflicts with embedding columns (`point_id`, `x`, `y`, `composed_text`):

```typescript
// In createLayerTable() implementation
const RESERVED_COLUMNS = ['point_id', 'x', 'y', 'composed_text'];
const fileColumns = await getFileColumns(fileId);

const safeFileDataColumns = fileColumns
  .map(col => {
    if (RESERVED_COLUMNS.includes(col.toLowerCase())) {
      return `fd."${col}" AS "original_${col}"`;
    }
    return `fd."${col}"`;
  })
  .join(',\n  ');
```

**Implementation Notes:**

1. **When to create table:** After embedding generation completes, before rendering visualization
2. **Table naming:** `embedding_layer_{layerId}` to scope to specific embedding layer
3. **Column collision:** Reserved columns (`point_id`, `x`, `y`, `composed_text`) are aliased with `original_` prefix if they exist in the spreadsheet
4. **Why not include `ep.embedding` in this table:** EmbeddingAtlas introspects *all* columns and runs `COUNT(DISTINCT ...)` during initialization; including high-dimensional vectors can be extremely slow. Keep vectors only in `embedding_points` and query them in the custom `searcher`.
5. **Table recreation:** If user adds new AI columns, the join table is stale. Options:
   - Recreate table when switching to visualization tab
   - Or accept staleness (user must re-embed for new columns)
   - **Decision:** Recreate on visualization tab mount (simple, covers 99% case)

**Files to modify:**
- `src/lib/embedding/storage.ts` - Add `createLayerTable(layerId, fileId)` method
- `src/components/embedding-viewer/embedding-visualization.tsx` - Call table creation on mount

---

### Phase 2: Color by Any Column (Use EmbeddingAtlas Built-in)

**Objective:** User selects a column; points are colored by that column's values.

**Verified behavior (`embedding-atlas` v0.11.0):**
- EmbeddingAtlas already exposes “Color by” in its sidebar UI.
- It creates a derived integer index column like `_ev_{column}_id` via `ALTER TABLE` + `UPDATE` on `data.table` and renders a legend.
- **String columns:** top N categories (currently 10) + `(other ...)` and `(null)` buckets.
- **Numeric columns:** ≤10 distinct → treat as categorical; otherwise auto-bin into ranges and use a sequential palette.

**Implications for FluffyViz:**
- No need to rebuild SQL per color change.
- `data.table` must be a writable DuckDB table (Phase 1).
- Optional: set a default color column with `initialState.view.selectedCategoryColumn`.

**Hiding `_ev_*` helper columns:**

EmbeddingAtlas creates internal columns like `_ev_quality_score_id` in the layer table. If users navigate back to the SpreadsheetEditor, these should be filtered out:

```typescript
// In SpreadsheetEditor column display logic
const visibleColumns = columns.filter(col => !col.startsWith('_ev_'));
```

Note: These columns only exist in `embedding_layer_{layerId}` tables, not in `file_data_{fileId}`, so this only matters if showing the layer table directly.

---

### Phase 3: Dynamic Hover Tooltip (Use EmbeddingAtlas Built-in)

**Objective:** User controls which columns appear in the hover tooltip.

**Verified behavior (`embedding-atlas` v0.11.0):**
- Tooltip rendering is multi-field and is driven by EmbeddingAtlas’ internal `columnStyles` configuration (full vs badge vs hidden).
- EmbeddingAtlas provides UI to set per-column display styles, which effectively controls the tooltip content.

**Implications for FluffyViz:**
- No need to concatenate columns into a single `text` field.
- Keep `data.text = composed_text` as the default summary used by tooltip/search/auto-labeling.
- Custom React tooltips are only available on lower-level `EmbeddingView` / `EmbeddingViewMosaic` (`customTooltip` prop), not `EmbeddingAtlas`.

---

### Phase 4: Search Implementation

**Objective:** Enable keyword (literal) and conceptual (semantic) search.

#### 4.1 Keyword Search (DuckDB ILIKE)

**Query:**
```sql
SELECT point_id
FROM embedding_layer_{layerId}
WHERE composed_text ILIKE '%{query}%'
   OR {column1}::VARCHAR ILIKE '%{query}%'
   OR {column2}::VARCHAR ILIKE '%{query}%'
```

**Integration with EmbeddingAtlas:**

The `searcher` prop accepts a custom searcher object:

```typescript
const fluffySearcher: Searcher = {
  fullTextSearch: async (query: string, options) => {
    options?.onStatus?.('Searching...');
    const sql = buildKeywordSearchQuery(
      layerId,
      query,
      searchableColumns,
      options?.predicate ?? null,
      options?.limit ?? 100
    );
    const results = await executeQuery(sql);
    return results.map(r => ({ id: r.point_id }));
  },
  vectorSearch: async (query: string, options) => {
    options?.onStatus?.('Embedding query...');
    const queryEmbedding = await embedQueryString(query, layerId);
    options?.onStatus?.('Computing similarity...');
    const sql = buildVectorSearchQuery(
      layerId,
      queryEmbedding,
      options?.predicate ?? null,
      options?.limit ?? 100
    );
    const results = await executeQuery(sql);
    return results.map(r => ({ id: r.point_id, distance: 1 - r.similarity }));
  },
};

<EmbeddingAtlas
  // ...
  searcher={fluffySearcher}
/>
```

**UI:** EmbeddingAtlas has built-in search input. We just need to wire up our searcher.

#### 4.2 Conceptual Search (Cosine Similarity)

**Prerequisites:**
- Raw embeddings stored in `embedding_points.embedding` (we have this ✓)
- Ability to embed the query phrase using same model

**Query:**
```sql
WITH scored AS (
  SELECT
    ep.point_id,
    array_cosine_similarity(ep.embedding, CAST({queryEmbedding} AS DOUBLE[])) AS similarity
  FROM embedding_points ep
  JOIN embedding_layer_{layerId} el
    ON el.point_id = ep.point_id
  WHERE ep.layer_id = '{layerId}'
    AND ({predicateOrTrue})
)
SELECT point_id, similarity
FROM scored
WHERE similarity > {threshold}
ORDER BY similarity DESC
LIMIT 100
```

**DuckDB Status:** `array_cosine_similarity` is available in DuckDB ≥0.10.0 and DuckDB WASM (verified). Note: all LIST functions work with ARRAY type, but `array_cosine_similarity` is the canonical name.

**Predicate handling:** Set `{predicateOrTrue}` to `TRUE` if `options.predicate` is null; otherwise substitute the predicate SQL expression provided by EmbeddingAtlas so vector search respects current filters.

**Implementation Flow:**

1. User enters concept phrase (e.g., "user is frustrated")
2. Get layer's embedding provider/model from `embedding_layers` metadata
3. Call embedding API to get query vector
4. Execute similarity query in DuckDB
5. Return results to EmbeddingAtlas searcher

**API Call for Query Embedding:**

Option A (matches current embedding generation flow): embed the query on the client using provider settings loaded from `/api/provider-config`.

Option B: add a server-side route if we later want to keep embedding API keys server-only:

```typescript
// POST /api/embed-query
{
  text: "user is frustrated",
  provider: "openai",
  model: "text-embedding-3-small"
}
// Returns: { embedding: number[] }
```

**Files to modify/create:**
- `src/lib/embedding/search.ts` (new) - FluffySearcher implementation
- `src/app/api/embed-query/route.ts` (optional) - Embed query phrase (if we keep API keys server-only)
- `src/components/embedding-viewer/embedding-visualization.tsx` - Wire up searcher

---

### Phase 5: Save Filter for Spreadsheet

**Objective:** User can save current selection in embedding view, then apply that filter in spreadsheet.

**Data Model:**

```sql
CREATE TABLE IF NOT EXISTS saved_filters (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  name TEXT NOT NULL,
  layer_id TEXT NOT NULL,
  row_indices INTEGER[] NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

**Flow:**

1. User selects/filters points in EmbeddingAtlas
2. User clicks "Save Filter" button
3. Modal: Enter filter name
4. Extract selected point IDs via `onExportSelection` callback
5. Map point IDs back to source row indices
6. Save to DuckDB

**Applying Filter in Spreadsheet:**

```sql
-- When filter is active
SELECT * FROM file_data_{fileId}
WHERE row_index = ANY({savedFilter.rowIndices})
```

**UI Components:**

```
Embedding View:
┌─────────────────────────────────────────┐
│ [Save Current Filter]                   │
└─────────────────────────────────────────┘

Modal:
┌─────────────────────────────────────────┐
│ Save Filter                             │
│                                         │
│ Name: [High quality responses     ]     │
│                                         │
│ 47 points selected                      │
│                                         │
│              [Cancel]  [Save]           │
└─────────────────────────────────────────┘

Spreadsheet (filter dropdown):
┌─────────────────────────────────────────┐
│ Active Filter: [All Data           ▼]   │
│                                         │
│   ○ All Data (1,234 rows)               │
│   ○ High quality responses (47 rows)    │
│   ○ Failure cluster A (23 rows)         │
└─────────────────────────────────────────┘
```

**Files to modify/create:**
- `src/lib/duckdb/schema.ts` - Add `saved_filters` table
- `src/lib/filters/storage.ts` (new) - CRUD for saved filters
- `src/components/embedding-viewer/save-filter-modal.tsx` (new)
- `src/components/spreadsheet/SpreadsheetEditor.tsx` - Filter dropdown

---

## Implementation Phases & Order

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Phase 1: Foundation (4-5 hours)                                         │
│ ─────────────────────────────────────────────────────────────────────── │
│ □ Create embedding_layer_{layerId} table with JOIN to file_data         │
│ □ Modify embedding-visualization.tsx to (re)build table on mount         │
│ □ Update EmbeddingAtlas data prop to use new table                      │
│ □ Verify all spreadsheet columns appear in Table view                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Phase 2: Color Encoding (1-2 hours)                                     │
│ ─────────────────────────────────────────────────────────────────────── │
│ □ Verify EmbeddingAtlas "Color by" works on layer table                 │
│ □ Verify binned numeric coloring + legend                               │
│ □ Hide `_ev_*` helper columns from SpreadsheetEditor (filter by prefix) │
│ □ (Optional) set initialState.view.selectedCategoryColumn               │
├─────────────────────────────────────────────────────────────────────────┤
│ Phase 3: Hover Tooltip (1-2 hours)                                      │
│ ─────────────────────────────────────────────────────────────────────── │
│ □ Verify tooltip shows multi-field columns via columnStyles             │
│ □ Configure sensible default columnStyles (optional)                    │
│ □ Add tableCellRenderers for markdown/long-text (optional)              │
├─────────────────────────────────────────────────────────────────────────┤
│ Phase 4: Search (5-6 hours)                                             │
│ ─────────────────────────────────────────────────────────────────────── │
│ □ Create FluffySearcher implementing Searcher interface                 │
│ □ Implement keyword search (fullTextSearch) with DuckDB ILIKE           │
│ □ Embed query string (client-side; optional server route)               │
│ □ Implement conceptual search (vectorSearch) with cosine similarity     │
│ □ Wire searcher to EmbeddingAtlas                                       │
│ □ Add search mode toggle if needed (keyword vs conceptual)              │
├─────────────────────────────────────────────────────────────────────────┤
│ Phase 5: Save Filter (3-4 hours)                                        │
│ ─────────────────────────────────────────────────────────────────────── │
│ □ Add saved_filters table to schema                                     │
│ □ Create filter storage utilities                                       │
│ □ Add "Save Filter" button to embedding view                            │
│ □ Create save filter modal                                              │
│ □ Wire onExportSelection callback                                       │
│ □ Add filter dropdown to SpreadsheetEditor                              │
│ □ Implement filter application in spreadsheet queries                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Phase 6: Polish (2-3 hours)                                             │
│ ─────────────────────────────────────────────────────────────────────── │
│ □ Dark mode support (colorScheme from theme context)                    │
│ □ Loading states for table creation, search                             │
│ □ Error handling and user feedback                                      │
│ □ Performance testing with large datasets (5k+ points)                  │
│ □ Keyboard shortcuts for common actions                                 │
└─────────────────────────────────────────────────────────────────────────┘

Total Estimate: 16-22 hours
```

---

## Open Questions & Decisions Needed

### 1. Conceptual Search Feasibility

**Question:** Does DuckDB WASM support `list_cosine_similarity`?

**Answer (verified):** Yes. With `@duckdb/duckdb-wasm` (current FluffyViz dependency), `list_cosine_similarity(list, list)` works and returns `1` for identical vectors.

**Implementation note:** Compute similarity once (subquery/CTE) to avoid calling `list_cosine_similarity(...)` twice in `SELECT` + `WHERE`.

### 2. EmbeddingAtlas Custom Tooltip

**Question:** Can we render custom React components in tooltip?

**Answer (verified):** Not via the high-level `EmbeddingAtlas` React wrapper. `customTooltip` is only exposed on lower-level `EmbeddingView` / `EmbeddingViewMosaic`.

**Decision:** Use EmbeddingAtlas built-in tooltip + columnStyles UI for multi-field display. Only drop down to `EmbeddingViewMosaic` if we absolutely need a fully custom React tooltip.

### 3. Color Scale API

**Question:** How does EmbeddingAtlas handle continuous (numeric) color scales?

**Answer (verified by source):** EmbeddingAtlas bins numeric columns automatically when needed and uses a sequential palette. Low-cardinality numeric columns (≤10 distinct) are treated as categorical. Under the hood it creates a derived integer category column (`_ev_{column}_id`) and a legend.

**Implication:** We do *not* need to pre-bin values or generate palettes in FluffyViz for v1. We *do* need `data.table` to be a writable table (not a view) so EmbeddingAtlas can `ALTER TABLE` + `UPDATE`.

### 4. View Recreation Performance

**Question:** How fast is `CREATE OR REPLACE VIEW` for 10k+ rows?

**Answer:** Very fast — `CREATE OR REPLACE VIEW` is metadata-only (no scan). In a DuckDB WASM benchmark, repeated view replacement averaged ~0.2ms even on a 200k-row table.

**More important decision:** We should not rely on a view for `data.table` because EmbeddingAtlas uses `ALTER TABLE`/`UPDATE` on the provided table for color legends and binned columns. Use `CREATE OR REPLACE TABLE embedding_layer_{layerId} AS ...` (Phase 1), and show a loading state while the table is (re)built.

---

## File Structure After Implementation

```
src/
├── components/
│   └── embedding-viewer/
│       ├── index.tsx                      # Main container (updated)
│       ├── embedding-visualization.tsx    # EmbeddingAtlas wrapper (updated)
│       ├── save-filter-modal.tsx          # NEW: Save filter modal
│       └── embedding-wizard.tsx           # (existing, unchanged)
│
├── lib/
│   ├── embedding/
│   │   ├── storage.ts                     # Updated: createLayerTable
│   │   ├── search.ts                      # NEW: FluffySearcher implementation
│   │   └── batch-embedder.ts              # (existing, unchanged)
│   │
│   ├── filters/
│   │   └── storage.ts                     # NEW: Saved filter CRUD
│   │
│   └── duckdb/
│       └── schema.ts                      # Updated: saved_filters table
│
└── app/
    └── api/
        └── embed-query/
            └── route.ts                   # OPTIONAL: server-side query embedding
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| EmbeddingAtlas mutates `data.table` | Medium | Medium | Use per-layer working tables; recreate on mount to keep schema clean |
| Large/complex columns slow initialization | Medium | Medium | Exclude high-dimensional vectors and other complex types from layer table |
| DuckDB WASM cosine similarity missing | Low | Medium | Verified present; keep SQL fallback as contingency |
| Table rebuild cost for huge datasets | Low | Medium | Rebuild only on viz entry; show loading state |
| Searcher interface/version drift | Medium | Medium | Pin `embedding-atlas` version; implement to current type signatures |

---

## Success Criteria

1. **All Columns Available:** User can see any spreadsheet column in the Table view
2. **Color by Column:** EmbeddingAtlas sidebar allows coloring points by any column, with appropriate scale
3. **Hover Customization:** Tooltip fields configurable via EmbeddingAtlas column styles (full/badge/hidden)
4. **Keyword Search:** Typing a term highlights matching points
5. **Conceptual Search:** Describing a concept finds semantically similar points
6. **Save Filter:** Selections can be saved and applied in spreadsheet view
7. **Performance:** 5,000 points with 20 columns renders in <2 seconds

---

## References

- [Embedding Atlas Documentation](https://apple.github.io/embedding-atlas/)
- [EmbeddingAtlas Component API](https://apple.github.io/embedding-atlas/embedding-atlas.html)
- [EmbeddingView Component API](https://apple.github.io/embedding-atlas/embedding-view.html)
- [Table Component API](https://apple.github.io/embedding-atlas/table.html)
- [Mosaic Framework](https://idl.uw.edu/mosaic/)
- [DuckDB Array Functions](https://duckdb.org/docs/sql/functions/list)
- [Feature Enhancements Spec](./feature-enhancements.md)

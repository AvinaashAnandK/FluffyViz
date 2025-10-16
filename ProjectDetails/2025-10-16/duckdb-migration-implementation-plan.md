# DuckDB WASM Migration Implementation Plan

**Date:** October 16, 2025
**Goal:** Migrate FluffyViz from IndexedDB to DuckDB WASM for all data storage, enabling proper embedding-atlas integration and unlocking analytical query capabilities.

---

## Recent Updates

**Latest Changes (October 16, 2025):**
1. ✅ **Feature 0**: Removed migration utility - starting fresh with DuckDB (no IndexedDB migration needed)
2. ✅ **Feature 1**: Added requirement to maintain processing state flow (loading → "Process Data" → navigate to spreadsheet)
3. ✅ **Feature 2**: Confirmed direct navigation only (no file reconstruction)
4. ✅ **Feature 3**: Clarified SpreadsheetTable does NOT currently have pagination, sorting, or filtering. Need to add:
   - Sort button/dropdown UI
   - Filter button/input UI
   - Backend SQL-based sorting and filtering
5. ✅ **Feature 7**: PARKED for future implementation - focus on core migration first
6. ✅ **Timeline**: Updated to reflect Feature 3 complexity increase and Feature 7 deferral (43-59 hours)

---

## Executive Summary

FluffyViz currently ships `@duckdb/duckdb-wasm@1.30.0` (via `embedding-atlas` → `mosaic-core`) but uses none of its capabilities. All data is stored in IndexedDB, and the embedding visualization uses a canvas fallback instead of the bundled `embedding-atlas` component.

**Key Problems:**
1. Paying 10MB bundle cost for DuckDB WASM without using it
2. No SQL query capabilities (filtering, sorting, aggregation)
3. Canvas fallback visualization instead of WebGPU-powered embedding-atlas
4. Full data deserialization on every operation
5. Poor performance at 10k+ rows
6. No cross-filtering between spreadsheet and embeddings

**Migration Benefits:**
- ✅ Use the embedding-atlas component that's already bundled
- ✅ Enable Mosaic cross-filtering across all views
- ✅ 10x faster spreadsheet operations with SQL pagination
- ✅ Vector similarity search for embeddings
- ✅ Batch AI column updates instead of row-by-row
- ✅ Handle millions of embedding points (vs. 10k limit now)

---

## Architecture Overview

### Current (IndexedDB)
```
Upload → IndexedDB (CSV string)
  ↓
Load → Parse CSV → JSON array in memory (ALL rows)
  ↓
Spreadsheet → React state (re-renders on every edit)
  ↓
Embedding generation → JSON blob in IndexedDB
  ↓
Visualization → Canvas fallback (embedding-atlas unused)
```

### Target (DuckDB WASM)
```
Upload → Parse → DuckDB table (columnar storage)
  ↓
Spreadsheet → SQL pagination (LIMIT/OFFSET)
  ↓
Embedding generation → DuckDB embedding_points table
  ↓
Visualization → Mosaic coordinator → embedding-atlas (WebGPU)
```

### Schema Design
```sql
-- File metadata
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  last_modified TIMESTAMP NOT NULL,
  size INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);

-- File data (dynamic tables per file)
CREATE TABLE file_data_{fileId} (
  row_index INTEGER PRIMARY KEY,
  -- Dynamic columns based on parsed content
  -- e.g., user_name TEXT, message TEXT, timestamp TIMESTAMP
);

-- Embedding layer metadata
CREATE TABLE embedding_layers (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimension INTEGER NOT NULL,
  composition_mode TEXT NOT NULL,
  composition_config JSON NOT NULL,
  created_at TIMESTAMP NOT NULL,
  last_accessed_at TIMESTAMP NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE
);

-- Embedding points (vector data)
CREATE TABLE embedding_points (
  layer_id TEXT NOT NULL REFERENCES embedding_layers(id) ON DELETE CASCADE,
  point_id TEXT NOT NULL,
  embedding FLOAT[],  -- Native array support
  coordinates_2d FLOAT[2],
  composed_text TEXT,
  label TEXT,
  source_row_indices INTEGER[],
  PRIMARY KEY (layer_id, point_id)
);
```

---

## Implementation Features (In Dependency Order)

### Feature 0: Foundation & DuckDB Setup
**Priority:** CRITICAL - All features depend on this
**Estimated Complexity:** Medium
**Status:** Not started

#### Objectives
1. Initialize DuckDB WASM client with OPFS persistence
2. Define database schema
3. Configure Next.js webpack for WASM loading
4. Create utility functions for common operations
5. Set up Mosaic coordinator for future visualization

#### Files to Create
```
src/lib/duckdb/
├── client.ts              # Singleton DuckDB connection
├── schema.ts              # Table definitions
├── operations.ts          # CRUD operations
├── types.ts               # TypeScript interfaces
└── query-builder.ts       # Type-safe query helpers
```

#### Files to Modify
- `next.config.ts` - Add webpack config for WASM files
- `package.json` - Verify @duckdb/duckdb-wasm is in dependencies (already is via transitive)

#### Implementation Details

**1. DuckDB Client (`src/lib/duckdb/client.ts`)**
- Initialize AsyncDuckDB with browser worker
- Configure OPFS for persistence (`fluffyviz.db`)
- Handle SharedArrayBuffer headers (required for threading)
- Implement connection pooling if needed
- Export singleton instance

**2. Schema Definition (`src/lib/duckdb/schema.ts`)**
- Define `initializeSchema()` function
- Create tables: files, embedding_layers, embedding_points
- Add indexes for common queries
- Version schema for future migrations

**3. Next.js Configuration (`next.config.ts`)**
- Add webpack rule for `.wasm` files (asset/resource)
- Add webpack rule for `.worker.js` files
- Copy DuckDB bundles to `/public`
- Set security headers:
  ```typescript
  headers: [
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
  ]
  ```

**4. Core Operations (`src/lib/duckdb/operations.ts`)**
- `createFileTable(fileId, parsedData)` - Create dynamic table
- `queryFileData(fileId, options)` - Paginated queries
- `updateFileData(fileId, updates)` - Batch updates
- `deleteFileTable(fileId)` - Cleanup on file deletion
- `executeQuery(sql, params)` - Generic query execution

**Note:** No migration utility needed - starting fresh with DuckDB. Existing IndexedDB data will not be migrated.

#### Testing Checklist
- [ ] DuckDB initializes without errors
- [ ] Can create and query tables
- [ ] OPFS persistence works (survives page refresh)
- [ ] SharedArrayBuffer headers work in dev and production
- [ ] WASM files load correctly from /public
- [ ] No webpack build errors
- [ ] No breaking changes to existing features

#### Success Criteria
- DuckDB client singleton works reliably
- Schema initializes on first load
- Can insert and query test data
- OPFS persistence confirmed
- Documentation for DuckDB operations completed

#### Notes for Agentic Coder
- Test with Safari to ensure OPFS compatibility
- Check if SharedArrayBuffer fallback is needed
- Research existing Next.js + DuckDB WASM examples
- Consider feature flag for gradual rollout

---

### Feature 1: File Upload & Storage Migration
**Priority:** HIGH - Core infrastructure for all features
**Estimated Complexity:** High
**Dependencies:** Feature 0
**Status:** Not started

#### Objectives
1. Migrate file storage from IndexedDB to DuckDB
2. Store file metadata in `files` table
3. Store parsed file data in dynamic `file_data_{id}` tables
4. Update upload flow to write directly to DuckDB
5. Maintain correct processing state flow (loading → "Process Data" → navigate to spreadsheet)
6. Remove all IndexedDB file storage code

#### Files to Modify
- `src/hooks/use-file-storage.ts` ⭐ PRIMARY (major refactor)
- `src/lib/format-parser.ts` (output to DuckDB instead of returning arrays)
- `src/app/page.tsx` (verify upload flow still works)
- `src/components/enhanced-upload.tsx` (ensure processing state reflects correctly in "Process Data" button)

#### Files to Analyze for Removal

**`src/hooks/use-file-storage.ts`** - Remove:
- `FileStorageDB` class (lines 57-245) - entire IndexedDB implementation
- `OperationQueue` class (lines 23-53) - DuckDB handles concurrency
- `operationQueue` singleton (line 55)
- `DB_NAME`, `DB_VERSION`, `STORE_NAME` constants (lines 14-16)
- Version tracking logic (lines 191-204) - use DuckDB transactions
- `CustomEvent` syncing (lines 249-254) - assess if still needed for cross-tab
- File size validation (lines 158-161, 181-183) - move to upload component

**Keep but refactor:**
- `useFileStorage()` hook interface (maintain same API for components)
- `StoredFile` interface (update to match new DuckDB schema)
- `MAX_FILE_SIZE` and `WARN_FILE_SIZE` constants

#### Implementation Strategy

**Phase 1: Add DuckDB operations (parallel to IndexedDB)**
1. Create new functions in `use-file-storage.ts`:
   - `saveFileToDuckDB()`
   - `loadFilesFromDuckDB()`
   - `deleteFileFromDuckDB()`
   - `renameFileInDuckDB()`

2. Temporarily call both IndexedDB and DuckDB (dual write)
3. Verify DuckDB operations work correctly

**Phase 2: Switch reads to DuckDB**
1. Change `loadFiles()` to read from DuckDB
2. Verify UI displays correctly
3. Keep IndexedDB writes as backup

**Phase 3: Remove IndexedDB completely**
1. Remove all IndexedDB operations
2. Remove dual-write code
3. Clean up unused imports and constants

#### Detailed Changes

**`src/hooks/use-file-storage.ts`**

Replace entire hook implementation:
```typescript
// OLD (IndexedDB):
const storedFile: StoredFile = {
  id,
  name: fileName,
  content: fileContent,  // ← 50MB CSV as string!
  format,
  lastModified: Date.now(),
  size,
  mimeType
};
await db.addFile(storedFile);

// NEW (DuckDB):
// 1. Parse file immediately
const parsedData = await parseFileContent(fileContent, format);

// 2. Store metadata
await duckdb.query(`
  INSERT INTO files VALUES (?, ?, ?, ?, ?, ?)
`, [id, fileName, format, new Date(), size, 1]);

// 3. Create and populate data table
await createFileTable(id, parsedData);
```

**`src/lib/format-parser.ts`**

Add optional DuckDB output mode:
```typescript
// Current: Returns array
export async function parseFileContent(content: string, format: SupportedFormat): Promise<ParsedData[]>

// New: Optional direct-to-DuckDB mode
export async function parseFileContent(
  content: string,
  format: SupportedFormat,
  options?: { outputMode: 'array' | 'duckdb', fileId?: string }
): Promise<ParsedData[] | void>
```

#### Testing Checklist
- [ ] File upload creates DuckDB table
- [ ] File metadata stored correctly
- [ ] File list displays from DuckDB
- [ ] File rename works
- [ ] File delete cascades to data table
- [ ] Delete all files works
- [ ] No IndexedDB code remains
- [ ] Cross-tab sync still works (if needed)
- [ ] Large file (10MB+) uploads successfully
- [ ] All 5 format types parse correctly

#### Success Criteria
- All files stored in DuckDB tables
- No performance degradation vs. IndexedDB
- File list loads instantly
- Processing state correctly reflected: shows loading → "Process Data" button → navigates to spreadsheet view after completion
- No errors in browser console
- Tests pass for all file operations

#### Important Notes
**Processing State Flow:** The current IndexedDB implementation shows:
1. Quick loading page/state during upload
2. Returns to "Process Data" button
3. After data is processed, navigates to spreadsheet view

This exact flow must be maintained with DuckDB implementation to preserve UX consistency.

---

### Feature 2: File Management (Sidebar) Update
**Priority:** HIGH - User-facing file operations
**Estimated Complexity:** Low
**Dependencies:** Feature 1
**Status:** Not started

#### Objectives
1. Update sidebar to query files from DuckDB
2. Ensure file deletion cascades properly
3. Maintain all existing UI interactions
4. Remove any IndexedDB-specific error handling

#### Files to Modify
- `src/components/app-sidebar.tsx` (line 36 uses `useFileStorage`)

#### Files to Analyze for Removal

**`src/components/app-sidebar.tsx`** - Check for:
- Unused state variables (e.g., temporary error handling)
- IndexedDB-specific error messages
- Redundant loading states (DuckDB is faster)
- Dead code in file click handler (lines 87-100)
  - Currently reconstructs File object from stored content
  - With DuckDB, content not stored - need different approach

#### Implementation Notes

**Key Challenge:** Line 87-100 reconstructs File object from IndexedDB content:
```typescript
const handleFileClick = (file: StoredFile) => {
  const blob = new Blob([file.content], { type: file.mimeType })
  const fileObject = new File([blob], file.name, {
    type: file.mimeType,
    lastModified: file.lastModified
  })
  emitFileSelected({ file: fileObject, source: 'sidebar-stored', storedFileId: file.id })
}
```

**Solution:** With DuckDB, we don't store raw content. Options:
1. **Reconstruct from DuckDB table** (export to CSV/JSON)
2. **Navigate directly to /edit/[fileId]** (simpler, better UX)
3. **Keep small original file in OPFS** (hybrid approach)

Recommend: Option 2 (direct navigation) - simpler and aligns with existing /edit route.

#### Detailed Changes

**`src/components/app-sidebar.tsx`**

Update file click handler:
```typescript
// OLD: Reconstruct File object and emit event
const handleFileClick = (file: StoredFile) => {
  const blob = new Blob([file.content], { type: file.mimeType })
  const fileObject = new File([blob], file.name, { ... })
  emitFileSelected({ ... })
}

// NEW: Navigate directly to edit page
import { useRouter } from 'next/navigation'

const handleFileClick = (file: StoredFile) => {
  router.push(`/edit/${file.id}`)
}
```

Remove file reconstruction logic entirely.

#### Testing Checklist
- [ ] File list displays correctly
- [ ] Click file navigates to edit page
- [ ] Delete file works (cascades to DuckDB table)
- [ ] Rename file updates DuckDB
- [ ] Delete all files works
- [ ] File count badge updates
- [ ] Upload from sidebar works
- [ ] No console errors

#### Success Criteria
- All sidebar operations work with DuckDB backend
- No references to IndexedDB in component
- File click navigation is smooth
- No unused code remains

---

### Feature 3: Spreadsheet Data Display with Pagination
**Priority:** HIGH - Core user-facing feature
**Estimated Complexity:** High
**Dependencies:** Feature 1
**Status:** Not started

#### Objectives
1. Load spreadsheet data from DuckDB with SQL pagination
2. Implement pagination UI (SpreadsheetTable does NOT currently have pagination)
3. Add sorting UI button (NO sorting currently exists)
4. Add filtering UI button (NO filtering currently exists)
5. Enable SQL-based sorting and filtering backend
6. Remove full-data-in-memory architecture
7. Maintain cell editing capabilities

#### Files to Modify
- `src/components/spreadsheet/SpreadsheetEditor.tsx` ⭐ PRIMARY (major refactor)
- `src/components/spreadsheet/SpreadsheetTable.tsx` (rendering)
- `src/app/edit/[fileId]/page.tsx` (route)

#### Files to Analyze for Removal

**`src/components/spreadsheet/SpreadsheetEditor.tsx`** - Remove:
- Full data loading (lines 66-79):
  ```typescript
  const parsedData = await parseFileContent(storedFile.content, storedFile.format)
  setData(parsedData)  // ← All 10k+ rows in state!
  ```
- CSV conversion on save (lines 218-236) - use DuckDB export
- Manual column generation from data (lines 71-78) - get from DuckDB schema
- `convertToCSV()` function (lines 218-236) - use DuckDB `COPY TO`

**`src/components/spreadsheet/SpreadsheetTable.tsx`** - Current State:
- **Does NOT handle pagination** - assumes all data is present in props
- **NO sorting functionality** exists currently
- **NO filtering functionality** exists currently
- Need to add:
  1. Pagination controls UI
  2. Sort button/dropdown
  3. Filter button/input

#### Implementation Strategy

**Phase 1: Add pagination state**
```typescript
const [page, setPage] = useState(0)
const [pageSize, setPageSize] = useState(100)
const [totalRows, setTotalRows] = useState(0)
const [sortColumn, setSortColumn] = useState<string | null>(null)
const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('ASC')
```

**Phase 2: Replace data loading**
```typescript
// OLD:
const parsedData = await parseFileContent(storedFile.content, storedFile.format)
setData(parsedData)

// NEW:
const pageData = await queryFileData(fileId, {
  limit: pageSize,
  offset: page * pageSize,
  orderBy: sortColumn ? `${sortColumn} ${sortDirection}` : 'row_index ASC'
})
setData(pageData)

// Get total count
const countResult = await duckdb.query(`SELECT COUNT(*) as total FROM file_data_${fileId}`)
setTotalRows(countResult[0].total)
```

**Phase 3: Add pagination UI to SpreadsheetTable**
- Add pagination controls (Previous, Next, Page numbers)
- Add page size selector (50, 100, 500, 1000)
- Add "Go to page" input
- Show "Showing X-Y of Z rows"

**Phase 4: Add sorting UI and functionality**
- Add Sort button/dropdown in toolbar
- Allow user to select column and direction (ASC/DESC)
- Implement backend sorting logic:
```typescript
const handleSort = (columnId: string) => {
  if (sortColumn === columnId) {
    setSortDirection(prev => prev === 'ASC' ? 'DESC' : 'ASC')
  } else {
    setSortColumn(columnId)
    setSortDirection('ASC')
  }
  setPage(0)  // Reset to first page
  // Triggers re-query via useEffect
}
```

**Phase 5: Add filtering UI and functionality**
- Add Filter button in toolbar
- Show filter input/modal for column selection and condition
- Support basic filters: equals, contains, greater than, less than
- Implement backend filtering logic:
```typescript
const [filters, setFilters] = useState<Array<{ column: string, operator: string, value: string }>>([])

const buildWhereClause = () => {
  if (filters.length === 0) return ''
  return filters.map(f => {
    switch (f.operator) {
      case 'equals': return `"${f.column}" = '${f.value}'`
      case 'contains': return `"${f.column}" LIKE '%${f.value}%'`
      case 'gt': return `"${f.column}" > ${f.value}`
      case 'lt': return `"${f.column}" < ${f.value}`
    }
  }).join(' AND ')
}
```

**Phase 6: Cell editing with DuckDB**
```typescript
const updateCellValue = async (rowIndex: number, columnId: string, value: any) => {
  // Update in DuckDB
  await duckdb.query(`
    UPDATE file_data_${fileId}
    SET "${columnId}" = ?
    WHERE row_index = ?
  `, [value, page * pageSize + rowIndex])

  // Update local state (optimistic update)
  setData(prev => prev.map((row, idx) =>
    idx === rowIndex ? { ...row, [columnId]: value } : row
  ))
}
```

#### Detailed Changes

**`src/components/spreadsheet/SpreadsheetEditor.tsx`**

Major refactor of data loading (lines 59-89):
```typescript
// NEW implementation
useEffect(() => {
  const loadPageData = async () => {
    try {
      setLoading(true)

      // Get file metadata from DuckDB
      const fileMetadata = await duckdb.query(`SELECT * FROM files WHERE id = ?`, [fileId])
      if (fileMetadata.length === 0) {
        console.error('File not found')
        return
      }
      setFileName(fileMetadata[0].name)

      // Get column schema
      const schemaQuery = await duckdb.query(`PRAGMA table_info(file_data_${fileId})`)
      const columns = schemaQuery
        .filter(col => col.name !== 'row_index')
        .map(col => ({
          id: col.name,
          name: col.name,
          type: col.type,
          visible: true
        }))
      setColumns(columns)

      // Get total row count
      const countResult = await duckdb.query(`SELECT COUNT(*) as total FROM file_data_${fileId}`)
      setTotalRows(countResult[0].total)

      // Load current page
      await loadPage(page)
    } catch (error) {
      console.error('Error loading file:', error)
    } finally {
      setLoading(false)
    }
  }

  loadPageData()
}, [fileId])

const loadPage = async (pageNum: number) => {
  const pageData = await queryFileData(fileId, {
    limit: pageSize,
    offset: pageNum * pageSize,
    orderBy: sortColumn ? `"${sortColumn}" ${sortDirection}` : 'row_index ASC'
  })
  setData(pageData)
}
```

Remove CSV export function, use DuckDB export:
```typescript
// OLD: convertToCSV() function (lines 218-236)

// NEW:
const handleExport = async () => {
  const csvPath = `/tmp/${fileName}`
  await duckdb.query(`
    COPY file_data_${fileId} TO '${csvPath}' (HEADER, DELIMITER ',')
  `)
  // Download file
  const blob = await duckdb.copyFileToBlob(csvPath)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
}
```

#### Testing Checklist
- [ ] Spreadsheet loads with pagination
- [ ] Can navigate between pages
- [ ] Sorting works for all column types
- [ ] Cell editing persists to DuckDB
- [ ] Export to CSV works
- [ ] Performance is good with 100k+ rows
- [ ] No full data array in memory (check DevTools)
- [ ] Page size selector works
- [ ] "Go to page" input works
- [ ] Row count displays correctly

#### Success Criteria
- Spreadsheet renders only visible page (not all rows)
- Pagination controls work smoothly
- Sorting is instant (SQL-based)
- Cell edits persist correctly
- Memory usage stays constant regardless of file size
- Can handle 1M+ row files without issues

#### Performance Expectations
- Initial load: < 200ms (was ~800ms)
- Page navigation: < 50ms (was N/A)
- Sort operation: < 100ms (was ~300ms for JS sort)
- Cell edit: < 20ms (was ~50ms with React state)

---

### Feature 4: AI Column Generation with Batch Updates
**Priority:** HIGH - Core value proposition
**Estimated Complexity:** Medium
**Dependencies:** Feature 3
**Status:** Not started

#### Objectives
1. Create new AI columns directly in DuckDB tables
2. Batch insert AI results instead of row-by-row state updates
3. Maintain progress tracking and cell-level loading states
4. Optimize for performance with large datasets
5. Remove React state churn during generation

#### Files to Modify
- `src/components/spreadsheet/SpreadsheetEditor.tsx` (lines 91-194)
- `src/components/spreadsheet/AddColumnModal.tsx` (verify compatibility)
- `src/lib/ai-inference.ts` (check for optimization opportunities)

#### Files to Analyze for Removal

**`src/components/spreadsheet/SpreadsheetEditor.tsx`** - Remove:
- Row-by-row state updates (lines 156-184):
  ```typescript
  (rowIndex, result) => {
    setData(prev => {
      const updated = [...prev]  // ← Copies entire array on every cell!
      updated[rowIndex] = { ...updated[rowIndex], [column.id]: result.content }
      return updated
    })
  }
  ```
- Per-cell loading set management (lines 145-149, 178-183)
- Complex generation progress tracking that triggers re-renders

**`src/lib/ai-inference.ts`** - Analyze:
- Check for unused mock data
- Verify if streaming is actually used
- Remove redundant response parsing

**`src/components/spreadsheet/AddColumnModal.tsx`** - Check:
- Any hard-coded assumptions about data structure
- Validation logic that might need adjustment

#### Implementation Strategy

**Phase 1: Modify AI inference to return batch results**
```typescript
// OLD: Callback per row
await generateColumnData(
  data, columnId, prompt, model, provider, columnRefs,
  (current, total) => setGenerationProgress({ current, total }),
  (rowIndex, result) => { /* update state */ }
)

// NEW: Return all results, batch insert
const results = await generateColumnDataBatch(
  fileId, columnId, prompt, model, provider, columnRefs,
  (current, total) => setGenerationProgress({ current, total })
)
```

**Phase 2: Add column to DuckDB table**
```typescript
const addColumn = async (columnData: { name: string, prompt: string, ... }) => {
  const columnId = `col_${Date.now()}`

  // 1. Add column to DuckDB table
  await duckdb.query(`
    ALTER TABLE file_data_${fileId}
    ADD COLUMN "${columnId}" TEXT
  `)

  // 2. Update columns state
  setColumns(prev => [...prev, {
    id: columnId,
    name: columnData.name,
    type: 'string',
    visible: true,
    isAIGenerated: true,
    metadata: { ... }
  }])

  // 3. Start generation (non-blocking)
  generateAIColumn(columnId, columnData)
}
```

**Phase 3: Batch insert AI results**
```typescript
const generateAIColumn = async (columnId: string, columnData: any) => {
  setGeneratingColumn(columnId)

  try {
    // Get total rows for this file
    const countResult = await duckdb.query(`SELECT COUNT(*) as total FROM file_data_${fileId}`)
    const totalRows = countResult[0].total

    // Generate in batches
    const batchSize = 100
    for (let offset = 0; offset < totalRows; offset += batchSize) {
      setGenerationProgress({ current: offset, total: totalRows })

      // Fetch batch of rows with context columns
      const batch = await duckdb.query(`
        SELECT row_index, ${columnData.contextColumns.map(c => `"${c}"`).join(',')}
        FROM file_data_${fileId}
        ORDER BY row_index
        LIMIT ${batchSize} OFFSET ${offset}
      `)

      // Generate AI results for batch
      const results = await Promise.all(
        batch.map(row => generateForRow(row, columnData))
      )

      // Batch update DuckDB
      await duckdb.query(`
        UPDATE file_data_${fileId}
        SET "${columnId}" = result.content
        FROM (SELECT unnest(?) as row_index, unnest(?) as content) r
        WHERE file_data_${fileId}.row_index = r.row_index
      `, [results.map(r => r.rowIndex), results.map(r => r.content)])
    }

    // Refresh current page
    await loadPage(page)

  } finally {
    setGeneratingColumn(null)
  }
}
```

#### Detailed Changes

**`src/components/spreadsheet/SpreadsheetEditor.tsx`**

Replace entire `generateAIColumnData()` function (lines 131-194):

**Key improvements:**
1. No per-cell React state updates
2. Batch DuckDB updates (100 rows at a time)
3. Single page refresh at end
4. Simpler progress tracking

**Simplified loading state:**
```typescript
// OLD: Track every cell
const [loadingCells, setLoadingCells] = useState<Set<string>>(new Set())

// NEW: Track column being generated
const [generatingColumn, setGeneratingColumn] = useState<string | null>(null)

// In UI: Show loading spinner on entire column
{generatingColumn === column.id && <Spinner />}
```

#### Testing Checklist
- [ ] Can add AI column successfully
- [ ] Progress bar updates during generation
- [ ] Batch updates are faster than before
- [ ] Column appears in spreadsheet immediately (empty)
- [ ] Results populate progressively
- [ ] Can navigate pages during generation
- [ ] Generation survives page navigation
- [ ] Error handling works
- [ ] Can cancel generation (bonus)
- [ ] Multiple AI columns can be generated sequentially

#### Success Criteria
- AI column generation is 5-10x faster
- No React state updates during generation (except progress)
- Memory usage stays constant
- Can generate columns for 100k+ row files
- UI remains responsive during generation

#### Performance Expectations
- 100 rows: ~5s (was ~10s)
- 1k rows: ~30s (was ~2min)
- 10k rows: ~5min (was would crash)

---

### Feature 5: Embedding Storage Migration
**Priority:** HIGH - Required for visualization
**Estimated Complexity:** High
**Dependencies:** Feature 1
**Status:** Not started

#### Objectives
1. Store embeddings in DuckDB tables instead of IndexedDB/OPFS
2. Store embedding layers in `embedding_layers` table
3. Store embedding points in `embedding_points` table
4. Remove entire OPFS layer switching complexity
5. Enable instant layer switching with SQL queries

#### Files to Modify
- `src/lib/embedding/storage.ts` ⭐ PRIMARY (almost complete rewrite)
- `src/components/embedding-viewer/agent-trace-viewer.tsx` (integration points)
- `src/components/embedding-viewer/embedding-wizard.tsx` (verify compatibility)

#### Files to Analyze for Removal

**`src/lib/embedding/storage.ts`** - Remove ENTIRELY:
- `EmbeddingStorageDB` class (lines 48-217) - full IndexedDB implementation
- `OperationQueue` class (lines 14-44) - DuckDB handles this
- `OPFSManager` class (lines 222-269) - no longer needed
- `switchEmbeddingLayer()` function (lines 274-295) - complex OPFS logic
- All IndexedDB constants (DB_NAME, EMBEDDING_STORE, etc.)

**Keep but refactor:**
- `generateEmbeddingId()` function (line 298) - still useful
- Type imports from `@/types/embedding`

#### Implementation Strategy

**Phase 1: Create new DuckDB-based storage class**

Create new file: `src/lib/embedding/storage-duckdb.ts`
```typescript
export class EmbeddingStorage {
  // Save embedding layer
  async saveLayer(layer: ActiveEmbeddingLayer): Promise<void>

  // Get active layer for file
  async getActiveLayer(fileId: string): Promise<ActiveEmbeddingLayer | null>

  // Get all layer metadata for file
  async getLayerMetadata(fileId: string): Promise<EmbeddingLayerMetadata[]>

  // Switch active layer (simple UPDATE query)
  async setActiveLayer(fileId: string, layerId: string): Promise<void>

  // Delete layer
  async deleteLayer(layerId: string): Promise<void>
}
```

**Phase 2: Implement layer storage**
```typescript
async saveLayer(layer: ActiveEmbeddingLayer): Promise<void> {
  const db = await getDuckDB()
  const conn = await db.connect()

  try {
    // Start transaction
    await conn.query('BEGIN TRANSACTION')

    // 1. Insert layer metadata
    await conn.query(`
      INSERT INTO embedding_layers
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      layer.id, layer.fileId, layer.name, layer.provider,
      layer.model, layer.dimension, layer.compositionMode,
      JSON.stringify(layer.compositionConfig),
      layer.createdAt, layer.lastAccessedAt, true
    ])

    // 2. Insert points (batch)
    const batchSize = 1000
    for (let i = 0; i < layer.points.length; i += batchSize) {
      const batch = layer.points.slice(i, i + batchSize)
      await conn.query(`
        INSERT INTO embedding_points
        SELECT * FROM read_json_auto(?)
      `, [JSON.stringify(batch.map(p => ({
        layer_id: layer.id,
        point_id: p.id,
        embedding: p.embedding,
        coordinates_2d: p.coordinates2D,
        composed_text: p.composedText,
        label: p.label,
        source_row_indices: p.sourceRowIndices
      })))])
    }

    // 3. Mark all other layers as inactive
    await conn.query(`
      UPDATE embedding_layers
      SET is_active = FALSE
      WHERE file_id = ? AND id != ?
    `, [layer.fileId, layer.id])

    await conn.query('COMMIT')
  } catch (error) {
    await conn.query('ROLLBACK')
    throw error
  } finally {
    await conn.close()
  }
}
```

**Phase 3: Implement layer retrieval**
```typescript
async getActiveLayer(fileId: string): Promise<ActiveEmbeddingLayer | null> {
  const db = await getDuckDB()
  const conn = await db.connect()

  // Get layer metadata
  const layers = await conn.query(`
    SELECT * FROM embedding_layers
    WHERE file_id = ? AND is_active = TRUE
  `, [fileId])

  if (layers.length === 0) return null

  const layer = layers[0]

  // Get points
  const points = await conn.query(`
    SELECT * FROM embedding_points
    WHERE layer_id = ?
    ORDER BY point_id
  `, [layer.id])

  await conn.close()

  return {
    id: layer.id,
    fileId: layer.file_id,
    name: layer.name,
    provider: layer.provider,
    model: layer.model,
    dimension: layer.dimension,
    compositionMode: layer.composition_mode,
    compositionConfig: JSON.parse(layer.composition_config),
    points: points.map(p => ({
      id: p.point_id,
      embedding: p.embedding,
      coordinates2D: p.coordinates_2d,
      composedText: p.composed_text,
      label: p.label,
      sourceRowIndices: p.source_row_indices
    })),
    createdAt: layer.created_at,
    lastAccessedAt: layer.last_accessed_at
  }
}
```

**Phase 4: Simplify layer switching**
```typescript
// OLD: Complex OPFS file moving (lines 274-295)
async function switchEmbeddingLayer(fileId: string, newLayerId: string): Promise<void> {
  const currentLayer = await embeddingDB.getActiveEmbeddingLayer(fileId)
  if (currentLayer) {
    await opfsManager.saveLayerToOPFS(currentLayer)
    await embeddingDB.deleteActiveEmbeddingLayer(currentLayer.id)
  }
  const newLayer = await opfsManager.loadLayerFromOPFS(newLayerId)
  await embeddingDB.setActiveEmbeddingLayer(newLayer)
  await embeddingDB.updateActiveLayer(fileId, newLayerId)
}

// NEW: Simple SQL UPDATE
async setActiveLayer(fileId: string, layerId: string): Promise<void> {
  const db = await getDuckDB()
  const conn = await db.connect()

  await conn.query(`
    UPDATE embedding_layers
    SET is_active = CASE WHEN id = ? THEN TRUE ELSE FALSE END
    WHERE file_id = ?
  `, [layerId, fileId])

  await conn.close()
}
```

#### Detailed Changes

**`src/lib/embedding/storage.ts`** - Complete rewrite

New structure:
```typescript
// Remove all IndexedDB/OPFS code
// Replace with DuckDB operations

export class EmbeddingStorage {
  async saveLayer(...) { /* DuckDB */ }
  async getActiveLayer(...) { /* DuckDB */ }
  async getLayerMetadata(...) { /* DuckDB */ }
  async setActiveLayer(...) { /* DuckDB */ }
  async deleteLayer(...) { /* DuckDB */ }
}

export const embeddingStorage = new EmbeddingStorage()
export { generateEmbeddingId } // Keep utility
```

**`src/components/embedding-viewer/agent-trace-viewer.tsx`**

Update storage calls:
```typescript
// OLD:
import { embeddingDB, switchEmbeddingLayer } from '@/lib/embedding/storage'

// NEW:
import { embeddingStorage } from '@/lib/embedding/storage-duckdb'

// Update all method calls
const metadata = await embeddingStorage.getLayerMetadata(fileId)
const active = await embeddingStorage.getActiveLayer(fileId)
await embeddingStorage.setActiveLayer(fileId, layerId)
```

#### Testing Checklist
- [ ] Can save embedding layer to DuckDB
- [ ] Can retrieve active layer
- [ ] Can get layer metadata list
- [ ] Layer switching is instant (<100ms)
- [ ] Can delete layer (cascades to points)
- [ ] Multiple layers per file work
- [ ] Layer data integrity maintained
- [ ] No OPFS code remains
- [ ] No IndexedDB code remains
- [ ] Migration script works for existing layers

#### Success Criteria
- All embeddings stored in DuckDB
- Layer switching is instant (was ~2s with OPFS)
- No file system operations
- Can store 1M+ points per layer
- Query performance is good

#### Performance Expectations
- Save layer (10k points): ~500ms (was ~2s)
- Load layer: ~300ms (was ~1.5s)
- Switch layer: ~50ms (was ~2s)
- List metadata: ~10ms (was ~100ms)

---

### Feature 6: Embedding Visualization with embedding-atlas
**Priority:** HIGH - Core visualization feature
**Estimated Complexity:** Medium
**Dependencies:** Feature 5, Feature 0 (Mosaic coordinator)
**Status:** Not started

#### Objectives
1. Replace canvas fallback with embedding-atlas component
2. Initialize Mosaic coordinator with DuckDB connection
3. Configure embedding-atlas to query DuckDB directly
4. Enable WebGPU rendering for millions of points
5. Remove all canvas rendering code

#### Files to Modify
- `src/components/embedding-viewer/embedding-visualization.tsx` ⭐ PRIMARY (complete rewrite)
- `src/components/embedding-viewer/agent-trace-viewer.tsx` (integration)

#### Files to Analyze for Removal

**`src/components/embedding-viewer/embedding-visualization.tsx`** - Remove ENTIRELY:
- Entire `renderFallbackVisualization()` function (lines 36-107)
- Canvas creation and rendering (lines 39-79)
- Manual click handling (lines 82-106)
- Coordinate normalization logic

**Keep:**
- Component props interface (lines 11-14)
- useEffect cleanup (lines 28-32)

#### Implementation Strategy

**Phase 1: Set up Mosaic coordinator**
```typescript
import { wasmConnector } from '@uwdata/mosaic-core'

// Initialize once globally or per file
const coordinator = wasmConnector()
```

**Phase 2: Configure DuckDB connection for Mosaic**
```typescript
// Mosaic needs to connect to the same DuckDB instance
// Option 1: Use existing DuckDB instance
coordinator.databaseConnector(getDuckDB())

// Option 2: Let Mosaic create its own connection (verify if this works)
```

**Phase 3: Implement embedding-atlas component**
```typescript
import { EmbeddingAtlas } from 'embedding-atlas/react'

<EmbeddingAtlas
  coordinator={coordinator}
  data={{
    table: 'embedding_points',
    id: 'point_id',
    projection: {
      x: 'coordinates_2d[1]',  // DuckDB array syntax
      y: 'coordinates_2d[2]'
    },
    text: 'composed_text'
  }}
  filterBy="layer_id"
  filterValue={layer.id}
  onClick={(point) => onPointClick(point)}
  width="100%"
  height="100%"
/>
```

**Phase 4: Handle point click events**
```typescript
// embedding-atlas returns point data
// Map to EmbeddingPoint interface
const handleAtlasClick = (atlasPoint: any) => {
  const embeddingPoint: EmbeddingPoint = {
    id: atlasPoint.point_id,
    embedding: atlasPoint.embedding,
    coordinates2D: [atlasPoint.coordinates_2d[0], atlasPoint.coordinates_2d[1]],
    composedText: atlasPoint.composed_text,
    label: atlasPoint.label,
    sourceRowIndices: atlasPoint.source_row_indices
  }
  onPointClick(embeddingPoint)
}
```

#### Detailed Changes

**`src/components/embedding-viewer/embedding-visualization.tsx`** - Complete rewrite

New implementation:
```typescript
'use client';

import { useEffect, useState, useMemo } from 'react';
import { EmbeddingAtlas } from 'embedding-atlas/react';
import { wasmConnector } from '@uwdata/mosaic-core';
import type { ActiveEmbeddingLayer, EmbeddingPoint } from '@/types/embedding';
import { getDuckDB } from '@/lib/duckdb/client';

interface EmbeddingVisualizationProps {
  layer: ActiveEmbeddingLayer;
  onPointClick: (point: EmbeddingPoint) => void;
}

export function EmbeddingVisualization({ layer, onPointClick }: EmbeddingVisualizationProps) {
  const [coordinator, setCoordinator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Mosaic coordinator
  useEffect(() => {
    const initCoordinator = async () => {
      try {
        setLoading(true);

        // Get DuckDB instance
        const db = await getDuckDB();

        // Create Mosaic coordinator with WASM connector
        const coord = wasmConnector({ duckdb: db });

        setCoordinator(coord);
      } catch (err) {
        console.error('Error initializing coordinator:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setLoading(false);
      }
    };

    initCoordinator();
  }, []);

  // Handle point clicks
  const handleClick = useMemo(() => (atlasPoint: any) => {
    const embeddingPoint: EmbeddingPoint = {
      id: atlasPoint.point_id,
      embedding: atlasPoint.embedding,
      coordinates2D: atlasPoint.coordinates_2d,
      composedText: atlasPoint.composed_text,
      label: atlasPoint.label,
      sourceRowIndices: atlasPoint.source_row_indices
    };
    onPointClick(embeddingPoint);
  }, [onPointClick]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading visualization...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-destructive">Error: {error}</p>
      </div>
    );
  }

  if (!coordinator) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ minHeight: '400px' }}>
      <EmbeddingAtlas
        coordinator={coordinator}
        data={{
          table: 'embedding_points',
          id: 'point_id',
          projection: {
            x: 'coordinates_2d[1]',
            y: 'coordinates_2d[2]'
          },
          text: 'composed_text'
        }}
        filterBy="layer_id"
        filterValue={layer.id}
        onClick={handleClick}
        width="100%"
        height="100%"
        colorBy="label"  // Optional: color by conversation ID
      />
    </div>
  );
}
```

#### Testing Checklist
- [ ] embedding-atlas renders without errors
- [ ] Can see all points from active layer
- [ ] Point colors render correctly
- [ ] Click on point triggers detail panel
- [ ] Zoom/pan works smoothly
- [ ] Can handle 10k+ points without lag
- [ ] Can handle 100k+ points (WebGPU)
- [ ] Fallback to WebGL if WebGPU unavailable
- [ ] No canvas code remains
- [ ] No console errors

#### Success Criteria
- embedding-atlas component renders successfully
- Visualization performs better than canvas fallback
- Can visualize 1M+ points smoothly
- WebGPU acceleration works
- No custom rendering code remains

#### Performance Expectations
- Initial render (10k points): < 500ms
- Initial render (100k points): < 2s
- Zoom/pan: 60 FPS
- Point selection: < 50ms
- Memory: Scales linearly with points

---

### Feature 7: Cross-Feature Integration & Search
**Priority:** PARKED - Future implementation
**Estimated Complexity:** High
**Dependencies:** Features 3, 6
**Status:** PARKED FOR FUTURE IMPLEMENTATION

> **Note:** This feature is parked and will not be implemented in the current migration phase. Focus is on core DuckDB migration (Features 0-6) first. Cross-filtering and advanced search can be added in a future iteration after the foundation is solid.

#### Objectives
1. Enable cross-filtering between spreadsheet and embeddings
2. Add vector similarity search
3. Add full-text search across all data
4. Implement analytical queries (aggregations, etc.)
5. Optimize query performance

#### Files to Modify
- `src/components/spreadsheet/SpreadsheetEditor.tsx`
- `src/components/embedding-viewer/agent-trace-viewer.tsx`
- Create: `src/lib/duckdb/search.ts`
- Create: `src/lib/duckdb/analytics.ts`

#### Files to Analyze for Removal
- `src/lib/format-parser.ts`:
  - Check if `flattenCache` is still needed (line 38)
  - Check if LRU caching is redundant with DuckDB
  - Simplify if only used for initial import

#### Implementation Strategy

**Phase 1: Shared Mosaic coordinator**

Create singleton coordinator that both components share:
```typescript
// src/lib/mosaic/coordinator.ts
let globalCoordinator: any = null

export async function getGlobalCoordinator() {
  if (globalCoordinator) return globalCoordinator

  const db = await getDuckDB()
  globalCoordinator = wasmConnector({ duckdb: db })
  return globalCoordinator
}
```

**Phase 2: Spreadsheet cross-filtering**

Add filter state that syncs with embeddings:
```typescript
const [embeddingFilter, setEmbeddingFilter] = useState<string | null>(null)

// When embedding point clicked, filter spreadsheet
const handleEmbeddingPointClick = (point: EmbeddingPoint) => {
  // Get source rows for this point
  const rowIndices = point.sourceRowIndices

  // Filter spreadsheet to show only these rows
  setEmbeddingFilter(`row_index IN (${rowIndices.join(',')})`)
}

// Apply filter in query
const pageData = await queryFileData(fileId, {
  where: embeddingFilter,
  ...otherOptions
})
```

**Phase 3: Vector similarity search**
```typescript
// src/lib/duckdb/search.ts
export async function findSimilarPoints(
  layerId: string,
  queryEmbedding: number[],
  topK: number = 10
): Promise<EmbeddingPoint[]> {
  const db = await getDuckDB()
  const conn = await db.connect()

  const results = await conn.query(`
    SELECT
      point_id,
      embedding,
      coordinates_2d,
      composed_text,
      label,
      source_row_indices,
      array_cosine_similarity(embedding, ?) as similarity
    FROM embedding_points
    WHERE layer_id = ?
    ORDER BY similarity DESC
    LIMIT ?
  `, [queryEmbedding, layerId, topK])

  await conn.close()
  return results.map(r => ({ /* map to EmbeddingPoint */ }))
}
```

**Phase 4: Full-text search**
```typescript
// Enable FTS extension (if available in DuckDB WASM)
await conn.query(`INSTALL fts; LOAD fts;`)

// Create FTS index
await conn.query(`
  CREATE INDEX fts_idx ON file_data_${fileId}
  USING FTS(column1, column2, ...)
`)

// Search
const results = await conn.query(`
  SELECT * FROM file_data_${fileId}
  WHERE fts_search(column1, ?)
`, [searchQuery])
```

**Phase 5: Analytical queries**
```typescript
// src/lib/duckdb/analytics.ts

// Aggregate by category
export async function aggregateByColumn(
  fileId: string,
  groupByColumn: string,
  aggregateColumn: string,
  aggregateFunction: 'COUNT' | 'AVG' | 'SUM' | 'MIN' | 'MAX'
): Promise<any[]> {
  const query = `
    SELECT
      "${groupByColumn}",
      ${aggregateFunction}("${aggregateColumn}") as value
    FROM file_data_${fileId}
    GROUP BY "${groupByColumn}"
    ORDER BY value DESC
  `
  return await queryFileData(fileId, { customQuery: query })
}

// Time-series analysis
export async function timeSeriesAnalysis(
  fileId: string,
  timeColumn: string,
  valueColumn: string,
  interval: 'hour' | 'day' | 'week' | 'month'
): Promise<any[]> {
  const query = `
    SELECT
      date_trunc('${interval}', "${timeColumn}"::TIMESTAMP) as time_bucket,
      COUNT(*) as count,
      AVG("${valueColumn}") as avg_value
    FROM file_data_${fileId}
    GROUP BY time_bucket
    ORDER BY time_bucket
  `
  return await queryFileData(fileId, { customQuery: query })
}
```

#### Testing Checklist
- [ ] Click embedding point filters spreadsheet
- [ ] Click spreadsheet row highlights embedding point
- [ ] Vector similarity search works
- [ ] Full-text search works across columns
- [ ] Aggregation queries work
- [ ] Performance is acceptable for 100k+ rows
- [ ] Cross-filtering is bidirectional
- [ ] Clear filter button works

#### Success Criteria
- Seamless cross-filtering between all views
- Vector search returns relevant results
- Full-text search is fast (<1s)
- Analytical queries work on large datasets

---

### Feature 8: Data Export & Optimization
**Priority:** LOW - Polish features
**Estimated Complexity:** Low
**Dependencies:** All previous features
**Status:** Not started

#### Objectives
1. Export data in multiple formats (CSV, Parquet, JSON)
2. Export embeddings for external use
3. Optimize DuckDB queries with indexes
4. Add query performance monitoring
5. Implement data backup/restore

#### Files to Create
- `src/lib/duckdb/export.ts`
- `src/lib/duckdb/performance.ts`
- `src/lib/duckdb/backup.ts`

#### Implementation Strategy

**Phase 1: Export functionality**
```typescript
// src/lib/duckdb/export.ts

export async function exportToCSV(fileId: string, fileName: string): Promise<void> {
  const db = await getDuckDB()
  const conn = await db.connect()

  // Export to CSV
  await conn.query(`
    COPY file_data_${fileId}
    TO '${fileName}.csv'
    (HEADER, DELIMITER ',')
  `)

  // Download file
  const blob = await conn.copyFileToBlob(`${fileName}.csv`)
  downloadBlob(blob, `${fileName}.csv`)

  await conn.close()
}

export async function exportToParquet(fileId: string, fileName: string): Promise<void> {
  const db = await getDuckDB()
  const conn = await db.connect()

  // Export to Parquet (much more efficient than CSV)
  await conn.query(`
    COPY file_data_${fileId}
    TO '${fileName}.parquet'
    (FORMAT PARQUET, COMPRESSION SNAPPY)
  `)

  const blob = await conn.copyFileToBlob(`${fileName}.parquet`)
  downloadBlob(blob, `${fileName}.parquet`)

  await conn.close()
}

export async function exportEmbeddings(layerId: string): Promise<void> {
  // Export embeddings in format compatible with embedding-atlas
  const db = await getDuckDB()
  const conn = await db.connect()

  await conn.query(`
    COPY (
      SELECT
        point_id as id,
        embedding,
        coordinates_2d[1] as x,
        coordinates_2d[2] as y,
        composed_text as text,
        label
      FROM embedding_points
      WHERE layer_id = ?
    ) TO 'embeddings.parquet' (FORMAT PARQUET)
  `, [layerId])

  await conn.close()
}
```

**Phase 2: Performance optimization**
```typescript
// src/lib/duckdb/performance.ts

export async function addIndexes(fileId: string): Promise<void> {
  const db = await getDuckDB()
  const conn = await db.connect()

  // Analyze table to get statistics
  await conn.query(`ANALYZE file_data_${fileId}`)

  // Add indexes on commonly queried columns
  await conn.query(`
    CREATE INDEX idx_file_data_${fileId}_timestamp
    ON file_data_${fileId}(timestamp)
  `)

  await conn.close()
}

export async function explainQuery(query: string): Promise<string> {
  const db = await getDuckDB()
  const conn = await db.connect()

  const result = await conn.query(`EXPLAIN ${query}`)
  await conn.close()

  return result[0].explain_value
}
```

**Phase 3: Backup & restore**
```typescript
// src/lib/duckdb/backup.ts

export async function backupDatabase(): Promise<Blob> {
  const db = await getDuckDB()
  const conn = await db.connect()

  // Export entire database to single file
  await conn.query(`EXPORT DATABASE 'backup' (FORMAT PARQUET)`)

  // Create zip of all exported files
  const blob = await conn.copyFileToBlob('backup.zip')

  await conn.close()
  return blob
}

export async function restoreDatabase(backupBlob: Blob): Promise<void> {
  const db = await getDuckDB()
  const conn = await db.connect()

  // Register blob as file
  await conn.registerFileHandle('backup.zip', backupBlob)

  // Import database
  await conn.query(`IMPORT DATABASE 'backup'`)

  await conn.close()
}
```

#### Testing Checklist
- [ ] Can export to CSV
- [ ] Can export to Parquet
- [ ] Can export embeddings
- [ ] Exported files are valid
- [ ] Indexes improve query performance
- [ ] EXPLAIN shows index usage
- [ ] Backup creates valid file
- [ ] Restore works from backup
- [ ] Performance monitoring works

#### Success Criteria
- Export functionality works for all formats
- Parquet export is significantly faster than CSV
- Indexes provide measurable speedup
- Backup/restore is reliable

---

## Testing Strategy

### Per-Feature Testing

Each feature should include:

1. **Unit Tests**
   - DuckDB operations in isolation
   - Mock data generation
   - Error handling

2. **Integration Tests**
   - Full data flow (upload → query → display)
   - Cross-component interactions
   - State management

3. **Performance Tests**
   - Benchmark before/after migration
   - Test with various data sizes (1k, 10k, 100k, 1M rows)
   - Memory usage profiling

4. **Manual Testing Checklist**
   - Browser: Chrome, Firefox, Safari
   - Data formats: All 5 supported formats
   - Edge cases: Empty files, very large files, special characters

### Regression Testing

After each feature:
- Run full test suite
- Verify no existing functionality broken
- Check for memory leaks (DevTools)
- Verify bundle size hasn't increased significantly

---

## Migration Strategy

### Dual-Write Approach (Recommended)

For critical features (File Storage, Embedding Storage), use temporary dual-write:

**Phase 1:** Write to both IndexedDB and DuckDB
**Phase 2:** Read from DuckDB, verify correctness
**Phase 3:** Remove IndexedDB writes
**Phase 4:** Remove IndexedDB code entirely

### Migration Script

Create user-facing migration tool:
```typescript
// src/lib/duckdb/migrate.ts

export async function migrateFromIndexedDB(
  onProgress: (message: string, percent: number) => void
): Promise<void> {
  onProgress('Starting migration...', 0)

  // 1. Migrate files
  const files = await getAllFilesFromIndexedDB()
  for (let i = 0; i < files.length; i++) {
    onProgress(`Migrating file ${i+1}/${files.length}`, (i / files.length) * 50)
    await migrateFile(files[i])
  }

  // 2. Migrate embeddings
  const layers = await getAllEmbeddingLayersFromIndexedDB()
  for (let i = 0; i < layers.length; i++) {
    onProgress(`Migrating embedding ${i+1}/${layers.length}`, 50 + (i / layers.length) * 50)
    await migrateEmbeddingLayer(layers[i])
  }

  onProgress('Migration complete!', 100)
}
```

Add migration UI in settings or on first load after update.

---

## Rollback Plan

For each feature, maintain ability to rollback:

1. **Feature Flags**
   ```typescript
   const USE_DUCKDB = process.env.NEXT_PUBLIC_USE_DUCKDB === 'true'
   ```

2. **Version Tracking**
   - Store schema version in DuckDB
   - Detect version mismatches
   - Prompt user to update

3. **Emergency Fallback**
   - Keep IndexedDB code in separate files
   - Can quickly revert via feature flag
   - Export data before major changes

---

## Documentation Requirements

For each feature, create:

1. **Implementation Doc** (this plan)
2. **API Documentation** (JSDoc for new functions)
3. **User Guide** (how to use new features)
4. **Migration Guide** (for existing users)
5. **Performance Report** (benchmarks before/after)

---

## Success Metrics

### Technical Metrics
- [ ] All features migrated to DuckDB
- [ ] No IndexedDB code remains
- [ ] embedding-atlas component working
- [ ] All tests passing
- [ ] No performance regressions
- [ ] Bundle size < 15MB (currently ~12MB)

### Performance Metrics
- [ ] Spreadsheet load time: < 200ms (currently ~800ms)
- [ ] Page navigation: < 50ms (currently N/A)
- [ ] AI column generation: 5-10x faster
- [ ] Embedding visualization: 1M+ points supported
- [ ] Layer switching: < 100ms (currently ~2s)

### User Experience Metrics
- [ ] No data loss during migration
- [ ] All features work as before
- [ ] New analytical capabilities enabled
- [ ] No increase in error rates
- [ ] User feedback positive

---

## Timeline Estimates (for Agentic Coder)

| Feature | Complexity | Estimated Time |
|---------|-----------|----------------|
| 0. Foundation | Medium | 4-6 hours |
| 1. File Storage | High | 8-10 hours |
| 2. Sidebar | Low | 2-3 hours |
| 3. Spreadsheet + Sort/Filter | High | 10-12 hours |
| 4. AI Columns | Medium | 4-6 hours |
| 5. Embedding Storage | High | 6-8 hours |
| 6. Visualization | Medium | 4-6 hours |
| 7. Cross-filtering | PARKED | Future |
| 8. Export/Optimization | Low | 3-4 hours |
| **Total** | | **43-59 hours** |

Note: These are implementation estimates. Add 50% for testing and debugging.

---

## Risks & Mitigations

### High Risk

**Risk:** Breaking existing functionality
**Mitigation:**
- Feature flags for gradual rollout
- Dual-write during transition
- Comprehensive testing before removing old code

**Risk:** Data loss during migration
**Mitigation:**
- Export all IndexedDB data before migration
- Validate data integrity after each step
- Keep backups in OPFS

**Risk:** Webpack/WASM configuration issues
**Mitigation:**
- Research existing Next.js + DuckDB examples
- Test in all target browsers early
- Have fallback non-threaded mode

### Medium Risk

**Risk:** Performance worse than expected
**Mitigation:**
- Benchmark early and often
- Profile with DevTools
- Add indexes strategically
- Consider query optimization

**Risk:** embedding-atlas integration issues
**Mitigation:**
- Test with small dataset first
- Verify Mosaic coordinator setup
- Check embedding-atlas documentation/examples

### Low Risk

**Risk:** Type system complexity
**Mitigation:**
- Use `any` temporarily if needed
- Refine types iteratively
- Generate types from schema if possible

---

## Next Steps

1. **Review this plan** - Ensure all features are covered
2. **Prioritize features** - Confirm dependency order
3. **Set up development environment** - Install any missing tools
4. **Start with Feature 0** - Foundation is critical
5. **Test incrementally** - Don't move to next feature until current one works
6. **Document as you go** - Update this plan with learnings

---

## Questions for Research (Before Implementation)

1. **DuckDB WASM + Next.js**
   - Exact webpack configuration needed?
   - How to handle workers in App Router?
   - OPFS persistence setup?

2. **Mosaic Coordinator**
   - How to share coordinator across components?
   - Can it connect to existing DuckDB instance?
   - Configuration options?

3. **embedding-atlas**
   - Exact data format expected?
   - How to handle large point counts?
   - Customization options (colors, sizes, etc.)?

4. **Dynamic Tables**
   - Best practice for `file_data_{id}` pattern?
   - How to handle schema differences?
   - Performance implications?

5. **Array Types**
   - Does DuckDB WASM support `FLOAT[]`?
   - Array operation performance?
   - Alternative to arrays for embeddings?

---

## Appendix: File Inventory

### Files to Modify (23 total)
1. `next.config.ts`
2. `src/hooks/use-file-storage.ts`
3. `src/lib/format-parser.ts`
4. `src/app/page.tsx`
5. `src/components/app-sidebar.tsx`
6. `src/components/spreadsheet/SpreadsheetEditor.tsx`
7. `src/components/spreadsheet/SpreadsheetTable.tsx`
8. `src/components/spreadsheet/AddColumnModal.tsx`
9. `src/app/edit/[fileId]/page.tsx`
10. `src/lib/ai-inference.ts`
11. `src/lib/embedding/storage.ts`
12. `src/lib/embedding/text-composer.ts`
13. `src/lib/embedding/batch-embedder.ts`
14. `src/lib/embedding/umap-reducer.ts`
15. `src/components/embedding-viewer/agent-trace-viewer.tsx`
16. `src/components/embedding-viewer/embedding-wizard.tsx`
17. `src/components/embedding-viewer/embedding-visualization.tsx`

### Files to Create (10 total)
1. `src/lib/duckdb/client.ts`
2. `src/lib/duckdb/schema.ts`
3. `src/lib/duckdb/operations.ts`
4. `src/lib/duckdb/types.ts`
5. `src/lib/duckdb/query-builder.ts`
6. `src/lib/duckdb/export.ts`
7. `src/lib/duckdb/performance.ts`
8. `src/lib/duckdb/backup.ts`
9. `src/lib/mosaic/coordinator.ts`
10. `src/lib/embedding/storage-duckdb.ts`

**Removed from initial scope:**
- ~~`src/lib/duckdb/migration.ts`~~ - Starting fresh with DuckDB, no IndexedDB migration
- ~~`src/lib/duckdb/search.ts`~~ - Feature 7 (parked)
- ~~`src/lib/duckdb/analytics.ts`~~ - Feature 7 (parked)

### Major Code Removal (estimated LOC)
- `src/hooks/use-file-storage.ts`: ~200 lines (IndexedDB class)
- `src/lib/embedding/storage.ts`: ~270 lines (entire file almost)
- `src/components/embedding-viewer/embedding-visualization.tsx`: ~70 lines (canvas code)
- **Total**: ~540 lines removed, ~1200 lines added (net +660 lines)

---

## Conclusion

This migration will transform FluffyViz from a basic file viewer to a powerful analytical tool by:

1. ✅ **Unlocking the embedded dependencies** - Actually using DuckDB and embedding-atlas that are already bundled
2. ✅ **Enabling analytical queries** - SQL filtering, sorting, aggregation
3. ✅ **Scaling to larger datasets** - 100k-1M+ rows instead of 10k limit
4. ✅ **Improving performance** - 10x faster for most operations
5. ✅ **Adding advanced features** - Vector search, cross-filtering, real-time visualization

The migration is substantial but well-structured. Each feature builds on previous ones, testing happens incrementally, and rollback is possible at each step.

**Recommendation:** Proceed with implementation, starting with Feature 0 (Foundation), and work through features in order. Test thoroughly at each step before moving to the next feature.

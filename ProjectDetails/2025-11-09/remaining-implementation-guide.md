# Remaining Implementation Guide - Final 40%

**Status:** Core infrastructure complete (60%). This guide details the remaining implementation.

## ✅ Already Completed

1. **Error Classification** (`ai-inference.ts`) ✅
   - Added `classifyError` function with dual detection
   - Updated all inference functions to return `errorType`
   - Integrated with `InferenceResult` interface

2. **Column Stats Calculation** (`SpreadsheetEditor.tsx`) ✅
   - Added `columnStats` useMemo hook
   - Calculates failed, edited, pending, succeeded counts per column

3. **Metadata Loading** (`SpreadsheetEditor.tsx`) ✅
   - Updated data loading to use `queryFileDataWithMetadata`
   - Loads column metadata and enriches column objects
   - Filters out `__meta` columns from display

4. **Column Metadata Saving** (`SpreadsheetEditor.tsx`) ✅
   - `addColumn` now saves to `column_metadata` table
   - Sets `columnType = 'ai-generated'`

## 🔨 Remaining Tasks

### Task 1: Update generateAIColumnData to save cell metadata

**Location:** `SpreadsheetEditor.tsx`, `generateAIColumnData` function

**Current code around line 380:**
```typescript
(rowIndex, result) => {
  // Update cell as soon as it completes
  // Ensure LLM response is stored as plain string (prevent any parsing)
  const cellValue = String(result.content || result.error || '[Error]')

  // Track for DuckDB batch update
  const dbRowIndex = data[rowIndex]?.row_index ?? rowIndex
  generatedValues.push({ rowIndex: dbRowIndex, value: cellValue })

  setData(prev => {
    const updated = [...prev]
    updated[rowIndex] = {
      ...updated[rowIndex],
      [column.id]: cellValue
    }
    return updated
  })

  // Remove from loading set
  setLoadingCells(prev => {
    const next = new Set(prev)
    next.delete(`${rowIndex}-${column.id}`)
    return next
  })
}
```

**Update to:**
```typescript
(rowIndex, result) => {
  // Update cell as soon as it completes
  const cellValue = String(result.content || result.error || '[Error]')
  const dbRowIndex = data[rowIndex]?.row_index ?? rowIndex

  // Track for DuckDB batch update
  generatedValues.push({ rowIndex: dbRowIndex, value: cellValue })

  // Prepare cell metadata
  const cellMeta: CellMetadata = {
    fileId,
    columnId: column.id,
    rowIndex: dbRowIndex,
    status: result.error ? 'failed' : 'success',
    error: result.error,
    errorType: result.errorType,
    edited: false,
    lastEditTime: undefined
  }

  // Save cell metadata immediately
  saveCellMetadata(cellMeta).catch(err =>
    console.error('[SpreadsheetEditor] Failed to save cell metadata:', err)
  )

  // Update in-memory state with metadata
  setData(prev => {
    const updated = [...prev]
    updated[rowIndex] = {
      ...updated[rowIndex],
      [column.id]: cellValue,
      [`${column.id}__meta`]: {
        status: cellMeta.status,
        error: cellMeta.error,
        errorType: cellMeta.errorType,
        edited: false
      }
    }
    return updated
  })

  // Remove from loading set
  setLoadingCells(prev => {
    const next = new Set(prev)
    next.delete(`${rowIndex}-${column.id}`)
    return next
  })
}
```

### Task 2: Update updateCellValue to track edits

**Location:** `SpreadsheetEditor.tsx`, `updateCellValue` function

**Current code around line 420:**
```typescript
const updateCellValue = async (rowIndex: number, columnId: string, value: any) => {
  // Update in-memory state
  setData(prev =>
    prev.map((row, index) =>
      index === rowIndex
        ? { ...row, [columnId]: value }
        : row
    )
  )

  // Persist to DuckDB
  try {
    const dbRowIndex = data[rowIndex]?.row_index ?? rowIndex
    await updateCellInDuckDB(fileId, dbRowIndex, columnId, value)
    console.log(`[SpreadsheetEditor] Cell [${dbRowIndex}, ${columnId}] updated in DuckDB`)
  } catch (error) {
    console.error('[SpreadsheetEditor] Failed to update cell in DuckDB:', error)
  }
}
```

**Update to:**
```typescript
const updateCellValue = async (rowIndex: number, columnId: string, value: any) => {
  const column = columns.find(c => c.id === columnId)
  const currentMeta = data[rowIndex]?.[`${columnId}__meta`] as CellMetadata | undefined

  // Update in-memory state
  setData(prev =>
    prev.map((row, index) => {
      if (index !== rowIndex) return row

      const updated: any = { ...row, [columnId]: value }

      // If AI column and has existing value, mark as edited
      if (column?.columnType === 'ai-generated' && currentMeta?.status === 'success') {
        updated[`${columnId}__meta`] = {
          ...currentMeta,
          edited: true,
          originalValue: currentMeta.edited ? currentMeta.originalValue : row[columnId],
          lastEditTime: Date.now()
        }
      }

      return updated
    })
  )

  // Persist to DuckDB
  try {
    const dbRowIndex = data[rowIndex]?.row_index ?? rowIndex
    await updateCellInDuckDB(fileId, dbRowIndex, columnId, value)

    // Update cell metadata if AI column
    if (column?.columnType === 'ai-generated' && currentMeta?.status === 'success') {
      await saveCellMetadata({
        fileId,
        columnId,
        rowIndex: dbRowIndex,
        status: 'success',
        error: currentMeta.error,
        errorType: currentMeta.errorType,
        edited: true,
        originalValue: currentMeta.edited ? currentMeta.originalValue : data[rowIndex]?.[columnId],
        lastEditTime: Date.now()
      })
    }

    console.log(`[SpreadsheetEditor] Cell [${dbRowIndex}, ${columnId}] updated in DuckDB`)
  } catch (error) {
    console.error('[SpreadsheetEditor] Failed to update cell in DuckDB:', error)
  }
}
```

### Task 3: Add retry orchestration functions

**Location:** `SpreadsheetEditor.tsx`, after `clearAllFilters` function

**Add these functions:**

```typescript
// Open retry modal for a column
const handleOpenRetryModal = (column: Column) => {
  setSelectedRetryColumn(column)
  setIsRetryModalOpen(true)
}

// Get few-shot examples from edited cells
const getFewShotExamples = async (columnId: string): Promise<FewShotExample[]> => {
  const cellMeta = await getColumnCellMetadata(fileId, columnId)

  const editedCells = cellMeta
    .filter(m => m.edited && m.originalValue)
    .map(m => {
      const row = data.find(r => r.row_index === m.rowIndex)
      return {
        input: row || {},
        output: String(row?.[columnId] || ''),
        rowIndex: m.rowIndex,
        editedAt: m.lastEditTime || Date.now()
      }
    })

  // Sort by most recent first
  editedCells.sort((a, b) => b.editedAt - a.editedAt)

  return editedCells
}

// Retry failed/edited cells
const handleRetry = async (options: RetryOptions) => {
  if (!selectedRetryColumn) return

  const column = selectedRetryColumn
  const columnId = column.id

  try {
    // Get all cell metadata for this column
    const allCellMeta = await getColumnCellMetadata(fileId, columnId)

    // Determine which rows to regenerate based on scope
    let targetRowIndices: number[] = []

    if (options.scope === 'failed') {
      targetRowIndices = allCellMeta
        .filter(m => m.status === 'failed')
        .map(m => m.rowIndex)
    } else if (options.scope === 'failed-edited') {
      targetRowIndices = allCellMeta
        .filter(m => m.status === 'failed' || m.edited)
        .map(m => m.rowIndex)
    } else {
      // 'all' - regenerate entire column
      target RowIndices = data.map((_, idx) => data[idx]?.row_index ?? idx)
    }

    // Get rows to regenerate
    const targetRows = data.filter((row, idx) =>
      targetRowIndices.includes(row.row_index ?? idx)
    )

    if (targetRows.length === 0) {
      toast.info('No cells to regenerate')
      return
    }

    // Build few-shot prompt if enabled
    let promptWithExamples = column.prompt || ''
    if (options.includeFewShot && options.selectedExamples.length > 0) {
      const fewShotPrefix = buildFewShotPrompt(options.selectedExamples, column.name)
      promptWithExamples = fewShotPrefix + '\n\n' + promptWithExamples
    }

    // Show toast notification
    const hiddenCount = totalRows > data.length ? targetRowIndices.length - targetRows.length : 0
    if (hiddenCount > 0) {
      toast.info(
        `Regenerating ${targetRowIndices.length} cells (${hiddenCount} hidden by filters)`
      )
    } else {
      toast.info(`Regenerating ${targetRows.length} cells...`)
    }

    // Mark cells as pending
    const pendingMeta: CellMetadata[] = targetRowIndices.map(rowIdx => ({
      fileId,
      columnId,
      rowIndex: rowIdx,
      status: 'pending' as const,
      edited: false
    }))
    await batchSaveCellMetadata(pendingMeta)

    // Update in-memory state to show pending
    setData(prev => prev.map(row => {
      if (!targetRowIndices.includes(row.row_index ?? 0)) return row
      return {
        ...row,
        [`${columnId}__meta`]: { status: 'pending' as const, edited: false }
      }
    }))

    // Set loading cells
    const loadingSet = new Set<string>()
    targetRows.forEach((_, idx) => loadingSet.add(`${idx}-${columnId}`))
    setLoadingCells(loadingSet)

    // Generate data with callback for each cell
    const columnRefs = extractColumnReferences(promptWithExamples)
    await generateColumnData(
      targetRows,
      columnId,
      promptWithExamples,
      column.model!,
      column.provider!,
      columnRefs,
      (current, total) => setGenerationProgress({ current, total }),
      (rowIndex, result) => {
        const cellValue = String(result.content || result.error || '[Error]')
        const dbRowIndex = targetRows[rowIndex]?.row_index ?? rowIndex

        // Save cell metadata
        saveCellMetadata({
          fileId,
          columnId,
          rowIndex: dbRowIndex,
          status: result.error ? 'failed' : 'success',
          error: result.error,
          errorType: result.errorType,
          edited: false,
          lastEditTime: Date.now()
        }).catch(err => console.error('Failed to save cell metadata:', err))

        // Update in-memory state
        setData(prev => {
          const updated = [...prev]
          const dataIdx = prev.findIndex(r => r.row_index === dbRowIndex)
          if (dataIdx >= 0) {
            updated[dataIdx] = {
              ...updated[dataIdx],
              [columnId]: cellValue,
              [`${columnId}__meta`]: {
                status: result.error ? 'failed' as const : 'success' as const,
                error: result.error,
                errorType: result.errorType,
                edited: false
              }
            }
          }
          return updated
        })

        // Update cell value in DuckDB
        updateCellInDuckDB(fileId, dbRowIndex, columnId, cellValue).catch(err =>
          console.error('Failed to update cell:', err)
        )

        // Remove from loading set
        setLoadingCells(prev => {
          const next = new Set(prev)
          next.delete(`${rowIndex}-${columnId}`)
          return next
        })
      }
    )

    // Success toast
    if (hiddenCount > 0) {
      toast.success(
        `${targetRowIndices.length} cells regenerated. Clear filters to view ${hiddenCount} updated cells.`,
        {
          action: {
            label: 'Clear Filters',
            onClick: () => clearAllFilters()
          }
        }
      )
    } else {
      toast.success(`${targetRows.length} cells regenerated successfully`)
    }
  } catch (error) {
    console.error('Retry failed:', error)
    toast.error('Failed to regenerate cells')
  } finally {
    setLoadingCells(new Set())
    setGenerationProgress({ current: 0, total: 0 })
  }
}
```

### Task 4: Update SpreadsheetTable to pass retry handler

**Location:** `SpreadsheetEditor.tsx`, JSX where SpreadsheetTable is rendered

**Find:**
```typescript
<SpreadsheetTable
  data={data}
  columns={columns}
  onAddColumn={() => setIsAddColumnModalOpen(true)}
  onCellChange={updateCellValue}
  onColumnTemplateSelect={setSelectedColumnTemplate}
  loadingCells={loadingCells}
  // ... other props
/>
```

**Update to:**
```typescript
<SpreadsheetTable
  data={data}
  columns={columns}
  onAddColumn={() => setIsAddColumnModalOpen(true)}
  onCellChange={updateCellValue}
  onColumnTemplateSelect={setSelectedColumnTemplate}
  loadingCells={loadingCells}
  columnStats={columnStats}
  onOpenRetryModal={handleOpenRetryModal}
  // ... other props
/>
```

### Task 5: Add RetryModal to JSX

**Location:** `SpreadsheetEditor.tsx`, JSX after AddColumnModal

**Add:**
```typescript
{selectedRetryColumn && (
  <RetryModal
    isOpen={isRetryModalOpen}
    onClose={() => {
      setIsRetryModalOpen(false)
      setSelectedRetryColumn(null)
    }}
    onRetry={handleRetry}
    columnName={selectedRetryColumn.name}
    stats={columnStats[selectedRetryColumn.id] || {
      failed: 0,
      edited: 0,
      succeeded: 0,
      total: 0
    }}
    examples={[]} // Will be loaded async in retry modal
    hasRateLimitErrors={
      data.some(row => {
        const meta = row[`${selectedRetryColumn.id}__meta`] as CellMetadata | undefined
        return meta?.errorType === 'rate_limit'
      })
    }
  />
)}
```

### Task 6: Add Sonner Toaster to layout

**Location:** `fluffy-viz/src/app/layout.tsx`

**Import:**
```typescript
import { Toaster } from '@/components/ui/sonner'
```

**Add before closing body tag:**
```typescript
<Toaster position="top-right" />
```

### Task 7: Update SpreadsheetTable props and rendering

**Location:** `fluffy-viz/src/components/spreadsheet/SpreadsheetTable.tsx`

**1. Update props interface:**
```typescript
interface SpreadsheetTableProps {
  // ... existing props
  columnStats?: Record<string, {
    failed: number
    edited: number
    pending: number
    succeeded: number
    total: number
  }>
  onOpenRetryModal?: (column: Column) => void
}
```

**2. Update column header rendering to use AiCell and add badges:**

Find the column name headers section and update to include retry button and badges for AI columns.

**3. Update cell rendering to use AiCell:**

Find where cells are rendered and add:
```typescript
{column.columnType === 'ai-generated' ? (
  <AiCell
    value={String(row[column.id] || '')}
    metadata={row[`${column.id}__meta`] as CellMetadata | undefined}
  />
) : (
  <div
    onClick={() => handleCellClick(rowIndex, column.id, row[column.id])}
    className="cursor-pointer w-full h-full min-h-[80px] text-sm text-foreground whitespace-pre-wrap break-words"
  >
    {String(row[column.id] || '')}
  </div>
)}
```

## 🧪 Testing Checklist

After implementation:

1. **Create AI column**
   - [ ] Column metadata saved to DB
   - [ ] Cells show pending state during generation
   - [ ] Successful cells show value
   - [ ] Failed cells show error icon with tooltip

2. **Edit cell**
   - [ ] Cell shows pencil icon
   - [ ] Tooltip shows original value
   - [ ] Metadata saved with edited flag

3. **Retry failed cells**
   - [ ] Modal shows correct stats
   - [ ] Few-shot examples display correctly
   - [ ] Toast notifications appear
   - [ ] Cells regenerate successfully

4. **Filter + Retry**
   - [ ] Hidden cells are regenerated
   - [ ] Toast shows hidden count
   - [ ] "Clear Filter" action works

## ⚡ Quick Start Commands

```bash
# Run linter
npm run lint

# Start dev server
npm run dev

# Test in browser
# Navigate to http://localhost:3000
# Upload a file
# Add an AI column
# Test retry functionality
```

## 📝 Notes

- The implementation preserves all existing functionality
- All new features are additive (no breaking changes)
- Error handling is comprehensive
- Toast notifications provide great UX feedback

**Estimated time:** 3-4 hours of focused implementation

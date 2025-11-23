'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SpreadsheetTable } from './SpreadsheetTable'
import { AddColumnModal } from './AddColumnModal'
import { RetryModal, type RetryOptions } from './RetryModal'
import { AgentTraceViewer } from '@/components/embedding-viewer/agent-trace-viewer'
import { Model, ModelProvider } from '@/types/models'
import { useFileStorage } from '@/hooks/use-file-storage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft, Download, Save, Loader2, X, ArrowUpDown, Filter, Plus } from 'lucide-react'
import { generateColumnData } from '@/lib/ai-inference'
import {
  isConversationalHistoryPrompt,
  parseConversationalHistoryConfig,
  generateConversationalHistory
} from '@/lib/conversational-history'
import {
  addColumn as addColumnToDuckDB,
  batchUpdateColumn,
  updateCellValue as updateCellInDuckDB,
  queryFileDataWithMetadata,
  getAllColumnMetadata,
  saveColumnMetadata,
  saveCellMetadata,
  batchSaveCellMetadata,
  getColumnCellMetadata,
  persistDatabase,
  type CellMetadata
} from '@/lib/duckdb'
import { selectFewShotExamples, buildFewShotPrompt } from '@/lib/few-shot-sampling'
import { toast } from 'sonner'
import Papa from 'papaparse'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface Column {
  id: string
  name: string
  type: string
  visible: boolean
  columnType?: 'data' | 'ai-generated' | 'computed'
  model?: Model
  provider?: ModelProvider
  prompt?: string
  searchWeb?: boolean
  isAIGenerated?: boolean
  metadata?: {
    prompt?: string
    provider?: string
    model?: string
    createdAt?: Date
  }
}

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'NOT LIKE' | 'IS NULL' | 'IS NOT NULL'

export interface FilterRule {
  id: string
  columnId: string
  operator: FilterOperator
  value: string | number | null
}

export interface SpreadsheetData {
  [key: string]: any
}

interface SpreadsheetEditorProps {
  fileId: string
}

export function SpreadsheetEditor({ fileId }: SpreadsheetEditorProps) {
  const router = useRouter()
  const { getFile, saveFile } = useFileStorage()
  const [data, setData] = useState<SpreadsheetData[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false)
  const [selectedColumnTemplate, setSelectedColumnTemplate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fileName, setFileName] = useState<string>('')
  const [generatingColumn, setGeneratingColumn] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 })
  const [loadingCells, setLoadingCells] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'spreadsheet' | 'embeddings'>('spreadsheet')

  // Pagination and sorting state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(100)
  const [totalRows, setTotalRows] = useState(0)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)

  // Filter state
  const [filters, setFilters] = useState<FilterRule[]>([])
  const [isAddingFilter, setIsAddingFilter] = useState(false)
  const [newFilter, setNewFilter] = useState<Partial<FilterRule>>({
    columnId: undefined,
    operator: '=',
    value: ''
  })

  // Retry modal state
  const [isRetryModalOpen, setIsRetryModalOpen] = useState(false)
  const [selectedRetryColumn, setSelectedRetryColumn] = useState<Column | null>(null)
  const [retryExamples, setRetryExamples] = useState<Array<{
    input: Record<string, any>;
    output: string;
    rowIndex: number;
    editedAt: number;
  }>>([])

  // Build WHERE clause from filter rules
  const buildWhereClause = (): string | undefined => {
    if (filters.length === 0) return undefined

    const conditions = filters.map(filter => {
      const columnName = `"${filter.columnId}"`

      // Null check operators don't need values
      if (filter.operator === 'IS NULL') {
        return `${columnName} IS NULL`
      }
      if (filter.operator === 'IS NOT NULL') {
        return `${columnName} IS NOT NULL`
      }

      // For other operators, format the value
      const column = columns.find(c => c.id === filter.columnId)
      const isNumeric = column?.type === 'number'

      let formattedValue: string
      if (isNumeric) {
        formattedValue = String(filter.value)
      } else if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
        // For LIKE operators, wrap in single quotes and allow % wildcards
        formattedValue = `'${String(filter.value).replace(/'/g, "''")}'`
      } else {
        // For other string operators, escape single quotes
        formattedValue = `'${String(filter.value).replace(/'/g, "''")}'`
      }

      return `${columnName} ${filter.operator} ${formattedValue}`
    })

    return conditions.join(' AND ')
  }

  // Load file data with pagination and sorting
  useEffect(() => {
    const loadFileData = async () => {
      try {
        const storedFile = getFile(fileId)
        if (storedFile) {
          setFileName(storedFile.name)

          // Import DuckDB operations
          const { getFileRowCount, getFileData } = await import('@/lib/duckdb')

          // Get total row count for pagination
          const count = await getFileRowCount(fileId)
          setTotalRows(count)

          // Build sort order string
          let orderBy = 'row_index ASC'
          if (sortColumn && sortDirection) {
            orderBy = `"${sortColumn}" ${sortDirection.toUpperCase()}`
          }

          // Build WHERE clause from filters
          const whereClause = buildWhereClause()

          // Query paginated data WITH metadata
          const parsedData = await queryFileDataWithMetadata(fileId, {
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
            orderBy,
            where: whereClause
          })
          setData(parsedData)

          // Load column metadata to identify AI columns
          const columnMeta = await getAllColumnMetadata(fileId)
          const columnMetaMap = new Map(
            columnMeta.map(m => [m.columnId, m])
          )

          // Generate columns from first row (or all data if no pagination data yet)
          if (parsedData.length > 0) {
            const generatedColumns = Object.keys(parsedData[0])
              .filter(key => key !== 'row_index' && !key.endsWith('__meta')) // Exclude internal columns
              .map((key) => {
                const meta = columnMetaMap.get(key)
                return {
                  id: key,
                  name: meta?.columnName || key,  // Use stored name or fallback to ID
                  type: typeof parsedData[0][key] === 'number' ? 'number' : 'string',
                  visible: true,
                  columnType: meta?.columnType,
                  isAIGenerated: meta?.columnType === 'ai-generated',
                  metadata: meta ? {
                    prompt: meta.prompt,
                    provider: meta.provider,
                    model: meta.model,
                  } : undefined
                }
              })
            setColumns(generatedColumns)
          } else if (count > 0) {
            // If no data on this page but rows exist, load first page to get columns
            const firstPageData = await getFileData(fileId)
            if (firstPageData.length > 0) {
              const generatedColumns = Object.keys(firstPageData[0])
                .filter(key => key !== 'row_index' && !key.endsWith('__meta'))
                .map((key) => {
                  const meta = columnMetaMap.get(key)
                  return {
                    id: key,
                    name: meta?.columnName || key,  // Use stored name or fallback to ID
                    type: typeof firstPageData[0][key] === 'number' ? 'number' : 'string',
                    visible: true,
                    columnType: meta?.columnType,
                    isAIGenerated: meta?.columnType === 'ai-generated',
                    metadata: meta ? {
                      prompt: meta.prompt,
                      provider: meta.provider,
                      model: meta.model,
                    } : undefined
                  }
                })
              setColumns(generatedColumns)
            }
          }
        }
      } catch (error) {
        console.error('Error loading file:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFileData()
  }, [fileId, getFile, currentPage, pageSize, sortColumn, sortDirection, filters])

  // Calculate column statistics for badges
  const columnStats = useMemo(() => {
    const stats: Record<string, { failed: number; edited: number; pending: number; succeeded: number; total: number }> = {}

    columns.forEach(col => {
      if (col.columnType !== 'ai-generated') return

      const failed = data.filter(row => {
        const meta = row[`${col.id}__meta`] as CellMetadata | undefined
        return meta?.status === 'failed'
      }).length

      const edited = data.filter(row => {
        const meta = row[`${col.id}__meta`] as CellMetadata | undefined
        return meta?.edited === true
      }).length

      const pending = data.filter(row => {
        const meta = row[`${col.id}__meta`] as CellMetadata | undefined
        return meta?.status === 'pending'
      }).length

      stats[col.id] = {
        failed,
        edited,
        pending,
        succeeded: totalRows - failed - pending,
        total: totalRows
      }
    })

    return stats
  }, [data, columns, totalRows])

  const addColumn = async (columnData: {
    name: string
    prompt: string
    model: Model
    provider: ModelProvider
    searchWeb?: boolean
  }) => {
    // Check for duplicate column name
    const existingColumnMeta = await getAllColumnMetadata(fileId)
    const duplicateExists = existingColumnMeta.some(
      meta => meta.columnName?.toLowerCase() === columnData.name.toLowerCase()
    )

    if (duplicateExists) {
      toast.error(`Column name "${columnData.name}" already exists. Please choose a different name.`)
      return
    }

    // Check if this is a conversational history column
    const isConvHistory = isConversationalHistoryPrompt(columnData.prompt)
    const columnType = isConvHistory ? 'computed' : 'ai-generated'

    const newColumn: Column = {
      id: `col_${Date.now()}`,
      name: columnData.name,
      type: 'string',
      visible: true,
      columnType,
      isAIGenerated: !isConvHistory,
      model: columnData.model,
      provider: columnData.provider,
      prompt: columnData.prompt,
      searchWeb: columnData.searchWeb,
      metadata: {
        prompt: columnData.prompt,
        provider: columnData.provider.id,
        model: columnData.model.id,
        createdAt: new Date()
      }
    }

    setColumns(prev => [...prev, newColumn])

    // Add empty data for the new column to all rows (in-memory)
    setData(prev => prev.map(row => ({
      ...row,
      [newColumn.id]: ''
    })))

    // Persist column to DuckDB
    try {
      await addColumnToDuckDB(fileId, newColumn.id, 'TEXT', '')
      console.log(`[SpreadsheetEditor] Column ${newColumn.id} added to DuckDB`)
    } catch (error) {
      console.error('[SpreadsheetEditor] Failed to add column to DuckDB:', error)
    }

    // Save column metadata
    try {
      await saveColumnMetadata({
        fileId,
        columnId: newColumn.id,
        columnName: newColumn.name,  // Save user-friendly name
        columnType,
        model: isConvHistory ? undefined : columnData.model.id,
        provider: isConvHistory ? undefined : columnData.provider.id,
        prompt: columnData.prompt,
        createdAt: Date.now()
      })
      console.log(`[SpreadsheetEditor] Column metadata saved for ${newColumn.id}`)

      // Persist database after adding column and metadata
      await persistDatabase()
      console.log(`[SpreadsheetEditor] Database persisted after column creation`)
    } catch (error) {
      console.error('[SpreadsheetEditor] Failed to save column metadata:', error)
    }

    setIsAddColumnModalOpen(false)
    setSelectedColumnTemplate(null)

    // Start AI generation in the background
    generateAIColumnData(newColumn, columnData)
  }

  const generateAIColumnData = async (
    column: Column,
    columnData: {
      name: string
      prompt: string
      model: Model
      provider: ModelProvider
      searchWeb?: boolean
    }
  ) => {
    setGeneratingColumn(column.id)
    setGenerationProgress({ current: 0, total: data.length })

    // Mark all cells in this column as loading
    const initialLoadingCells = new Set<string>()
    data.forEach((_, rowIndex) => {
      initialLoadingCells.add(`${rowIndex}-${column.id}`)
    })
    setLoadingCells(initialLoadingCells)

    try {
      // Check if this is a conversational history column
      if (isConversationalHistoryPrompt(columnData.prompt)) {
        const convConfig = parseConversationalHistoryConfig(columnData.prompt)
        if (convConfig) {
          // Create column ID → name mapping for display
          const columnIdToNameMap = new Map<string, string>()
          columns.forEach(col => {
            columnIdToNameMap.set(col.id, col.name)
          })

          // Generate conversational history synchronously
          const histories = generateConversationalHistory(data, convConfig, columnIdToNameMap)

          // Update all cells at once (in-memory)
          setData(prev => {
            return prev.map((row, rowIndex) => ({
              ...row,
              [column.id]: histories[rowIndex]
            }))
          })

          // Persist to DuckDB - use the histories array directly
          try {
            const updates = histories.map((historyText, index) => ({
              rowIndex: data[index]?.row_index ?? index,
              value: historyText
            }))
            await batchUpdateColumn(fileId, column.id, updates)
            console.log(`[SpreadsheetEditor] Conversational history persisted to DuckDB for column ${column.id}`)

            // Persist database after batch update
            await persistDatabase()
            console.log(`[SpreadsheetEditor] Database persisted after conversational history`)
          } catch (error) {
            console.error('[SpreadsheetEditor] Failed to persist conversational history to DuckDB:', error)
          }

          // Clear all loading cells
          setLoadingCells(new Set())
          setGenerationProgress({ current: data.length, total: data.length })

          return
        }
      }

      // Regular AI column generation
      // Extract column references from prompt (e.g., {{column_name}})
      const columnReferences = extractColumnReferences(columnData.prompt)

      // Track generated values for batch update to DuckDB
      const generatedValues: Array<{ rowIndex: number; value: string }> = []

      // Generate data for all rows with cell-level updates
      await generateColumnData(
        data,
        column.id,
        columnData.prompt,
        columnData.model,
        columnData.provider,
        columnReferences,
        (current, total) => setGenerationProgress({ current, total }),
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
      )

      // Persist to DuckDB after all generation is complete
      if (generatedValues.length > 0) {
        try {
          await batchUpdateColumn(fileId, column.id, generatedValues)
          console.log(`[SpreadsheetEditor] AI column data persisted to DuckDB for column ${column.id}`)

          // Wait a bit for async metadata saves to complete
          await new Promise(resolve => setTimeout(resolve, 100))

          // Persist database after batch update and metadata saves
          await persistDatabase()
          console.log(`[SpreadsheetEditor] Database persisted after AI column generation`)
        } catch (error) {
          console.error('[SpreadsheetEditor] Failed to persist AI column data to DuckDB:', error)
        }
      }
    } catch (error) {
      console.error('Error generating column data:', error)
      // Clear all loading cells on error
      setLoadingCells(new Set())
    } finally {
      setGeneratingColumn(null)
      setGenerationProgress({ current: 0, total: 0 })
    }
  }

  const extractColumnReferences = (prompt: string): string[] => {
    const matches = prompt.match(/\{\{([^}]+)\}\}/g)
    if (!matches) return []
    return matches.map(m => m.replace(/\{\{|\}\}/g, '').trim())
  }

  const updateCellValue = async (rowIndex: number, columnId: string, value: any) => {
    const column = columns.find(c => c.id === columnId)
    const currentMeta = data[rowIndex]?.[`${columnId}__meta`] as CellMetadata | undefined
    const currentValue = data[rowIndex]?.[columnId]

    // Check if value actually changed
    const valueChanged = String(value || '') !== String(currentValue || '')

    // Only proceed if value changed
    if (!valueChanged) {
      console.log(`[SpreadsheetEditor] Cell [${rowIndex}, ${columnId}] value unchanged, skipping update`)
      return
    }

    console.log('[CellEdit Debug] Editing cell:', {
      rowIndex,
      columnId,
      columnName: column?.name,
      isAIColumn: column?.columnType === 'ai-generated',
      wasAlreadyEdited: currentMeta?.edited,
      currentValue: String(currentValue),
      newValue: String(value),
      existingOriginalValue: currentMeta?.originalValue
    })

    // Update in-memory state
    setData(prev =>
      prev.map((row, index) => {
        if (index !== rowIndex) return row

        const updated: any = { ...row, [columnId]: value }

        // If AI column and has existing value, mark as edited
        if (column?.columnType === 'ai-generated' && currentMeta?.status === 'success') {
          const originalValueToSave = currentMeta.edited ? currentMeta.originalValue : currentValue

          console.log('[CellEdit Debug] Saving metadata with originalValue:', originalValueToSave)

          updated[`${columnId}__meta`] = {
            ...currentMeta,
            edited: true,
            originalValue: originalValueToSave,
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
        const originalValueToSave = currentMeta.edited ? currentMeta.originalValue : currentValue

        console.log('[CellEdit Debug] Persisting to database with originalValue:', originalValueToSave)

        await saveCellMetadata({
          fileId,
          columnId,
          rowIndex: dbRowIndex,
          status: 'success',
          error: currentMeta.error,
          errorType: currentMeta.errorType,
          edited: true,
          originalValue: originalValueToSave,
          lastEditTime: Date.now()
        })
      }

      // Persist database after cell update
      await persistDatabase()
      console.log(`[SpreadsheetEditor] Cell [${dbRowIndex}, ${columnId}] updated and database persisted`)
    } catch (error) {
      console.error('[SpreadsheetEditor] Failed to update cell in DuckDB:', error)
    }
  }

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      }
    } else {
      // New column, start with asc
      setSortColumn(columnId)
      setSortDirection('asc')
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  // Filter management functions
  const addFilter = () => {
    if (!newFilter.columnId) return

    const filter: FilterRule = {
      id: `filter_${Date.now()}`,
      columnId: newFilter.columnId,
      operator: newFilter.operator || '=',
      value: newFilter.value ?? ''
    }

    setFilters(prev => [...prev, filter])
    setNewFilter({ columnId: undefined, operator: '=', value: '' })
    setIsAddingFilter(false)
  }

  const removeFilter = (filterId: string) => {
    setFilters(prev => prev.filter(f => f.id !== filterId))
  }

  const clearAllFilters = () => {
    setFilters([])
  }

  // Open retry modal for a column
  const handleOpenRetryModal = async (column: Column) => {
    setSelectedRetryColumn(column)

    // Load few-shot examples from edited cells
    try {
      console.log('[RetryModal Debug] Loading examples for column:', {
        columnId: column.id,
        columnName: column.name
      })

      const cellMeta = await getColumnCellMetadata(fileId, column.id)
      console.log('[RetryModal Debug] Cell metadata count:', cellMeta.length)
      console.log('[RetryModal Debug] Edited cells with originalValue:',
        cellMeta.filter(m => m.edited && m.originalValue).length
      )

      const editedCells = cellMeta
        .filter(m => m.edited && m.originalValue)
        .map(m => {
          const row = data.find(r => r.row_index === m.rowIndex)
          const currentCellValue = row?.[column.id]

          console.log('[RetryModal Debug] Example row', m.rowIndex, {
            currentCellValue: String(currentCellValue),
            originalValue: m.originalValue,
            metadataColumnId: m.columnId
          })

          return {
            input: row || {},
            output: String(currentCellValue || ''),
            originalOutput: m.originalValue,
            rowIndex: Number(m.rowIndex),
            editedAt: Number(m.lastEditTime || Date.now())
          }
        })
      // Sort by most recent first
      editedCells.sort((a, b) => b.editedAt - a.editedAt)

      console.log('[RetryModal Debug] Final examples count:', editedCells.length)
      if (editedCells.length > 0) {
        console.log('[RetryModal Debug] First example:', {
          output: editedCells[0].output,
          originalOutput: editedCells[0].originalOutput,
          rowIndex: editedCells[0].rowIndex
        })
      }

      setRetryExamples(editedCells)
    } catch (error) {
      console.error('Failed to load examples:', error)
      setRetryExamples([])
    }

    setIsRetryModalOpen(true)
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
        targetRowIndices = data.map((_, idx) => data[idx]?.row_index ?? idx)
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
        // Select up to 10 examples using random sampling
        const selectedExamples = selectFewShotExamples(options.selectedExamples, 10)
        const fewShotPrefix = buildFewShotPrompt(selectedExamples, column.name)
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
      const modelToUse = options.model || column.model!
      const providerToUse = options.provider || column.provider!

      // If model changed, update column metadata
      if (options.model && options.provider) {
        await saveColumnMetadata({
          fileId,
          columnId,
          columnName: column.name,  // Preserve column name
          columnType: 'ai-generated',
          model: options.model.id,
          provider: options.provider.id,
          prompt: column.prompt,
          createdAt: Date.now()
        })

        // Update in-memory column data
        setColumns(prev => prev.map(col =>
          col.id === columnId
            ? { ...col, model: options.model, provider: options.provider }
            : col
        ))
      }

      await generateColumnData(
        targetRows,
        columnId,
        promptWithExamples,
        modelToUse,
        providerToUse,
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

  const getOperatorsForColumn = (columnId: string): FilterOperator[] => {
    const column = columns.find(c => c.id === columnId)
    const isNumeric = column?.type === 'number'

    if (isNumeric) {
      return ['=', '!=', '>', '<', '>=', '<=', 'IS NULL', 'IS NOT NULL']
    } else {
      return ['=', '!=', 'LIKE', 'NOT LIKE', 'IS NULL', 'IS NOT NULL']
    }
  }

  const needsValue = (operator: FilterOperator): boolean => {
    return operator !== 'IS NULL' && operator !== 'IS NOT NULL'
  }

  const handleSave = async () => {
    // Convert data back to CSV format using PapaParse for proper escaping
    const csvContent = convertToCSV(data, columns)
    await saveFile(csvContent, fileName, 'csv', 'text/csv', fileId)
  }

  const convertToCSV = (data: SpreadsheetData[], columns: Column[]): string => {
    const visibleColumns = columns.filter(col => col.visible)
    const headers = visibleColumns.map(col => col.name)

    // Map data to array of arrays with only visible columns
    const rows = data.map(row =>
      visibleColumns.map(col => {
        const value = row[col.id]
        // Ensure all values are strings to prevent any type coercion
        return value != null ? String(value) : ''
      })
    )

    // Use PapaParse to properly escape CSV values (handles commas, quotes, newlines)
    return Papa.unparse({
      fields: headers,
      data: rows
    })
  }

  const handleExport = () => {
    const csvContent = convertToCSV(data, columns)
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName || 'export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-1 space-y-2">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'spreadsheet' | 'embeddings')} className="w-full">
          {/* Compact Header with Tabs */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold">{fileName}</h1>
                <Badge variant="secondary" className="text-xs">
                  {data.length} rows × {columns.length} columns
                </Badge>
              </div>
            </div>

            {/* Tabs in Center */}
            <TabsList>
              <TabsTrigger value="spreadsheet">Spreadsheet</TabsTrigger>
              <TabsTrigger value="embeddings">Agent Trace Viewer</TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              {generatingColumn && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating {generationProgress.current}/{generationProgress.total}
                </div>
              )}
              <Button variant="outline" onClick={handleSave} disabled={!!generatingColumn}>
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleExport} disabled={!!generatingColumn}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>

          <TabsContent value="spreadsheet" className="mt-2">
            {/* Spreadsheet Card with integrated drawer */}
            <Card className="rounded-2xl shadow-sm relative overflow-hidden">
              {/* <CardHeader>
                <CardTitle className="font-sans">Spreadsheet Editor</CardTitle>
              </CardHeader> */}

              {/* Content area that shifts left when drawer opens */}
              <CardContent
                className={`transition-all duration-300 ease-in-out ${
                  isAddColumnModalOpen ? 'mr-[440px]' : 'mr-0'
                }`}
              >
                {/* Filter and Sort Controls */}
                <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border space-y-3">
                  <div className="flex items-center gap-6 flex-wrap">
                    {/* Sort Control */}
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Sort by:</span>
                      <Select
                        value={sortColumn || 'none'}
                        onValueChange={(value) => {
                          if (value === 'none') {
                            setSortColumn(null)
                            setSortDirection(null)
                          } else {
                            setSortColumn(value)
                            if (!sortDirection) {
                              setSortDirection('asc')
                            }
                          }
                        }}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="No sorting" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No sorting</SelectItem>
                          {columns.map((col) => (
                            <SelectItem key={col.id} value={col.id}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {sortColumn && (
                        <>
                          <Select
                            value={sortDirection || 'asc'}
                            onValueChange={(value) => setSortDirection(value as 'asc' | 'desc')}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="asc">Ascending</SelectItem>
                              <SelectItem value="desc">Descending</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSortColumn(null)
                              setSortDirection(null)
                            }}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="h-6 w-px bg-border" />

                    {/* Filter Control */}
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Filters:</span>

                      {!isAddingFilter && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsAddingFilter(true)}
                          className="h-8"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Filter
                        </Button>
                      )}
                    </div>

                    {/* Active Filters as Badges */}
                    {filters.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          {filters.map(filter => {
                            const column = columns.find(c => c.id === filter.columnId)
                            const displayValue = needsValue(filter.operator) ? ` ${filter.value}` : ''
                            return (
                              <Badge key={filter.id} variant="secondary" className="gap-1">
                                {column?.name} {filter.operator}{displayValue}
                                <button
                                  onClick={() => removeFilter(filter.id)}
                                  className="ml-1 hover:bg-muted rounded-sm"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Badge>
                            )
                          })}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearAllFilters}
                          className="text-xs h-7"
                        >
                          Clear All
                        </Button>
                      </>
                    )}

                    {/* Active Sort Display */}
                    {sortColumn && (
                      <div className="flex items-center gap-2 ml-auto">
                        <Badge variant="secondary" className="gap-1">
                          Sorted by: {columns.find(c => c.id === sortColumn)?.name}
                          <span className="text-xs">
                            ({sortDirection === 'asc' ? '↑' : '↓'})
                          </span>
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Add Filter Form */}
                  {isAddingFilter && (
                    <div className="p-3 bg-background rounded-md border border-border">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Column Selector */}
                        <Select
                          value={newFilter.columnId || ''}
                          onValueChange={(value) => {
                            setNewFilter(prev => ({
                              ...prev,
                              columnId: value,
                              // Reset operator based on column type
                              operator: getOperatorsForColumn(value)[0]
                            }))
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {columns.map((col) => (
                              <SelectItem key={col.id} value={col.id}>
                                {col.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Operator Selector */}
                        {newFilter.columnId && (
                          <Select
                            value={newFilter.operator || '='}
                            onValueChange={(value) =>
                              setNewFilter(prev => ({ ...prev, operator: value as FilterOperator }))
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {getOperatorsForColumn(newFilter.columnId).map((op) => (
                                <SelectItem key={op} value={op}>
                                  {op}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Value Input */}
                        {newFilter.columnId && newFilter.operator && needsValue(newFilter.operator) && (
                          <Input
                            type={columns.find(c => c.id === newFilter.columnId)?.type === 'number' ? 'number' : 'text'}
                            placeholder={newFilter.operator.includes('LIKE') ? 'Use % for wildcards' : 'Value...'}
                            value={newFilter.value?.toString() || ''}
                            onChange={(e) =>
                              setNewFilter(prev => ({ ...prev, value: e.target.value }))
                            }
                            className="w-[200px]"
                          />
                        )}

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={addFilter}
                            disabled={!newFilter.columnId || (needsValue(newFilter.operator || '=') && !newFilter.value)}
                          >
                            Apply
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsAddingFilter(false)
                              setNewFilter({ columnId: undefined, operator: '=', value: '' })
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <SpreadsheetTable
                  data={data}
                  columns={columns}
                  onAddColumn={() => setIsAddColumnModalOpen(true)}
                  onCellChange={updateCellValue}
                  onColumnTemplateSelect={setSelectedColumnTemplate}
                  loadingCells={loadingCells}
                  currentPage={currentPage}
                  totalRows={totalRows}
                  pageSize={pageSize}
                  onPageChange={handlePageChange}
                  sortColumn={sortColumn}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  columnStats={columnStats}
                  onOpenRetryModal={handleOpenRetryModal}
                />
              </CardContent>

              {/* Backdrop - only covers the card */}
              {isAddColumnModalOpen && (
                <div
                  className="absolute inset-0 bg-black/30 transition-opacity duration-300 z-40"
                  onClick={() => {
                    setIsAddColumnModalOpen(false)
                    setSelectedColumnTemplate(null)
                  }}
                />
              )}

              {/* Drawer - slides in from right within card bounds */}
              <AddColumnModal
                isOpen={isAddColumnModalOpen}
                onClose={() => {
                  setIsAddColumnModalOpen(false)
                  setSelectedColumnTemplate(null)
                }}
                onAddColumn={addColumn}
                template={selectedColumnTemplate}
                availableColumns={columns.map(col => ({ id: col.id, name: col.name }))}
                dataRows={data}
                existingColumnNames={columns.map(col => col.name)}
              />
            </Card>

            {/* Retry Modal */}
            {selectedRetryColumn && (() => {
              // Create column ID → name mapping
              const columnIdToNameMap = new Map<string, string>()
              columns.forEach(col => {
                columnIdToNameMap.set(col.id, col.name)
              })

              return (
                <RetryModal
                  isOpen={isRetryModalOpen}
                  onClose={() => {
                    setIsRetryModalOpen(false)
                    setSelectedRetryColumn(null)
                    setRetryExamples([])
                  }}
                  onRetry={async (options) => {
                    // Load few-shot examples dynamically if needed
                    if (options.includeFewShot) {
                      const cellMeta = await getColumnCellMetadata(fileId, selectedRetryColumn.id)
                      const editedCells = cellMeta
                        .filter(m => m.edited && m.originalValue)
                        .map(m => {
                          const row = data.find(r => r.row_index === m.rowIndex)
                          return {
                            input: row || {},
                            output: String(row?.[selectedRetryColumn.id] || ''),
                            originalOutput: m.originalValue,
                            rowIndex: m.rowIndex,
                            editedAt: m.lastEditTime || Date.now()
                          }
                        })
                      // Sort by most recent first
                      editedCells.sort((a, b) => b.editedAt - a.editedAt)

                      // Pass examples to retry handler
                      await handleRetry({
                        ...options,
                        selectedExamples: editedCells
                      })
                    } else {
                      await handleRetry(options)
                    }
                  }}
                  columnName={selectedRetryColumn.name}
                  columnPrompt={selectedRetryColumn.prompt}
                  columnIdToNameMap={columnIdToNameMap}
                  stats={columnStats[selectedRetryColumn.id] || {
                    failed: 0,
                    edited: 0,
                    succeeded: 0,
                    total: 0
                  }}
                  examples={retryExamples}
                  hasRateLimitErrors={
                    data.some(row => {
                      const meta = row[`${selectedRetryColumn.id}__meta`] as CellMetadata | undefined
                      return meta?.errorType === 'rate_limit'
                    })
                  }
                  currentModel={selectedRetryColumn.model}
                  currentProvider={selectedRetryColumn.provider}
                />
              )
            })()}
          </TabsContent>

          <TabsContent value="embeddings" className="mt-2">
            <Card className="rounded-2xl shadow-sm h-[calc(100vh)]">
              <CardContent className="p-0 h-full">
                <AgentTraceViewer
                  fileId={fileId}
                  data={{
                    columns: columns.map(col => col.name),
                    rows: data
                  }}
                  onDataUpdate={(updatedData) => {
                    const columnNames = updatedData.columns;
                    const newColumns: Column[] = columnNames.map(name => ({
                      id: name,
                      name,
                      type: 'string',
                      visible: true,
                    }));
                    setColumns(newColumns);
                    setData(updatedData.rows as SpreadsheetData[]);
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

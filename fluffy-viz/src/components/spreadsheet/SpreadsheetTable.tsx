'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Loader2, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from 'lucide-react'
import type { Column, SpreadsheetData } from './SpreadsheetEditor'
import { getTemplateGroups } from '@/config/ai-column-templates'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AiCell } from './AiCell'
import type { CellMetadata } from '@/lib/duckdb'
import { schemaToPromptFormat } from '@/lib/schema-utils'
import { formatPromptForDisplay } from '@/lib/prompt-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SpreadsheetTableProps {
  data: SpreadsheetData[]
  columns: Column[]
  onAddColumn: () => void
  onCellChange: (rowIndex: number, columnId: string, value: any) => void
  onColumnTemplateSelect: (template: string) => void
  loadingCells?: Set<string>
  // Pagination props
  currentPage?: number
  totalRows?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  // Sorting props
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc' | null
  onSort?: (column: string) => void
  // Filter props
  columnFilters?: Record<string, string>
  onFilterChange?: (column: string, value: string) => void
  // Retry props
  columnStats?: Record<string, {
    failed: number
    edited: number
    pending: number
    succeeded: number
    total: number
  }>
  onOpenRetryModal?: (column: Column) => void
  onDeleteColumn?: (columnId: string) => void
  // Column width props
  columnWidths?: Record<string, number>
  onColumnWidthChange?: (columnId: string, width: number) => void
}

// Default column width
const DEFAULT_COLUMN_WIDTH = 200
const MIN_COLUMN_WIDTH = 80
const ROW_NUMBER_WIDTH = 64

// Get template groups with hierarchy
const templateGroups = getTemplateGroups()

// Convert column index to Excel-style letter (A, B, C, etc.)
function indexToLetter(index: number): string {
  let result = ''
  while (index >= 0) {
    result = String.fromCharCode('A'.charCodeAt(0) + (index % 26)) + result
    index = Math.floor(index / 26) - 1
  }
  return result
}

export function SpreadsheetTable({
  data,
  columns,
  onAddColumn,
  onCellChange,
  onColumnTemplateSelect,
  loadingCells = new Set(),
  currentPage = 1,
  totalRows = 0,
  pageSize = 100,
  onPageChange,
  sortColumn = null,
  sortDirection = null,
  onSort,
  columnFilters = {},
  onFilterChange,
  columnStats = {},
  onOpenRetryModal,
  onDeleteColumn,
  columnWidths = {},
  onColumnWidthChange
}: SpreadsheetTableProps) {
  const [editingCell, setEditingCell] = useState<{row: number, col: string} | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedCell, setSelectedCell] = useState<{row: number, col: string} | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragRange, setDragRange] = useState<{startRow: number, endRow: number, col: string} | null>(null)
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null)

  // Column resize state
  const [resizingColumn, setResizingColumn] = useState<string | null>(null)

  // Refs for drag event listener cleanup
  const mouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null)
  const mouseUpRef = useRef<(() => void) | null>(null)

  // Refs for column resize event listener cleanup
  const resizeMouseMoveRef = useRef<((e: MouseEvent) => void) | null>(null)
  const resizeMouseUpRef = useRef<(() => void) | null>(null)

  // Get column width with fallback to default
  const getColumnWidth = useCallback((columnId: string): number => {
    return columnWidths[columnId] ?? DEFAULT_COLUMN_WIDTH
  }, [columnWidths])

  // Handle column resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()

    const startX = e.clientX
    const startWidth = getColumnWidth(columnId)

    setResizingColumn(columnId)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const newWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + deltaX)
      onColumnWidthChange?.(columnId, newWidth)
    }

    const handleMouseUp = () => {
      setResizingColumn(null)
      if (resizeMouseMoveRef.current) {
        document.removeEventListener('mousemove', resizeMouseMoveRef.current)
      }
      if (resizeMouseUpRef.current) {
        document.removeEventListener('mouseup', resizeMouseUpRef.current)
      }
      resizeMouseMoveRef.current = null
      resizeMouseUpRef.current = null
    }

    resizeMouseMoveRef.current = handleMouseMove
    resizeMouseUpRef.current = handleMouseUp

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [getColumnWidth, onColumnWidthChange])

  // Cleanup drag event listeners on unmount
  useEffect(() => {
    return () => {
      if (mouseMoveRef.current) {
        document.removeEventListener('mousemove', mouseMoveRef.current)
      }
      if (mouseUpRef.current) {
        document.removeEventListener('mouseup', mouseUpRef.current)
      }
      if (resizeMouseMoveRef.current) {
        document.removeEventListener('mousemove', resizeMouseMoveRef.current)
      }
      if (resizeMouseUpRef.current) {
        document.removeEventListener('mouseup', resizeMouseUpRef.current)
      }
    }
  }, [])

  const visibleColumns = columns.filter(col => col.visible)
  const totalPages = Math.ceil(totalRows / pageSize)

  // Handle column delete with loading state
  const handleDeleteColumn = useCallback(async (columnId: string) => {
    if (!onDeleteColumn) return
    setDeletingColumnId(columnId)
    try {
      await onDeleteColumn(columnId)
    } finally {
      setDeletingColumnId(null)
    }
  }, [onDeleteColumn])

  const handleSort = (columnId: string) => {
    if (onSort) {
      onSort(columnId)
    }
  }

  const getSortIcon = (columnId: string) => {
    if (sortColumn !== columnId) {
      return <ArrowUpDown className="w-3 h-3 opacity-50" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-3 h-3" />
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-3 h-3" />
    }
    return <ArrowUpDown className="w-3 h-3 opacity-50" />
  }

  const [originalEditValue, setOriginalEditValue] = useState('')

  const handleCellClick = (rowIndex: number, columnId: string, currentValue: any) => {
    // Save the current cell before switching to a new one
    if (editingCell) {
      handleCellBlur()
    }

    const stringValue = String(currentValue || '')
    setEditingCell({ row: rowIndex, col: columnId })
    setEditValue(stringValue)
    setOriginalEditValue(stringValue)
    setSelectedCell({ row: rowIndex, col: columnId })
  }

  const handleCellSelect = (rowIndex: number, columnId: string) => {
    setSelectedCell({ row: rowIndex, col: columnId })
    setEditingCell(null)
  }

  const handleDragStart = (e: React.MouseEvent, rowIndex: number, columnId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
    setDragRange({ startRow: rowIndex, endRow: rowIndex, col: columnId })

    const handleMouseMove = (e: MouseEvent) => {
      const targetElement = document.elementFromPoint(e.clientX, e.clientY)
      const cellElement = targetElement?.closest('[data-cell-row]')
      if (cellElement) {
        const targetRow = parseInt(cellElement.getAttribute('data-cell-row') || '0')
        const targetCol = cellElement.getAttribute('data-cell-col') || columnId
        if (targetCol === columnId && targetRow >= 0) {
          setDragRange({
            startRow: rowIndex,
            endRow: Math.max(rowIndex, targetRow),
            col: columnId
          })
        }
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      if (dragRange && dragRange.endRow > dragRange.startRow) {
        autofillCells(dragRange)
      }
      setDragRange(null)
      if (mouseMoveRef.current) {
        document.removeEventListener('mousemove', mouseMoveRef.current)
      }
      if (mouseUpRef.current) {
        document.removeEventListener('mouseup', mouseUpRef.current)
      }
      mouseMoveRef.current = null
      mouseUpRef.current = null
    }

    // Store refs for cleanup
    mouseMoveRef.current = handleMouseMove
    mouseUpRef.current = handleMouseUp

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const autofillCells = (range: {startRow: number, endRow: number, col: string}) => {
    const { startRow, endRow, col } = range
    const sourceValue = data[startRow]?.[col]

    // Simple autofill - copy the source value to all cells in range
    for (let row = startRow + 1; row <= endRow; row++) {
      if (row < data.length) {
        onCellChange(row, col, sourceValue)
      }
    }
  }

  const handleCellBlur = () => {
    if (editingCell) {
      // Only trigger change if value actually changed
      if (editValue !== originalEditValue) {
        onCellChange(editingCell.row, editingCell.col, editValue)
      }
      setEditingCell(null)
    }
  }

  const handleTemplateSelect = (template: string) => {
    onColumnTemplateSelect(template)
    onAddColumn()
  }

  // Calculate total table width for proper sizing
  const totalTableWidth = ROW_NUMBER_WIDTH +
    visibleColumns.reduce((sum, col) => sum + getColumnWidth(col.id), 0) +
    DEFAULT_COLUMN_WIDTH

  // Refs for scroll sync
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRef = useRef<HTMLDivElement>(null)

  // Handle header scroll - sync body
  const handleHeaderScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  // Handle body scroll - sync header
  const handleBodyScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = e.currentTarget.scrollLeft
    }
  }, [])

  return (
    <div className={`w-full border border-border rounded-2xl bg-card relative flex flex-col max-h-[calc(100vh-200px)] ${resizingColumn ? 'select-none cursor-col-resize' : ''}`}>
      {/* Fixed header section */}
      <div className="flex-shrink-0 overflow-hidden">
        <div
          ref={headerScrollRef}
          className="overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onScroll={handleHeaderScroll}
        >
          <table className="border-collapse table-fixed" style={{ width: totalTableWidth }}>
            <thead className="bg-muted">
              {/* Column letter headers (A, B, C, etc.) */}
              <tr>
                <th
                  className="h-12 border border-border bg-muted text-muted-foreground text-sm font-normal"
                  style={{ width: ROW_NUMBER_WIDTH }}
                >
                  {/* Empty corner cell */}
                </th>
                {visibleColumns.map((column, index) => (
                  <th
                    key={column.id}
                    className="h-12 border border-border bg-muted text-muted-foreground text-sm font-normal relative group/resize"
                    style={{ width: getColumnWidth(column.id) }}
                  >
                    {indexToLetter(index)}
                    {/* Resize handle */}
                    <div
                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/50 group-hover/resize:bg-border transition-colors"
                      onMouseDown={(e) => handleResizeStart(e, column.id)}
                    />
                  </th>
                ))}
                {/* Add column header */}
                <th
                  className="h-12 border border-border bg-muted relative"
                  style={{ width: DEFAULT_COLUMN_WIDTH }}
                >
                  <div className="flex items-center justify-center h-full">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                          title="Add column"
                        >
                          <Plus className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[280px]">
                        {templateGroups.map((group, groupIndex) => (
                          <div key={group.heading}>
                            <DropdownMenuLabel className="text-xs font-semibold uppercase text-purple-500">
                              {group.heading}
                            </DropdownMenuLabel>
                            {group.templates.map((template) => (
                              <DropdownMenuItem
                                key={template.id}
                                onClick={() => handleTemplateSelect(template.id)}
                              >
                                <div className="flex flex-col gap-1">
                                  <span className="font-medium">{template.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {template.description}
                                  </span>
                                </div>
                              </DropdownMenuItem>
                            ))}
                            {groupIndex < templateGroups.length - 1 && <DropdownMenuSeparator />}
                          </div>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </th>
              </tr>

              {/* Column name headers */}
              <tr>
                <th
                  className="border border-border bg-muted"
                  style={{ width: ROW_NUMBER_WIDTH }}
                >
                  {/* Empty cell for row numbers */}
                </th>
                {visibleColumns.map((column) => {
                  const stats = columnStats[column.id]
                  const isAIColumn = column.columnType === 'ai-generated'

                  return (
                    <th
                      key={`name-${column.id}`}
                      className="border border-border bg-muted text-left relative group/resize"
                      style={{ width: getColumnWidth(column.id) }}
                    >
                      {column.isAIGenerated && column.metadata?.prompt ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                                onClick={() => handleSort(column.id)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-col flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-foreground truncate">{column.name}</span>
                                      {isAIColumn && stats && (
                                        <div className="flex gap-1 flex-shrink-0">
                                          {stats.failed > 0 && (
                                            <Badge variant="destructive" className="h-5 text-[10px] px-1">
                                              {stats.failed} failed
                                            </Badge>
                                          )}
                                          {stats.edited > 0 && (
                                            <Badge variant="secondary" className="h-5 text-[10px] px-1">
                                              {stats.edited} edited
                                            </Badge>
                                          )}
                                          {stats.pending > 0 && (
                                            <Badge variant="outline" className="h-5 text-[10px] px-1">
                                              {stats.pending} pending
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{column.type}</span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {isAIColumn && onOpenRetryModal && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onOpenRetryModal(column)
                                        }}
                                        className="h-6 w-6 p-0"
                                        title="Regenerate column"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </Button>
                                    )}
                                    {isAIColumn && onDeleteColumn && (
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => e.stopPropagation()}
                                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                            title="Delete column"
                                            disabled={deletingColumnId === column.id}
                                          >
                                            {deletingColumnId === column.id ? (
                                              <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                              <Trash2 className="h-3 w-3" />
                                            )}
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Column</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Are you sure you want to delete &quot;{column.name}&quot;? This action cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteColumn(column.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    )}
                                    {getSortIcon(column.id)}
                                  </div>
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-md">
                              <div className="space-y-2">
                                <div>
                                  <p className="font-semibold text-xs">Prompt:</p>
                                  <p className="text-xs whitespace-pre-wrap">
                                    {formatPromptForDisplay(column.metadata.prompt, columns)}
                                  </p>
                                </div>
                                {column.metadata.outputSchema?.mode === 'structured' && column.metadata.outputSchema.fields.length > 0 && (
                                  <div>
                                    <p className="font-semibold text-xs">Expected Output Format:</p>
                                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-700 text-white p-1 rounded mt-1">
                                      {schemaToPromptFormat(column.metadata.outputSchema.fields)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <button
                          className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                          onClick={() => handleSort(column.id)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground truncate">{column.name}</span>
                                {isAIColumn && stats && (
                                  <div className="flex gap-1 flex-shrink-0">
                                    {stats.failed > 0 && (
                                      <Badge variant="destructive" className="h-5 text-[10px] px-1">
                                        {stats.failed} failed
                                      </Badge>
                                    )}
                                    {stats.edited > 0 && (
                                      <Badge variant="secondary" className="h-5 text-[10px] px-1">
                                        {stats.edited} edited
                                      </Badge>
                                    )}
                                    {stats.pending > 0 && (
                                      <Badge variant="outline" className="h-5 text-[10px] px-1">
                                        {stats.pending} pending
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">{column.type}</span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isAIColumn && onOpenRetryModal && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onOpenRetryModal(column)
                                  }}
                                  className="h-6 w-6 p-0"
                                  title="Regenerate column"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              )}
                              {isAIColumn && onDeleteColumn && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                      title="Delete column"
                                      disabled={deletingColumnId === column.id}
                                    >
                                      {deletingColumnId === column.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Column</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete &quot;{column.name}&quot;? This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => handleDeleteColumn(column.id)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {getSortIcon(column.id)}
                            </div>
                          </div>
                        </button>
                      )}
                      {/* Resize handle */}
                      <div
                        className="absolute top-0 right-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/50 group-hover/resize:bg-border transition-colors z-10"
                        onMouseDown={(e) => handleResizeStart(e, column.id)}
                      />
                    </th>
                  )
                })}
                <th
                  className="border border-border bg-muted"
                  style={{ width: DEFAULT_COLUMN_WIDTH }}
                ></th>
              </tr>
            </thead>
          </table>
        </div>
      </div>

      {/* Scrollable body section */}
      <div
        ref={bodyScrollRef}
        className="flex-1 overflow-auto min-h-0"
        onScroll={handleBodyScroll}
      >
        <table className="border-collapse table-fixed" style={{ width: totalTableWidth }}>
          <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {/* Row number */}
              <td
                className="h-24 border bg-muted text-center text-sm text-muted-foreground"
                style={{ width: ROW_NUMBER_WIDTH }}
              >
                <button className="w-full h-full hover:bg-accent transition-colors">
                  {rowIndex + 1}
                </button>
              </td>

              {/* Data cells */}
              {visibleColumns.map((column) => (
                <td
                  key={column.id}
                  className="border border-border p-0"
                  style={{ width: getColumnWidth(column.id) }}
                  data-cell-row={rowIndex}
                  data-cell-col={column.id}
                >
                  <div className={`min-h-[100px] h-[102px] max-h-[102px] relative flex flex-col overflow-hidden group ${
                    selectedCell?.row === rowIndex && selectedCell?.col === column.id ? 'bg-primary/10 border-2 border-primary' : ''
                  } ${
                    dragRange && dragRange.col === column.id && rowIndex >= dragRange.startRow && rowIndex <= dragRange.endRow ? 'bg-primary/20' : ''
                  }`}>
                    <div className="flex-1 px-2 pt-2">
                      {loadingCells.has(`${rowIndex}-${column.id}`) ? (
                        <div className="flex items-center justify-center w-full h-full min-h-[80px]">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                      ) : editingCell?.row === rowIndex && editingCell?.col === column.id ? (
                        <textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleCellBlur()
                            }
                            if (e.key === 'Escape') {
                              setEditingCell(null)
                            }
                          }}
                          className="w-full h-full resize-none border-none outline-none bg-transparent"
                          autoFocus
                        />
                      ) : column.columnType === 'ai-generated' ? (
                        <div
                          onClick={() => handleCellClick(rowIndex, column.id, row[column.id])}
                          onMouseDown={() => handleCellSelect(rowIndex, column.id)}
                          className="cursor-pointer w-full h-full min-h-[80px]"
                        >
                          <AiCell
                            value={String(row[column.id] || '')}
                            metadata={row[`${column.id}__meta`] as CellMetadata | undefined}
                          />
                        </div>
                      ) : (
                        <div
                          onClick={() => handleCellClick(rowIndex, column.id, row[column.id])}
                          onMouseDown={() => handleCellSelect(rowIndex, column.id)}
                          className="cursor-pointer w-full h-full min-h-[80px] text-sm text-foreground whitespace-pre-wrap break-words"
                        >
                          {String(row[column.id] || '')}
                        </div>
                      )}
                    </div>

                    {/* Drag handle for selected cell */}
                    {selectedCell?.row === rowIndex && selectedCell?.col === column.id && !editingCell && (
                      <div
                        className="absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-se-resize"
                        onMouseDown={(e) => handleDragStart(e, rowIndex, column.id)}
                        title="Drag to fill down"
                      />
                    )}
                  </div>
                </td>
              ))}

              {/* Empty cell for add column */}
              <td className="border border-border" style={{ width: DEFAULT_COLUMN_WIDTH }}>
                <div className="min-h-[100px] h-[102px]"></div>
              </td>
            </tr>
          ))}

          {/* Add some empty rows */}
          {[...Array(2)].map((_, index) => (
            <tr key={`empty-${index}`}>
              <td
                className="h-24 border border-border bg-muted/30 text-center text-sm text-muted-foreground"
                style={{ width: ROW_NUMBER_WIDTH }}
              >
                <button className="w-full h-full hover:bg-accent hover:text-accent-foreground transition-colors">
                  {data.length + index + 1}
                </button>
              </td>
              {visibleColumns.map((column) => (
                <td
                  key={column.id}
                  className="border border-border"
                  style={{ width: getColumnWidth(column.id) }}
                  data-cell-row={data.length + index}
                  data-cell-col={column.id}
                >
                  <div className="min-h-[100px] h-[102px] px-2 pt-2 cursor-pointer hover:bg-accent/50">
                    {/* Empty cell content */}
                  </div>
                </td>
              ))}
              <td className="border border-border" style={{ width: DEFAULT_COLUMN_WIDTH }}>
                <div className="min-h-[100px] h-[102px]"></div>
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      {onPageChange && totalRows > 0 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30">
          <div className="text-sm text-muted-foreground">
            Showing {Math.min((currentPage - 1) * pageSize + 1, totalRows)} to {Math.min(currentPage * pageSize, totalRows)} of {totalRows} rows
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
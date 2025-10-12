'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import type { Column, SpreadsheetData } from './SpreadsheetEditor'
import { getTemplateGroups } from '@/config/ai-column-templates'
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

interface SpreadsheetTableProps {
  data: SpreadsheetData[]
  columns: Column[]
  onAddColumn: () => void
  onCellChange: (rowIndex: number, columnId: string, value: any) => void
  onColumnTemplateSelect: (template: string) => void
  loadingCells?: Set<string>
}

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
  loadingCells = new Set()
}: SpreadsheetTableProps) {
  const [editingCell, setEditingCell] = useState<{row: number, col: string} | null>(null)
  const [editValue, setEditValue] = useState('')
  const [selectedCell, setSelectedCell] = useState<{row: number, col: string} | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragRange, setDragRange] = useState<{startRow: number, endRow: number, col: string} | null>(null)

  const visibleColumns = columns.filter(col => col.visible)

  const handleCellClick = (rowIndex: number, columnId: string, currentValue: any) => {
    setEditingCell({ row: rowIndex, col: columnId })
    setEditValue(String(currentValue || ''))
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
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

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
      onCellChange(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }

  const handleTemplateSelect = (template: string) => {
    onColumnTemplateSelect(template)
    onAddColumn()
  }

  return (
    <div className="w-full overflow-auto border border-border rounded-2xl bg-card relative">
      <table className="w-full border-collapse">
        <thead className="bg-muted sticky top-0">
          {/* Column letter headers (A, B, C, etc.) */}
          <tr>
            <th className="w-16 h-12 border border-border bg-muted/50 text-muted-foreground text-sm font-normal">
              {/* Empty corner cell */}
            </th>
            {visibleColumns.map((column, index) => (
              <th key={column.id} className="min-w-[142px] w-80 h-12 border border-border bg-muted text-muted-foreground text-sm font-normal relative">
                {indexToLetter(index)}
              </th>
            ))}
            {/* Add column header */}
            <th className="min-w-[142px] w-80 h-12 border border-border bg-muted relative">
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
            <th className="w-16 border border-border bg-muted/50">
              {/* Empty cell for row numbers */}
            </th>
            {visibleColumns.map((column) => (
              <th key={`name-${column.id}`} className="border border-border bg-muted text-left">
                {column.isAIGenerated && column.metadata?.prompt ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{column.name}</span>
                            <span className="text-xs text-muted-foreground">{column.type}</span>
                          </div>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-md">
                        <div className="space-y-1">
                          <p className="font-semibold text-xs">Prompt:</p>
                          <p className="text-xs whitespace-pre-wrap">{column.metadata.prompt}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <button className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{column.name}</span>
                      <span className="text-xs text-muted-foreground">{column.type}</span>
                    </div>
                  </button>
                )}
              </th>
            ))}
            <th className="border border-border bg-muted"></th>
          </tr>
        </thead>

        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {/* Row number */}
              <td className="w-16 h-24 border  bg-gray-50 text-center text-sm text-gray-600">
                <button className="w-12 h-full hover:bg-gray-100 transition-colors">
                  {rowIndex + 1}
                </button>
              </td>

              {/* Data cells */}
              {visibleColumns.map((column) => (
                <td
                  key={column.id}
                  className="border border-border p-0"
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
              <td className="border border-border">
                <div className="min-h-[100px] h-[102px]"></div>
              </td>
            </tr>
          ))}

          {/* Add some empty rows */}
          {[...Array(2)].map((_, index) => (
            <tr key={`empty-${index}`}>
              <td className="w-16 h-24 border border-border bg-muted/30 text-center text-sm text-muted-foreground">
                <button className="w-full h-full hover:bg-accent hover:text-accent-foreground transition-colors">
                  {data.length + index + 1}
                </button>
              </td>
              {visibleColumns.map((column) => (
                <td
                  key={column.id}
                  className="border border-border"
                  data-cell-row={data.length + index}
                  data-cell-col={column.id}
                >
                  <div className="min-h-[100px] h-[102px] px-2 pt-2 cursor-pointer hover:bg-accent/50">
                    {/* Empty cell content */}
                  </div>
                </td>
              ))}
              <td className="border border-border">
                <div className="min-h-[100px] h-[102px]"></div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  )
}
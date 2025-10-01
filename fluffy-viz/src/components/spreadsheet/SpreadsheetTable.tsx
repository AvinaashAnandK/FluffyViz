'use client'

import { useState } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import type { Column, SpreadsheetData } from './SpreadsheetEditor'
import { COLUMN_TEMPLATES } from '@/config/ai-column-templates'

interface SpreadsheetTableProps {
  data: SpreadsheetData[]
  columns: Column[]
  onAddColumn: () => void
  onCellChange: (rowIndex: number, columnId: string, value: any) => void
  onColumnTemplateSelect: (template: string) => void
}

// Templates are now loaded from ai-column-templates.ts
const templatesList = Object.values(COLUMN_TEMPLATES)

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
  onColumnTemplateSelect
}: SpreadsheetTableProps) {
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false)
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
    setShowTemplateDropdown(false)
    onAddColumn()
  }

  return (
    <div className="w-full overflow-auto border border-border rounded-2xl bg-card relative">
      <table className="w-full border-collapse">
        <thead className="bg-muted sticky top-0">
          {/* Column letter headers (A, B, C, etc.) */}
          <tr>
            <th className="w-10 h-10 border border-border bg-muted/50 text-muted-foreground text-sm font-normal">
              {/* Empty corner cell */}
            </th>
            {visibleColumns.map((column, index) => (
              <th key={column.id} className="min-w-[142px] w-80 h-10 border border-border bg-muted text-muted-foreground text-sm font-normal relative">
                {indexToLetter(index)}
              </th>
            ))}
            {/* Add column header */}
            <th className="min-w-[142px] w-80 h-10 border border-border bg-muted relative">
              <div className="flex items-center justify-center h-full">
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
                    className="p-2 hover:bg-accent hover:text-accent-foreground rounded-md transition-colors"
                    title="Add column"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                  </button>

                </div>
              </div>
            </th>
          </tr>

          {/* Column name headers */}
          <tr>
            {visibleColumns.map((column) => (
              <th key={`name-${column.id}`} className="border border-border bg-muted text-left">
                <button className="w-full p-3 text-left hover:bg-accent hover:text-accent-foreground transition-colors">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{column.name}</span>
                    <span className="text-xs text-muted-foreground">{column.type}</span>
                  </div>
                </button>
              </th>
            ))}
            <th className="border border-border bg-muted"></th>
          </tr>
        </thead>

        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {/* Row number */}
              <td className="w-10 h-24 border border-gray-300 bg-gray-50 text-center text-sm text-gray-600">
                <button className="w-full h-full hover:bg-gray-100 transition-colors">
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
                      {editingCell?.row === rowIndex && editingCell?.col === column.id ? (
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
              <td className="w-10 h-24 border border-border bg-muted/30 text-center text-sm text-muted-foreground">
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

      {/* Dropdown positioned outside table */}
      {showTemplateDropdown && (
        <div className="fixed inset-0 z-50" onClick={() => setShowTemplateDropdown(false)}>
          <div
            className="absolute bg-card border border-border rounded-md shadow-xl min-w-[240px]"
            style={{
              top: '120px',
              right: '20px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {templatesList.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateSelect(template.id)}
                className="block w-full px-4 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground first:rounded-t-md last:rounded-b-md"
              >
                <div className="flex items-center justify-between">
                  <span>{template.name}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {template.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
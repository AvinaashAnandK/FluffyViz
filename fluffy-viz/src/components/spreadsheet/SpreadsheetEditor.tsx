'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SpreadsheetTable } from './SpreadsheetTable'
import { AddColumnModal } from './AddColumnModal'
import { AgentTraceViewer } from '@/components/embedding-viewer/agent-trace-viewer'
import { Model, ModelProvider } from '@/types/models'
import { useFileStorage } from '@/hooks/use-file-storage'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Download, Save, Loader2, X, ArrowUpDown } from 'lucide-react'
import { generateColumnData } from '@/lib/ai-inference'
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

  // Load file data with pagination and sorting
  useEffect(() => {
    const loadFileData = async () => {
      try {
        const storedFile = getFile(fileId)
        if (storedFile) {
          setFileName(storedFile.name)

          // Import DuckDB operations
          const { queryFileData, getFileRowCount, getFileData } = await import('@/lib/duckdb')

          // Get total row count for pagination
          const count = await getFileRowCount(fileId)
          setTotalRows(count)

          // Build sort order string
          let orderBy = 'row_index ASC'
          if (sortColumn && sortDirection) {
            orderBy = `"${sortColumn}" ${sortDirection.toUpperCase()}`
          }

          // Query paginated data
          const parsedData = await queryFileData(fileId, {
            limit: pageSize,
            offset: (currentPage - 1) * pageSize,
            orderBy
          })
          setData(parsedData)

          // Generate columns from first row (or all data if no pagination data yet)
          if (parsedData.length > 0) {
            const generatedColumns = Object.keys(parsedData[0])
              .filter(key => key !== 'row_index') // Exclude internal row_index column
              .map((key) => ({
                id: key,
                name: key,
                type: typeof parsedData[0][key] === 'number' ? 'number' : 'string',
                visible: true
              }))
            setColumns(generatedColumns)
          } else if (count > 0) {
            // If no data on this page but rows exist, load first page to get columns
            const firstPageData = await getFileData(fileId)
            if (firstPageData.length > 0) {
              const generatedColumns = Object.keys(firstPageData[0])
                .filter(key => key !== 'row_index')
                .map((key) => ({
                  id: key,
                  name: key,
                  type: typeof firstPageData[0][key] === 'number' ? 'number' : 'string',
                  visible: true
                }))
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
  }, [fileId, getFile, currentPage, pageSize, sortColumn, sortDirection])

  const addColumn = (columnData: {
    name: string
    prompt: string
    model: Model
    provider: ModelProvider
    searchWeb?: boolean
  }) => {
    const newColumn: Column = {
      id: `col_${Date.now()}`,
      name: columnData.name,
      type: 'string',
      visible: true,
      isAIGenerated: true,
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

    // Add empty data for the new column to all rows
    setData(prev => prev.map(row => ({
      ...row,
      [newColumn.id]: ''
    })))

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
      // Extract column references from prompt (e.g., {{column_name}})
      const columnReferences = extractColumnReferences(columnData.prompt)

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
          // Ensure LLM response is stored as plain string (prevent any parsing)
          const cellValue = String(result.content || result.error || '[Error]')

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
      )
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

  const updateCellValue = (rowIndex: number, columnId: string, value: any) => {
    setData(prev =>
      prev.map((row, index) =>
        index === rowIndex
          ? { ...row, [columnId]: value }
          : row
      )
    )
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
      <div className="container mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{fileName}</h1>
              <p className="text-sm text-muted-foreground">
                {data.length} rows × {columns.length} columns
              </p>
            </div>
          </div>
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

        {/* Tabs for Spreadsheet and Agent Trace Viewer */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'spreadsheet' | 'embeddings')} className="w-full">
          <TabsList>
            <TabsTrigger value="spreadsheet">Spreadsheet</TabsTrigger>
            <TabsTrigger value="embeddings">Agent Trace Viewer</TabsTrigger>
          </TabsList>

          <TabsContent value="spreadsheet" className="mt-4">
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
                <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="flex items-center gap-4 flex-wrap">
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

                    {/* Active Filters Display */}
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
                availableColumns={columns.map(col => col.name)}
                dataRows={data}
              />
            </Card>
          </TabsContent>

          <TabsContent value="embeddings" className="mt-4">
            <Card className="rounded-2xl shadow-sm h-[calc(100vh-250px)]">
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

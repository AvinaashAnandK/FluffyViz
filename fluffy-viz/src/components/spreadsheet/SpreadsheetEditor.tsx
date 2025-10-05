'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SpreadsheetTable } from './SpreadsheetTable'
import { AddColumnModal } from './AddColumnModal'
import { Model, ModelProvider } from '@/types/models'
import { useFileStorage } from '@/hooks/use-file-storage'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Save, Loader2 } from 'lucide-react'
import { generateColumnData } from '@/lib/ai-inference'
import { interpolatePrompt } from '@/config/ai-column-templates'
import { parseFileContent } from '@/lib/format-parser'

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

  // Load file data on mount
  useEffect(() => {
    const loadFileData = async () => {
      try {
        const storedFile = getFile(fileId)
        if (storedFile) {
          setFileName(storedFile.name)

          // Parse the file content using format-aware parser
          const parsedData = await parseFileContent(storedFile.content, storedFile.format as any)
          setData(parsedData)

          // Generate columns from the first data row
          if (parsedData.length > 0) {
            const generatedColumns = Object.keys(parsedData[0]).map((key) => ({
              id: key,
              name: key,
              type: typeof parsedData[0][key] === 'number' ? 'number' : 'string',
              visible: true
            }))
            setColumns(generatedColumns)
          }
        }
      } catch (error) {
        console.error('Error loading file:', error)
      } finally {
        setLoading(false)
      }
    }

    loadFileData()
  }, [fileId, getFile])

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

    try {
      // Extract column references from prompt (e.g., {{column_name}})
      const columnReferences = extractColumnReferences(columnData.prompt)

      // Generate data for all rows
      const results = await generateColumnData(
        data,
        column.id,
        columnData.prompt,
        columnData.model,
        columnData.provider,
        columnReferences,
        (current, total) => setGenerationProgress({ current, total })
      )

      // Update cells with generated content
      const updatedData = data.map((row, index) => {
        const result = results.get(index)
        return {
          ...row,
          [column.id]: result?.content || result?.error || '[Error]'
        }
      })

      setData(updatedData)
    } catch (error) {
      console.error('Error generating column data:', error)
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

  const handleSave = async () => {
    // Convert data back to CSV format
    const csvContent = convertToCSV(data, columns)
    await saveFile(csvContent, fileName, 'csv', 'text/csv', fileId)
  }

  const convertToCSV = (data: SpreadsheetData[], columns: Column[]): string => {
    const headers = columns.filter(col => col.visible).map(col => col.name)
    const rows = data.map(row =>
      columns.filter(col => col.visible).map(col => row[col.id] || '').join(',')
    )
    return [headers.join(','), ...rows].join('\n')
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

        {/* Spreadsheet Card with integrated drawer */}
        <Card className="rounded-2xl shadow-sm relative overflow-hidden">
          <CardHeader>
            <CardTitle className="font-sans">Spreadsheet Editor</CardTitle>
          </CardHeader>

          {/* Content area that shifts left when drawer opens */}
          <CardContent
            className={`transition-all duration-300 ease-in-out ${
              isAddColumnModalOpen ? 'mr-[440px]' : 'mr-0'
            }`}
          >
            <SpreadsheetTable
              data={data}
              columns={columns}
              onAddColumn={() => setIsAddColumnModalOpen(true)}
              onCellChange={updateCellValue}
              onColumnTemplateSelect={setSelectedColumnTemplate}
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
          />
        </Card>
      </div>
    </div>
  )
}

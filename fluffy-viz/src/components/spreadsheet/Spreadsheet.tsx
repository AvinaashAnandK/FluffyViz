'use client'

import { useState } from 'react'
import { SpreadsheetTable } from './SpreadsheetTable'
import { AddColumnModal } from './AddColumnModal'
import { Model, ModelProvider } from '@/types/models'
import { TaskType } from '@/types/tasks'

// Sample data from our CSV testing
const SAMPLE_DATA = [
  {
    turn_id: 1,
    session_id: 'sess_123',
    user_id: 'user_456',
    timestamp: '2024-01-15T10:30:00Z',
    user_message: 'What is the capital of France?',
    assistant_message: 'The capital of France is Paris.',
    model: 'gpt-4',
    prompt_tokens: 8,
    completion_tokens: 7,
    total_tokens: 15,
    latency_ms: 1900,
    cost_usd: 0.00045
  },
  {
    turn_id: 2,
    session_id: 'sess_123',
    user_id: 'user_456',
    timestamp: '2024-01-15T10:31:00Z',
    user_message: 'Tell me more about Paris.',
    assistant_message: 'Paris is the largest city in France and is known for its art, culture, and landmarks like the Eiffel Tower and Louvre Museum.',
    model: 'gpt-4',
    prompt_tokens: 20,
    completion_tokens: 28,
    total_tokens: 48,
    latency_ms: 4800,
    cost_usd: 0.00144
  },
  {
    turn_id: 3,
    session_id: 'sess_124',
    user_id: 'user_789',
    timestamp: '2024-01-15T14:15:30Z',
    user_message: 'How do I implement a binary search algorithm?',
    assistant_message: 'A binary search algorithm works by repeatedly dividing a sorted array in half. Here\'s a Python implementation: def binary_search(arr, target): left, right = 0, len(arr) - 1; while left <= right: mid = (left + right) // 2; if arr[mid] == target: return mid; elif arr[mid] < target: left = mid + 1; else: right = mid - 1; return -1',
    model: 'gpt-4',
    prompt_tokens: 12,
    completion_tokens: 95,
    total_tokens: 107,
    latency_ms: 4900,
    cost_usd: 0.00321
  },
  {
    turn_id: 4,
    session_id: 'sess_125',
    user_id: 'user_101',
    timestamp: '2024-01-15T16:45:20Z',
    user_message: 'What\'s the weather like today?',
    assistant_message: 'I don\'t have access to real-time weather data. Please check a weather service or app for current conditions in your area.',
    model: 'gpt-4',
    prompt_tokens: 10,
    completion_tokens: 22,
    total_tokens: 32,
    latency_ms: 2100,
    cost_usd: 0.00096
  },
  {
    turn_id: 5,
    session_id: 'sess_126',
    user_id: 'user_202',
    timestamp: '2024-01-15T18:22:15Z',
    user_message: 'Explain quantum computing in simple terms.',
    assistant_message: 'Quantum computing uses quantum mechanical phenomena like superposition and entanglement to process information. Unlike classical bits that are either 0 or 1, quantum bits (qubits) can exist in multiple states simultaneously, potentially allowing quantum computers to solve certain problems much faster than classical computers.',
    model: 'gpt-4',
    prompt_tokens: 8,
    completion_tokens: 52,
    total_tokens: 60,
    latency_ms: 3800,
    cost_usd: 0.0018
  }
]

export interface Column {
  id: string
  name: string
  type: string
  visible: boolean
  model?: Model
  provider?: ModelProvider
  prompt?: string
  taskType?: TaskType
  searchWeb?: boolean
}

export interface SpreadsheetData {
  [key: string]: any
}

export function Spreadsheet() {
  const [data, setData] = useState<SpreadsheetData[]>(SAMPLE_DATA)
  const [columns, setColumns] = useState<Column[]>(() => {
    // Generate columns from the first data row
    if (SAMPLE_DATA.length > 0) {
      return Object.keys(SAMPLE_DATA[0]).map((key, index) => ({
        id: key,
        name: key,
        type: typeof SAMPLE_DATA[0][key] === 'number' ? 'bigint' : 'string',
        visible: true
      }))
    }
    return []
  })

  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false)
  const [selectedColumnTemplate, setSelectedColumnTemplate] = useState<string | null>(null)

  const addColumn = (columnData: {
    name: string
    prompt: string
    model: Model
    provider: ModelProvider
    taskType: TaskType
    searchWeb?: boolean
  }) => {
    const newColumn: Column = {
      id: `column_${Date.now()}`,
      name: columnData.name,
      type: 'string',
      visible: true,
      model: columnData.model,
      provider: columnData.provider,
      prompt: columnData.prompt,
      taskType: columnData.taskType,
      searchWeb: columnData.searchWeb
    }

    setColumns(prev => [...prev, newColumn])

    // Add empty data for the new column to all rows
    setData(prev => prev.map(row => ({
      ...row,
      [newColumn.id]: ''
    })))

    // TODO: In the future, this is where we would trigger AI processing
    // For now, we just add empty cells that can be manually edited
    console.log('New AI column added:', {
      name: columnData.name,
      model: columnData.model.name,
      provider: columnData.provider.displayName,
      prompt: columnData.prompt,
      taskType: columnData.taskType,
      searchWeb: columnData.searchWeb
    })

    setIsAddColumnModalOpen(false)
    setSelectedColumnTemplate(null)
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

  return (
    <div className="w-full">
      <SpreadsheetTable
        data={data}
        columns={columns}
        onAddColumn={() => setIsAddColumnModalOpen(true)}
        onCellChange={updateCellValue}
        onColumnTemplateSelect={setSelectedColumnTemplate}
      />

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
    </div>
  )
}
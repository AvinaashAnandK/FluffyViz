'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'

export type AggregationStrategy = 'turn_only' | 'history_until_turn' | 'turn_plus_n' | 'full_conversation'

export interface ConversationalHistoryConfigData {
  conversationIdColumn: string
  sequenceIdColumn: string
  aggregationStrategy: AggregationStrategy
  turnPlusN: number
  selectedFormatColumns: string[]
}

interface ConversationalHistoryConfigProps {
  availableColumns: string[]
  dataRows: any[]
  onConfigChange: (config: ConversationalHistoryConfigData | null) => void
}

export function ConversationalHistoryConfig({
  availableColumns,
  dataRows,
  onConfigChange
}: ConversationalHistoryConfigProps) {
  const [conversationIdColumn, setConversationIdColumn] = useState<string>('')
  const [sequenceIdColumn, setSequenceIdColumn] = useState<string>('')
  const [aggregationStrategy, setAggregationStrategy] = useState<AggregationStrategy>('history_until_turn')
  const [turnPlusN, setTurnPlusN] = useState<number>(3)
  const [selectedFormatColumns, setSelectedFormatColumns] = useState<string[]>([])
  const [showPreview, setShowPreview] = useState(false)

  // Auto-detect potential conversation/sequence columns
  useEffect(() => {
    const potentialConvId = availableColumns.find(col =>
      col.toLowerCase().includes('session') ||
      col.toLowerCase().includes('conversation') ||
      col.toLowerCase().includes('conv_id')
    )
    const potentialSeqId = availableColumns.find(col =>
      col.toLowerCase().includes('timestamp') ||
      col.toLowerCase().includes('turn') ||
      col.toLowerCase().includes('index') ||
      col.toLowerCase().includes('order')
    )

    if (potentialConvId) setConversationIdColumn(potentialConvId)
    if (potentialSeqId) setSequenceIdColumn(potentialSeqId)
  }, [availableColumns])

  // Available columns for turn format (excluding identifiers)
  const formatColumnOptions = useMemo(() => {
    return availableColumns.filter(col =>
      col !== conversationIdColumn &&
      col !== sequenceIdColumn
    )
  }, [availableColumns, conversationIdColumn, sequenceIdColumn])

  // Generate preview data
  const previewData = useMemo(() => {
    if (!conversationIdColumn || !sequenceIdColumn || !dataRows.length) return null

    // Group rows by conversation ID
    const conversations = new Map<string, any[]>()
    dataRows.forEach(row => {
      const convId = row[conversationIdColumn]
      if (!conversations.has(convId)) {
        conversations.set(convId, [])
      }
      conversations.get(convId)!.push(row)
    })

    // Sort each conversation by sequence
    conversations.forEach((turns, convId) => {
      turns.sort((a, b) => {
        const aSeq = a[sequenceIdColumn]
        const bSeq = b[sequenceIdColumn]
        if (typeof aSeq === 'number') return aSeq - bSeq
        return String(aSeq).localeCompare(String(bSeq))
      })
    })

    // Pick first conversation with multiple turns for preview
    let selectedConv: string | null = null
    let selectedTurns: any[] = []
    for (const [convId, turns] of conversations) {
      if (turns.length >= 3) {
        selectedConv = convId
        selectedTurns = turns
        break
      }
    }

    if (!selectedConv) {
      // Fallback to first conversation
      const firstEntry = Array.from(conversations.entries())[0]
      if (firstEntry) {
        selectedConv = firstEntry[0]
        selectedTurns = firstEntry[1]
      }
    }

    if (!selectedConv || selectedTurns.length === 0) return null

    // Build preview for turn 3 (or last turn if fewer)
    const currentTurnIndex = Math.min(2, selectedTurns.length - 1)
    let relevantTurns: any[] = []

    switch (aggregationStrategy) {
      case 'turn_only':
        relevantTurns = [selectedTurns[currentTurnIndex]]
        break
      case 'history_until_turn':
        relevantTurns = selectedTurns.slice(0, currentTurnIndex + 1)
        break
      case 'turn_plus_n':
        const startIdx = Math.max(0, currentTurnIndex - turnPlusN + 1)
        relevantTurns = selectedTurns.slice(startIdx, currentTurnIndex + 1)
        break
      case 'full_conversation':
        relevantTurns = selectedTurns
        break
    }

    return {
      conversationId: selectedConv,
      currentTurnIndex: currentTurnIndex + 1,
      totalTurns: selectedTurns.length,
      turns: relevantTurns,
    }
  }, [conversationIdColumn, sequenceIdColumn, dataRows, aggregationStrategy, turnPlusN])

  // Update parent config
  useEffect(() => {
    if (conversationIdColumn && sequenceIdColumn && selectedFormatColumns.length > 0) {
      onConfigChange({
        conversationIdColumn,
        sequenceIdColumn,
        aggregationStrategy,
        turnPlusN,
        selectedFormatColumns
      })
    } else {
      onConfigChange(null)
    }
  }, [conversationIdColumn, sequenceIdColumn, aggregationStrategy, turnPlusN, selectedFormatColumns, onConfigChange])

  const addFormatColumn = (column: string) => {
    if (!selectedFormatColumns.includes(column)) {
      setSelectedFormatColumns(prev => [...prev, column])
    }
  }

  const removeFormatColumn = (column: string) => {
    setSelectedFormatColumns(prev => prev.filter(c => c !== column))
  }

  const getStrategyDescription = (strategy: AggregationStrategy): string => {
    switch (strategy) {
      case 'turn_only':
        return 'Just current row'
      case 'history_until_turn':
        return 'All turns up to current'
      case 'turn_plus_n':
        return `Current + ${turnPlusN} previous`
      case 'full_conversation':
        return 'All turns in session'
    }
  }

  return (
    <div className="space-y-6">
      {/* Conversation Identifier */}
      <div>
        <Label htmlFor="conv-id" className="text-sm font-medium mb-2 block">
          Conversation Identifier
        </Label>
        <Select value={conversationIdColumn} onValueChange={setConversationIdColumn}>
          <SelectTrigger id="conv-id">
            <SelectValue placeholder="Select column..." />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map(col => (
              <SelectItem key={col} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Groups rows into conversations
        </p>
      </div>

      {/* Sequence Identifier */}
      <div>
        <Label htmlFor="seq-id" className="text-sm font-medium mb-2 block">
          Sequence Identifier
        </Label>
        <Select value={sequenceIdColumn} onValueChange={setSequenceIdColumn}>
          <SelectTrigger id="seq-id">
            <SelectValue placeholder="Select column..." />
          </SelectTrigger>
          <SelectContent>
            {availableColumns.map(col => (
              <SelectItem key={col} value={col}>{col}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Orders turns within conversation
        </p>
      </div>

      {/* Aggregation Strategy */}
      <div>
        <Label className="text-sm font-medium mb-3 block">
          Aggregation Strategy
        </Label>
        <RadioGroup value={aggregationStrategy} onValueChange={(val) => setAggregationStrategy(val as AggregationStrategy)}>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="turn_only" id="turn_only" />
              <Label htmlFor="turn_only" className="font-normal cursor-pointer flex-1">
                Turn only
                <span className="text-xs text-muted-foreground ml-2">(Just current row)</span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="history_until_turn" id="history_until_turn" />
              <Label htmlFor="history_until_turn" className="font-normal cursor-pointer flex-1">
                History until turn
                <span className="text-xs text-muted-foreground ml-2">(All turns up to current)</span>
              </Label>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-2">
                <RadioGroupItem value="turn_plus_n" id="turn_plus_n" />
                <Label htmlFor="turn_plus_n" className="font-normal cursor-pointer flex-1">
                  Turn plus N
                  <span className="text-xs text-muted-foreground ml-2">(Current + N previous)</span>
                </Label>
              </div>
              {aggregationStrategy === 'turn_plus_n' && (
                <div className="ml-6 mt-2 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">N =</span>
                    <Slider
                      value={[turnPlusN]}
                      onValueChange={(val) => setTurnPlusN(val[0])}
                      min={1}
                      max={10}
                      step={1}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12 text-right">{turnPlusN} turns</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full_conversation" id="full_conversation" />
              <Label htmlFor="full_conversation" className="font-normal cursor-pointer flex-1">
                Full conversation
                <span className="text-xs text-muted-foreground ml-2">(All turns in session)</span>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Turn Format */}
      <div>
        <Label className="text-sm font-medium mb-2 block">
          Turn Format (columns to include per turn)
        </Label>

        {/* Selected columns */}
        {selectedFormatColumns.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedFormatColumns.map(col => (
              <Badge key={col} variant="secondary" className="gap-1">
                {col}
                <button
                  onClick={() => removeFormatColumn(col)}
                  className="ml-1 hover:bg-muted rounded-sm"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add column selector */}
        <Select value="" onValueChange={addFormatColumn}>
          <SelectTrigger>
            <SelectValue placeholder="Add column to format..." />
          </SelectTrigger>
          <SelectContent>
            {formatColumnOptions
              .filter(col => !selectedFormatColumns.includes(col))
              .map(col => (
                <SelectItem key={col} value={col}>
                  <div className="flex items-center gap-2">
                    <Plus className="w-3 h-3" />
                    {col}
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      {previewData && selectedFormatColumns.length > 0 && (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="mb-2"
          >
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>

          {showPreview && (
            <div className="border border-border rounded-md p-3 bg-muted/30 text-sm space-y-1">
              <div className="text-xs text-muted-foreground mb-2">
                Conversation: {String(previewData.conversationId).substring(0, 20)}...,
                Turn {previewData.currentTurnIndex}/{previewData.totalTurns}
              </div>
              <div className="font-mono text-xs bg-background p-3 rounded border border-border max-h-64 overflow-y-auto whitespace-pre-wrap">
                {previewData.turns.map((turn, idx) => (
                  <div key={idx} className="mb-3 last:mb-0">
                    <div className="text-blue-600 dark:text-blue-400 font-semibold">
                      [Turn {idx + 1}]{idx === previewData.turns.length - 1 && ' ← CURRENT'}
                    </div>
                    {selectedFormatColumns.map(col => (
                      <div key={col}>
                        <span className="text-green-600 dark:text-green-400">{col}:</span> {String(turn[col] || '')}
                      </div>
                    ))}
                    {idx < previewData.turns.length - 1 && <div className="text-gray-400 my-1">---</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

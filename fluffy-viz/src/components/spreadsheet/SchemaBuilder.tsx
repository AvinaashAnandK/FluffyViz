'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { FieldSchema, FieldType, ColumnExpansionMode } from '@/types/structured-output'
import { FIELD_TYPE_LABELS, FIELD_TYPE_DESCRIPTIONS } from '@/types/structured-output'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

// Separate component for enum options to manage local state
function EnumOptionsInput({
  fieldId,
  enumOptions,
  updateField
}: {
  fieldId: string
  enumOptions?: string[]
  updateField: (id: string, updates: Partial<FieldSchema>) => void
}) {
  const [localValue, setLocalValue] = useState(enumOptions?.join(', ') || '')

  // Sync with parent when options change externally
  useEffect(() => {
    const parentValue = enumOptions?.join(', ') || ''
    // Only sync if not currently focused (user not typing)
    if (document.activeElement?.id !== `${fieldId}-options`) {
      setLocalValue(parentValue)
    }
  }, [enumOptions, fieldId])

  return (
    <div>
      <Label htmlFor={`${fieldId}-options`} className="text-xs text-gray-500 dark:text-gray-400">
        Options (comma-separated)
      </Label>
      <Input
        id={`${fieldId}-options`}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          // Parse and clean up on blur
          const options = localValue
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0)
          updateField(fieldId, { enumOptions: options })
          setLocalValue(options.join(', '))
        }}
        placeholder="option1, option2, option3"
        className="h-8 text-sm"
      />
    </div>
  )
}

interface SchemaBuilderProps {
  fields: FieldSchema[]
  onChange: (fields: FieldSchema[]) => void
  expansionMode: ColumnExpansionMode
  onExpansionModeChange: (mode: ColumnExpansionMode) => void
  baseColumnName?: string
}

const FIELD_TYPES: FieldType[] = [
  'string',
  'number',
  'boolean',
  'array_string',
  'array_number',
  'enum'
]

export function SchemaBuilder({
  fields,
  onChange,
  expansionMode,
  onExpansionModeChange,
  baseColumnName
}: SchemaBuilderProps) {
  const addField = () => {
    const newField: FieldSchema = {
      id: `field_${Date.now()}`,
      name: '',
      type: 'string',
      required: true,
      description: ''
    }
    onChange([...fields, newField])
  }

  const removeField = (id: string) => {
    onChange(fields.filter(f => f.id !== id))
  }

  const updateField = (id: string, updates: Partial<FieldSchema>) => {
    onChange(
      fields.map(f =>
        f.id === id ? { ...f, ...updates } : f
      )
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Define Output Schema
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addField}
          className="h-8"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border border-dashed border-gray-300 dark:border-gray-700 rounded-md">
          No fields defined. Click &quot;Add Field&quot; to start building your schema.
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Field {index + 1}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeField(field.id)}
                className="h-7 w-7 p-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Field Name */}
            <div>
              <Label htmlFor={`${field.id}-name`} className="text-xs text-gray-500 dark:text-gray-400">
                Name
              </Label>
              <Input
                id={`${field.id}-name`}
                value={field.name}
                onChange={(e) => updateField(field.id, { name: e.target.value })}
                placeholder="field_name"
                className="h-8 text-sm"
              />
            </div>

            {/* Field Type */}
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Label htmlFor={`${field.id}-type`} className="text-xs text-gray-500 dark:text-gray-400">
                  Type
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p className="text-xs">{FIELD_TYPE_DESCRIPTIONS[field.type]}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={field.type}
                onValueChange={(value: FieldType) => updateField(field.id, { type: value })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="text-sm">
                      {FIELD_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enum Options (shown only for enum type) */}
            {field.type === 'enum' && (
              <EnumOptionsInput
                fieldId={field.id}
                enumOptions={field.enumOptions}
                updateField={updateField}
              />
            )}

            {/* Array Min/Max (shown only for array types) */}
            {(field.type === 'array_string' || field.type === 'array_number') && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={`${field.id}-min`} className="text-xs text-gray-500 dark:text-gray-400">
                    Min Items
                  </Label>
                  <Input
                    id={`${field.id}-min`}
                    type="number"
                    min="0"
                    value={field.minItems ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined
                      updateField(field.id, { minItems: val })
                    }}
                    placeholder="0"
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor={`${field.id}-max`} className="text-xs text-gray-500 dark:text-gray-400">
                    Max Items
                  </Label>
                  <Input
                    id={`${field.id}-max`}
                    type="number"
                    min="0"
                    value={field.maxItems ?? ''}
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : undefined
                      updateField(field.id, { maxItems: val })
                    }}
                    placeholder="No limit"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <Label htmlFor={`${field.id}-desc`} className="text-xs text-gray-500 dark:text-gray-400">
                Description (optional)
              </Label>
              <Input
                id={`${field.id}-desc`}
                value={field.description || ''}
                onChange={(e) => updateField(field.id, { description: e.target.value })}
                placeholder="Describe what this field should contain..."
                className="h-8 text-sm"
              />
            </div>

            {/* Required Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id={`${field.id}-required`}
                checked={field.required}
                onCheckedChange={(checked) => updateField(field.id, { required: checked as boolean })}
              />
              <Label
                htmlFor={`${field.id}-required`}
                className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
              >
                Required field
              </Label>
            </div>
          </div>
        ))}
      </div>

      {/* Column Output Options */}
      {fields.length > 0 && (
        <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Column Output Options
          </Label>
          <RadioGroup value={expansionMode} onValueChange={onExpansionModeChange}>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single" id="mode-single" />
                <Label htmlFor="mode-single" className="text-sm font-normal cursor-pointer">
                  <div className="font-medium">Single JSON column</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Store all fields as JSON in one column: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{baseColumnName || 'column_name'}</code>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="expanded" id="mode-expanded" />
                <Label htmlFor="mode-expanded" className="text-sm font-normal cursor-pointer">
                  <div className="font-medium">Separate column for each field</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Create individual columns:{' '}
                    {fields.slice(0, 2).map((f, i) => (
                      <span key={f.id}>
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">
                          {baseColumnName || 'column'}_{f.name || `field${i + 1}`}
                        </code>
                        {i < Math.min(fields.length - 1, 1) && ', '}
                      </span>
                    ))}
                    {fields.length > 2 && '...'}
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <RadioGroupItem value="both" id="mode-both" />
                <Label htmlFor="mode-both" className="text-sm font-normal cursor-pointer">
                  <div className="font-medium">Both (JSON + individual columns)</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Create JSON column and separate field columns
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>
      )}
    </div>
  )
}

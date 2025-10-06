'use client'

import { useState, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ColumnMeta } from '@/lib/prompt-serializer'
import { createPortal } from 'react-dom'

export interface ColumnComboboxProps {
  columns: ColumnMeta[]
  isOpen: boolean
  onSelect: (column: ColumnMeta) => void
  onCancel: () => void
  anchorElement: HTMLElement | null
  selectedColumnId?: string
}

export function ColumnCombobox({
  columns,
  isOpen,
  onSelect,
  onCancel,
  anchorElement,
  selectedColumnId,
}: ColumnComboboxProps) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('[ColumnCombobox] State changed:', { isOpen, hasAnchor: !!anchorElement })
    if (isOpen && anchorElement) {
      const rect = anchorElement.getBoundingClientRect()

      // Use fixed positioning (no scroll offset needed)
      const newPosition = {
        top: rect.bottom + 4,
        left: rect.left,
      }
      console.log('[ColumnCombobox] Setting position:', newPosition, 'from rect:', rect)
      setPosition(newPosition)
    }
  }, [isOpen, anchorElement])

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
    }
  }, [isOpen])

  const filteredColumns = columns.filter(column =>
    column.displayName.toLowerCase().includes(search.toLowerCase()) ||
    column.slug.toLowerCase().includes(search.toLowerCase())
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  if (!isOpen || !anchorElement || !mounted) {
    console.log('[ColumnCombobox] Not rendering:', { isOpen, hasAnchor: !!anchorElement, mounted })
    return null
  }

  console.log('[ColumnCombobox] Rendering dropdown at position:', position)

  const content = (
    <div
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
      }}
      className="animate-in fade-in-0 zoom-in-95"
    >
      <div className="w-[300px] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none">
        <Command>
          <CommandInput
            placeholder="Search columns..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filteredColumns.length === 0 && (
              <CommandEmpty>No columns found.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredColumns.map((column) => {
                const isSelected = selectedColumnId === column.id
                const previewText = column.preview || 'No preview available'
                const displayPreview = previewText.length > 50
                  ? previewText.substring(0, 50) + '...'
                  : previewText

                return (
                  <CommandItem
                    key={column.id}
                    value={column.slug}
                    onSelect={() => onSelect(column)}
                    className="flex flex-col items-start py-2 cursor-pointer"
                  >
                    <div className="flex items-center w-full">
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          isSelected ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="font-semibold text-sm">
                        {column.displayName}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1">
                      {displayPreview === 'null' || displayPreview === 'undefined'
                        ? 'Null'
                        : displayPreview}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}

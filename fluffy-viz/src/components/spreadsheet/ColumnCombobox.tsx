'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
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

const DEFAULT_MAX_HEIGHT = 320
const MIN_MAX_HEIGHT = 160
const VIEWPORT_GUTTER = 8
const INPUT_WRAPPER_HEIGHT = 52

export function ColumnCombobox({
  columns,
  isOpen,
  onSelect,
  onCancel,
  anchorElement,
  selectedColumnId,
}: ColumnComboboxProps) {
  const [search, setSearch] = useState('')
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    maxHeight: DEFAULT_MAX_HEIGHT,
    placement: 'bottom' as 'top' | 'bottom',
  })
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    if (!anchorElement || !containerRef.current) return

    const anchorRect = anchorElement.getBoundingClientRect()
    const dropdownRect = containerRef.current.getBoundingClientRect()

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const dropdownWidth = dropdownRect.width
    const preferredHeight = dropdownRect.height

    let left = anchorRect.left
    if (left + dropdownWidth > viewportWidth - VIEWPORT_GUTTER) {
      left = Math.max(VIEWPORT_GUTTER, viewportWidth - dropdownWidth - VIEWPORT_GUTTER)
    }
    if (left < VIEWPORT_GUTTER) {
      left = VIEWPORT_GUTTER
    }

    const spaceBelow = viewportHeight - anchorRect.bottom - VIEWPORT_GUTTER
    const spaceAbove = anchorRect.top - VIEWPORT_GUTTER
    let placement: 'top' | 'bottom' = 'bottom'
    let maxHeight = Math.min(Math.max(spaceBelow, spaceAbove), viewportHeight - VIEWPORT_GUTTER * 2)
    let top = anchorRect.bottom + VIEWPORT_GUTTER

    if (preferredHeight > spaceBelow && spaceAbove > spaceBelow) {
      placement = 'top'
      const height = Math.min(preferredHeight, spaceAbove)
      maxHeight = Math.min(Math.max(height, MIN_MAX_HEIGHT), viewportHeight - VIEWPORT_GUTTER * 2)
      top = Math.max(VIEWPORT_GUTTER, anchorRect.top - height - VIEWPORT_GUTTER)
    } else {
      const height = Math.min(preferredHeight, spaceBelow)
      maxHeight = Math.min(Math.max(height, MIN_MAX_HEIGHT), viewportHeight - VIEWPORT_GUTTER * 2)
      top = Math.min(top, viewportHeight - maxHeight - VIEWPORT_GUTTER)
    }

    setPosition(prev => {
      if (
        prev.top === top &&
        prev.left === left &&
        prev.maxHeight === maxHeight &&
        prev.placement === placement
      ) {
        return prev
      }
      return { top, left, maxHeight, placement }
    })
  }, [anchorElement])

  useEffect(() => {
    if (!isOpen || !anchorElement) return

    updatePosition()

    const handleRelayout = () => updatePosition()
    document.addEventListener('scroll', handleRelayout, true)
    window.addEventListener('resize', handleRelayout)

    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleRelayout)
      observer.observe(anchorElement)
      if (containerRef.current) {
        observer.observe(containerRef.current)
      }
    }

    return () => {
      document.removeEventListener('scroll', handleRelayout, true)
      window.removeEventListener('resize', handleRelayout)
      observer?.disconnect()
    }
  }, [isOpen, anchorElement, updatePosition])

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      return
    }

    const focusTimer = requestAnimationFrame(() => {
      const input = containerRef.current?.querySelector<HTMLInputElement>('input[data-slot="command-input"]')
      if (input) {
        input.focus()
        input.select()
      }
    })

    return () => cancelAnimationFrame(focusTimer)
  }, [isOpen])

  const filteredColumns = columns.filter(column => {
    const haystack = [
      column.displayName,
      column.slug,
      column.label ?? '',
    ]
      .map(value => value.toLowerCase())
    const needle = search.toLowerCase()
    return haystack.some(value => value.includes(needle))
  })

  useEffect(() => {
    if (!isOpen) return
    const raf = requestAnimationFrame(() => updatePosition())
    return () => cancelAnimationFrame(raf)
  }, [isOpen, updatePosition, filteredColumns.length])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation()
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    }
  }

  if (!isOpen || !anchorElement || !mounted) {
    return null
  }

  const listMaxHeight = Math.max(position.maxHeight - INPUT_WRAPPER_HEIGHT, MIN_MAX_HEIGHT)

  const content = (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 9999,
        maxHeight: position.maxHeight,
      }}
      className={`animate-in fade-in-0 zoom-in-95 ${
        position.placement === 'top' ? 'origin-bottom' : 'origin-top'
      }`}
      onKeyDown={handleKeyDown}
    >
      <div className="w-[300px] rounded-md border bg-popover p-0 text-popover-foreground shadow-md outline-none">
        <Command>
          <CommandInput
            placeholder="Search columns..."
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList style={{ maxHeight: listMaxHeight }}>
            {filteredColumns.length === 0 && (
              <CommandEmpty>No columns found.</CommandEmpty>
            )}
            <CommandGroup>
              {filteredColumns.map((column) => {
                const isSelected = selectedColumnId === column.id
                const previewText = column.preview || 'No preview available'
                const displayPreview = previewText.length > 50
                  ? `${previewText.substring(0, 50)}...`
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
                        {column.label ?? column.displayName}
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

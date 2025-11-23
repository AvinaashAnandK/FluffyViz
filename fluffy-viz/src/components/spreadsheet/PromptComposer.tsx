'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { VariableNode } from '@/lib/tiptap/variable-node'
import { MentionTrigger } from '@/lib/tiptap/mention-trigger'
import { ColumnCombobox } from './ColumnCombobox'
import {
  ColumnMeta,
  serializePrompt,
  hydrateDocumentFromTemplate,
} from '@/lib/prompt-serializer'
import { PromptConfig } from '@/config/ai-column-templates'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export interface PromptComposerProps {
  availableColumns: ColumnMeta[]
  initialTemplate?: PromptConfig
  onPromptChange: (prompt: string, isValid: boolean) => void
}

export function PromptComposer({
  availableColumns,
  initialTemplate,
  onPromptChange,
}: PromptComposerProps) {
  const [mappings, setMappings] = useState<Record<string, ColumnMeta>>({})
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [comboboxAnchor, setComboboxAnchor] = useState<HTMLElement | null>(null)
  const [activeVariableId, setActiveVariableId] = useState<string | null>(null)
  const [mentionTriggerPos, setMentionTriggerPos] = useState<number | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)

  const onPromptChangeRef = useRef(onPromptChange)
  useEffect(() => {
    onPromptChangeRef.current = onPromptChange
  }, [onPromptChange])

  const cleanupAnchor = useCallback(() => {
    setComboboxAnchor(prev => {
      if (prev && prev.parentElement === document.body) {
        prev.remove()
      }
      return null
    })
  }, [])

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
      StarterKit.configure({
        paragraph: {
          HTMLAttributes: {
            class: 'mb-2',
          },
        },
      }),
      VariableNode,
      MentionTrigger.configure({
        onTrigger: (position) => {
          console.log('[PromptComposer] @ trigger activated at position:', position)
          setMentionTriggerPos(position)
          setActiveVariableId(null)

          cleanupAnchor()

          // Get cursor position immediately (synchronously)
          const selection = window.getSelection()
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0)
            const baseRect = range.getBoundingClientRect()
            const clientRect = range.getClientRects()[0]

            let anchorLeft = clientRect?.left ?? baseRect.left
            let anchorBottom = clientRect?.bottom ?? baseRect.bottom

            if (
              (!anchorLeft && !anchorBottom) ||
              (baseRect.width === 0 && baseRect.height === 0 && editorRef.current)
            ) {
              const editorRect = editorRef.current?.getBoundingClientRect()
              if (editorRect) {
                anchorLeft = editorRect.left + 12
                anchorBottom = editorRect.top + 24
              }
            }

            console.log('[PromptComposer] Cursor rect:', {
              anchorLeft,
              anchorBottom,
              baseRect,
            })

            // Create a fake anchor element at cursor position
            const fakeAnchor = document.createElement('span')
            fakeAnchor.style.position = 'fixed'
            fakeAnchor.style.left = `${anchorLeft ?? 0}px`
            fakeAnchor.style.top = `${anchorBottom ?? 0}px`
            fakeAnchor.style.width = '1px'
            fakeAnchor.style.height = '1px'
            fakeAnchor.style.pointerEvents = 'none'
            document.body.appendChild(fakeAnchor)

            setComboboxAnchor(fakeAnchor)
            setComboboxOpen(true)
            console.log('[PromptComposer] Set @ trigger anchor and opened combobox')
          } else {
            console.error('[PromptComposer] No selection found for @ trigger')
          }
        },
        onCancel: () => {
          console.log('[PromptComposer] @ trigger cancelled')
          setComboboxOpen(false)
          cleanupAnchor()
          setMentionTriggerPos(null)
        },
      }),
    ],
    content: initialTemplate
      ? hydrateDocumentFromTemplate(
          initialTemplate.prompt_params.prompt_template,
          initialTemplate.template_variables
        )
      : {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none min-h-[150px] px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
      },
    },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON()
      const result = serializePrompt(doc, mappings)
      onPromptChangeRef.current?.(result.prompt, result.isValid)
    },
  },
  []
  )

  // Listen for variable pill clicks
  useEffect(() => {
    const handleVariablePillClick = (event: Event) => {
      const customEvent = event as CustomEvent<{
        id: string
        displayName: string
        tooltip: string
        required?: boolean
        defaultValue?: string | null
        mappedColumnId?: string
        mappedColumnName?: string
        mappedColumnSlug?: string
        pos: number
      }>

      console.log('[PromptComposer] Received variable-pill-click event:', customEvent.detail)

      const { id } = customEvent.detail
      setActiveVariableId(id)
      setMentionTriggerPos(null)

      // Find the pill element FIRST, then set anchor and open combobox
      if (editorRef.current) {
        const pillElement = editorRef.current.querySelector(
          `span[data-id="${id}"]`
        ) as HTMLElement
        if (pillElement) {
          console.log('[PromptComposer] Found pill element:', pillElement)
          setComboboxAnchor(pillElement)
          setComboboxOpen(true)
          console.log('[PromptComposer] Set comboboxOpen to true, activeVariableId:', id)
        } else {
          console.error('[PromptComposer] Could not find pill element with data-id:', id)
        }
      } else {
        console.error('[PromptComposer] editorRef.current is null')
      }
    }

    console.log('[PromptComposer] Setting up variable-pill-click event listener')
    window.addEventListener('variable-pill-click', handleVariablePillClick)
    return () => {
      console.log('[PromptComposer] Removing variable-pill-click event listener')
      window.removeEventListener('variable-pill-click', handleVariablePillClick)
    }
  }, [])

  // Update serialized prompt when mappings change
  useEffect(() => {
    if (editor) {
      const doc = editor.getJSON()
      const result = serializePrompt(doc, mappings)
      onPromptChangeRef.current?.(result.prompt, result.isValid)
    }
  }, [mappings, editor])

  useEffect(() => {
    if (!editor) return

    let cancelled = false

    const templateDoc = initialTemplate
      ? hydrateDocumentFromTemplate(
          initialTemplate.prompt_params.prompt_template,
          initialTemplate.template_variables
        )
      : {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        }

    const applyTemplate = () => {
      if (cancelled || editor.isDestroyed) {
        return
      }

      editor.commands.setContent(templateDoc, { emitUpdate: false })

      setMappings({})
      setActiveVariableId(null)
      setMentionTriggerPos(null)
      setComboboxOpen(false)
      cleanupAnchor()

      const result = serializePrompt(templateDoc, {})
      onPromptChangeRef.current?.(result.prompt, result.isValid)
    }

    if (typeof queueMicrotask === 'function') {
      queueMicrotask(applyTemplate)
    } else {
      Promise.resolve().then(applyTemplate)
    }

    return () => {
      cancelled = true
    }
  }, [editor, initialTemplate, cleanupAnchor])

  const handleColumnSelect = (column: ColumnMeta) => {
    if (!editor) return

    if (mentionTriggerPos !== null) {
      // Insert new variable from @ trigger
      // First, remove the @ character and any interim filter text
      const selectionFrom = editor.state.selection.from
      const deletionEnd = Math.max(selectionFrom, mentionTriggerPos + 1)
      editor.commands.deleteRange({
        from: mentionTriggerPos,
        to: deletionEnd,
      })

      // Generate variable ID once
      const varId = `var_${Date.now()}`

      // Insert variable node
      editor
        .chain()
        .focus()
        .insertVariable({
          id: varId,
          displayName: column.label ?? column.displayName,
          tooltip: `Column: ${column.label ?? column.displayName}`,
          required: false,
          defaultValue: null,
          mappedColumnId: column.id,
          mappedColumnName: column.label ?? column.displayName,
          mappedColumnSlug: column.slug,
        })
        .run()

      // Add to mappings
      setMappings(prev => ({
        ...prev,
        [varId]: column,
      }))
    } else if (activeVariableId) {
      // Update existing variable mapping
      editor.commands.updateVariable(activeVariableId, {
        mappedColumnId: column.id,
        mappedColumnName: column.label ?? column.displayName,
        mappedColumnSlug: column.slug,
        defaultValue: null,
      })

      setMappings(prev => ({
        ...prev,
        [activeVariableId]: column,
      }))
    }

    // Clean up
    setComboboxOpen(false)
    cleanupAnchor()
    setActiveVariableId(null)
    setMentionTriggerPos(null)
  }

  const handleComboboxCancel = () => {
    if (!editor) return

    // If this was from @ trigger, remove the @ character
    if (mentionTriggerPos !== null && editor) {
      const charAtTrigger = editor.state.doc.textBetween(
        mentionTriggerPos,
        mentionTriggerPos + 1,
        undefined,
        ''
      )
      const selectionFrom = editor.state.selection.from
      const deletionEnd = Math.max(selectionFrom, mentionTriggerPos + 1)

      if (charAtTrigger === '@' || mentionTriggerPos < selectionFrom) {
        editor.commands.deleteRange({
          from: mentionTriggerPos,
          to: deletionEnd,
        })
      }
    }

    setComboboxOpen(false)
    cleanupAnchor()
    setActiveVariableId(null)
    setMentionTriggerPos(null)
  }

  // Cleanup combobox on unmount
  useEffect(() => {
    return () => {
      console.log('[PromptComposer] Unmounting - cleaning up combobox')
      if (comboboxAnchor && comboboxAnchor.parentElement === document.body) {
        comboboxAnchor.remove()
      }
    }
  }, [comboboxAnchor])

  // Close combobox when clicking outside
  useEffect(() => {
    if (!comboboxOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      // Don't close if clicking inside the combobox itself
      if (target && target instanceof Element) {
        if (target.closest('[role="combobox"]') || target.closest('[role="option"]')) {
          return
        }
      }

      console.log('[PromptComposer] Click outside detected, closing combobox')
      handleComboboxCancel()
    }

    // Add slight delay to prevent immediate closure on the same click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [comboboxOpen])

  // Get validation info
  const docJSON = editor?.getJSON()
  const validationResult = docJSON
    ? serializePrompt(docJSON, mappings)
    : {
        prompt: '',
        previewPrompt: '',
        unmappedVariables: [],
        isValid: true,
        mappedVariableCount: 0,
        totalVariableCount: 0,
      }
  const shouldWarnAboutUngrounded =
    validationResult.totalVariableCount > 0 &&
    validationResult.mappedVariableCount === 0

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Prompt
        </label>
        <div ref={editorRef}>
          <EditorContent editor={editor} />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Type @ to insert column references, or click existing pills to change mappings.
        </p>
      </div>

      {(validationResult.unmappedVariables.length > 0 || shouldWarnAboutUngrounded) && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          {validationResult.unmappedVariables.length > 0 && (
            <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium">
              Map required fields:{' '}
              {validationResult.unmappedVariables
                .map(v => v.displayName)
                .join(', ')}
            </p>
          )}
          {shouldWarnAboutUngrounded && (
            <p className="text-sm text-yellow-800 dark:text-yellow-300 font-medium mt-1">
              No columns are mapped. This prompt will run as an ungrounded generation.
            </p>
          )}
        </div>
      )}

      <Accordion type="single" collapsible>
        <AccordionItem value="preview">
          <AccordionTrigger className="text-sm">
            Preview Prompt
          </AccordionTrigger>
          <AccordionContent>
            <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto whitespace-pre-wrap">
              {validationResult.previewPrompt}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <ColumnCombobox
        columns={availableColumns}
        isOpen={comboboxOpen}
        onSelect={handleColumnSelect}
        onCancel={handleComboboxCancel}
        anchorElement={comboboxAnchor}
        selectedColumnId={
          activeVariableId ? mappings[activeVariableId]?.id : undefined
        }
      />
    </div>
  )
}

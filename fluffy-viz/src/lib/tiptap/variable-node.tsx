import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface VariableNodeAttributes {
  id: string
  displayName: string
  tooltip: string
  required?: boolean
  defaultValue?: string | null
  mappedColumnId?: string
  mappedColumnName?: string
  mappedColumnSlug?: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variableNode: {
      insertVariable: (attributes: VariableNodeAttributes) => ReturnType
      updateVariable: (id: string, attributes: Partial<VariableNodeAttributes>) => ReturnType
    }
  }
}

const VariablePillComponent = ({ node, getPos }: NodeViewProps) => {
  const {
    id,
    displayName,
    tooltip,
    required,
    defaultValue,
    mappedColumnId,
    mappedColumnName,
    mappedColumnSlug,
  } = node.attrs as VariableNodeAttributes

  const dispatchVariableClick = () => {
    const pos = getPos()
    if (pos !== undefined) {
      const event = new CustomEvent('variable-pill-click', {
        detail: {
          id,
          displayName,
          tooltip,
          required,
          defaultValue,
          mappedColumnId,
          mappedColumnName,
          mappedColumnSlug,
          pos,
        },
      })
      console.log('[VariablePill] Dispatching event:', event.detail)
      window.dispatchEvent(event)
    } else {
      console.error('[VariablePill] getPos() returned undefined')
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('[VariablePill] Clicked:', { id, displayName, mappedColumnId })

    // Trigger custom event that PromptComposer will listen to
    dispatchVariableClick()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      dispatchVariableClick()
    }
  }

  const hasColumnMapping = Boolean(mappedColumnId)
  const hasDefaultValue = Boolean(defaultValue)
  const label = hasColumnMapping
    ? mappedColumnName || mappedColumnSlug || displayName
    : hasDefaultValue
      ? defaultValue
      : displayName

  const ariaLabelParts = [displayName]
  if (hasColumnMapping) {
    ariaLabelParts.push(`mapped to ${mappedColumnSlug || mappedColumnName}`)
  } else if (hasDefaultValue) {
    ariaLabelParts.push(`using default ${defaultValue}`)
  } else {
    ariaLabelParts.push('not mapped')
  }

  return (
    <NodeViewWrapper as="span" className="inline-block" data-id={id}>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              data-id={id}
              className={`inline-flex items-center px-2 py-0.5 mx-0.5 rounded text-sm font-medium cursor-pointer transition-colors ${
                hasColumnMapping || hasDefaultValue
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-dashed border-gray-400 dark:border-gray-600'
              }`}
              contentEditable={false}
              tabIndex={0}
              role="button"
              aria-label={ariaLabelParts.join(', ')}
            >
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
            {hasDefaultValue && !hasColumnMapping && (
              <p className="text-xs text-gray-500 mt-1">Default: {defaultValue}</p>
            )}
            {hasColumnMapping && (
              <p className="text-xs text-gray-500 mt-1">
                Mapped to: {mappedColumnSlug || mappedColumnName}
                {mappedColumnName && mappedColumnSlug && mappedColumnName !== mappedColumnSlug
                  ? ` (${mappedColumnName})`
                  : ''}
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </NodeViewWrapper>
  )
}

export const VariableNode = Node.create({
  name: 'variableNode',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: element => element.getAttribute('data-id'),
        renderHTML: attributes => {
          return {
            'data-id': attributes.id,
          }
        },
      },
      displayName: {
        default: '',
        parseHTML: element => element.getAttribute('data-display-name'),
        renderHTML: attributes => {
          return {
            'data-display-name': attributes.displayName,
          }
        },
      },
      tooltip: {
        default: '',
        parseHTML: element => element.getAttribute('data-tooltip'),
        renderHTML: attributes => {
          return {
            'data-tooltip': attributes.tooltip,
          }
        },
      },
      required: {
        default: true,
        parseHTML: element =>
          element.getAttribute('data-required') !== 'false',
        renderHTML: attributes => {
          if (attributes.required === false) {
            return {
              'data-required': 'false',
            }
          }
          return {}
        },
      },
      defaultValue: {
        default: null,
        parseHTML: element => element.getAttribute('data-default-value'),
        renderHTML: attributes => {
          if (!attributes.defaultValue) return {}
          return {
            'data-default-value': attributes.defaultValue,
          }
        },
      },
      mappedColumnId: {
        default: null,
        parseHTML: element => element.getAttribute('data-mapped-column-id'),
        renderHTML: attributes => {
          if (!attributes.mappedColumnId) return {}
          return {
            'data-mapped-column-id': attributes.mappedColumnId,
          }
        },
      },
      mappedColumnName: {
        default: null,
        parseHTML: element => element.getAttribute('data-mapped-column-name'),
        renderHTML: attributes => {
          if (!attributes.mappedColumnName) return {}
          return {
            'data-mapped-column-name': attributes.mappedColumnName,
          }
        },
      },
      mappedColumnSlug: {
        default: null,
        parseHTML: element => element.getAttribute('data-mapped-column-slug'),
        renderHTML: attributes => {
          if (!attributes.mappedColumnSlug) return {}
          return {
            'data-mapped-column-slug': attributes.mappedColumnSlug,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="variable"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes({ 'data-type': 'variable' }, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariablePillComponent)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('variableNodeNavigation'),
        props: {
          handleKeyDown: (view, event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
              return false
            }

            if (event.shiftKey || event.metaKey || event.altKey || event.ctrlKey) {
              return false
            }

            const { state } = view
            const { selection } = state

            const moveSelection = (targetPos: number) => {
              const tr = state.tr.setSelection(TextSelection.create(state.doc, targetPos))
              view.dispatch(tr)
            }

            if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
              if (event.key === 'ArrowLeft') {
                moveSelection(selection.from)
              } else {
                moveSelection(selection.to)
              }
              return true
            }

            const { $from } = selection

            if (event.key === 'ArrowLeft') {
              const nodeBefore = $from.nodeBefore
              if (nodeBefore && nodeBefore.type.name === this.name) {
                moveSelection($from.pos - nodeBefore.nodeSize)
                return true
              }
            } else {
              const nodeAfter = $from.nodeAfter
              if (nodeAfter && nodeAfter.type.name === this.name) {
                moveSelection($from.pos + nodeAfter.nodeSize)
                return true
              }
            }

            return false
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertVariable:
        (attributes: VariableNodeAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: attributes,
          })
        },
      updateVariable:
        (id: string, attributes: Partial<VariableNodeAttributes>) =>
        ({ tr, state }) => {
          let updated = false
          state.doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.id === id) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                ...attributes,
              })
              updated = true
            }
          })
          return updated
        },
    }
  },
})

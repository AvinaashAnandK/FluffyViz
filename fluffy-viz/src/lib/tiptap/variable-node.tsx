import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, NodeViewProps } from '@tiptap/react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface VariableNodeAttributes {
  id: string
  displayName: string
  tooltip: string
  mappedColumnId?: string
  mappedColumnName?: string
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
  const { id, displayName, tooltip, mappedColumnId, mappedColumnName } = node.attrs

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('[VariablePill] Clicked:', { id, displayName, mappedColumnId })

    // Trigger custom event that PromptComposer will listen to
    const pos = getPos()
    if (pos !== undefined) {
      const event = new CustomEvent('variable-pill-click', {
        detail: { id, displayName, tooltip, mappedColumnId, mappedColumnName, pos }
      })
      console.log('[VariablePill] Dispatching event:', event.detail)
      window.dispatchEvent(event)
    } else {
      console.error('[VariablePill] getPos() returned undefined')
    }
  }

  const label = mappedColumnName || displayName
  const isMapped = Boolean(mappedColumnId)

  return (
    <NodeViewWrapper as="span" className="inline-block" data-id={id}>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <span
              onClick={handleClick}
              data-id={id}
              className={`inline-flex items-center px-2 py-0.5 mx-0.5 rounded text-sm font-medium cursor-pointer transition-colors ${
                isMapped
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-dashed border-gray-400 dark:border-gray-600'
              }`}
              contentEditable={false}
            >
              {label}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{tooltip}</p>
            {isMapped && <p className="text-xs text-gray-500 mt-1">Mapped to: {mappedColumnName}</p>}
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

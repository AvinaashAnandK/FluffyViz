import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

export interface MentionTriggerOptions {
  onTrigger?: (position: number) => void
  onCancel?: () => void
}

export const MentionTrigger = Extension.create<MentionTriggerOptions>({
  name: 'mentionTrigger',

  addOptions() {
    return {
      onTrigger: undefined,
      onCancel: undefined,
    }
  },

  addProseMirrorPlugins() {
    let activeTriggerPos: number | null = null

    const cancelActiveTrigger = () => {
      if (activeTriggerPos !== null) {
        activeTriggerPos = null
        this.options.onCancel?.()
      }
    }

    return [
      new Plugin({
        key: new PluginKey('mentionTrigger'),
        props: {
          handleKeyDown: (view, event) => {
            const { state } = view
            const { selection } = state
            const { $from } = selection

            // Check if @ key is pressed
            if (event.key === '@') {
              // Get text before cursor
              const textBefore = $from.parent.textBetween(
                Math.max(0, $from.parentOffset - 1),
                $from.parentOffset,
                undefined,
                ' '
              )

              // Only trigger if at start or after whitespace/newline (context-aware)
              const isValidContext =
                $from.parentOffset === 0 ||
                /\s/.test(textBefore)

              if (isValidContext && this.options.onTrigger) {
                // Get absolute position in document
                const pos = $from.pos

                // Schedule trigger after @ is inserted
                setTimeout(() => {
                  this.options.onTrigger?.(pos)
                }, 0)
                activeTriggerPos = pos
              }
            }

            // ESC to cancel mention
            if (event.key === 'Escape' && this.options.onCancel) {
              cancelActiveTrigger()
              return true
            }

            if (activeTriggerPos !== null) {
              if (event.key === 'Backspace') {
                const { from } = selection
                if (from === activeTriggerPos + 1) {
                  cancelActiveTrigger()
                }
              } else if (event.key === 'Enter' || event.key === 'Tab') {
                cancelActiveTrigger()
              } else if (event.key.length === 1 && !/^[\p{L}\p{N}_-]$/u.test(event.key)) {
                // Non word character typed - close mention
                cancelActiveTrigger()
              }
            }

            return false
          },
        },
        view: () => ({
          update: (view) => {
            if (activeTriggerPos === null) return

            const doc = view.state.doc
            const triggerChar = doc.textBetween(activeTriggerPos, activeTriggerPos + 1, undefined, '')
            if (triggerChar !== '@') {
              cancelActiveTrigger()
              return
            }

            const selectionFrom = view.state.selection.from
            if (selectionFrom <= activeTriggerPos) {
              cancelActiveTrigger()
            }
          },
          destroy: () => {
            activeTriggerPos = null
          },
        }),
      }),
    ]
  },
})

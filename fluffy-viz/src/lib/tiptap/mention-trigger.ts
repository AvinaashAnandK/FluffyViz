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

              // Only trigger if at start or after space (context-aware)
              const isValidContext = $from.parentOffset === 0 || textBefore === ' ' || textBefore === ''

              if (isValidContext && this.options.onTrigger) {
                // Get absolute position in document
                const pos = $from.pos

                // Schedule trigger after @ is inserted
                setTimeout(() => {
                  this.options.onTrigger?.(pos)
                }, 0)
              }
            }

            // ESC to cancel mention
            if (event.key === 'Escape' && this.options.onCancel) {
              this.options.onCancel()
              return true
            }

            return false
          },
        },
      }),
    ]
  },
})

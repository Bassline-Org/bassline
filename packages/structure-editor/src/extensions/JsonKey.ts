import { Node, mergeAttributes } from '@tiptap/core'

export interface JsonKeyOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * JsonKey - The key part of a JSON key-value pair
 *
 * Contains text for the property name. Typing `:` jumps to the value.
 */
export const JsonKey = Node.create<JsonKeyOptions>({
  name: 'jsonKey',

  group: 'jsonPairContent',

  content: 'text*',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-json-key]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-key': '',
        class: 'json-key',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Colon jumps to value
      ':': ({ editor }) => {
        // Find the sibling jsonValue and move cursor there
        const { $from } = editor.state.selection
        const pair = $from.node($from.depth - 1) // Parent jsonPair

        if (pair?.type.name === 'jsonPair') {
          // Find jsonValue position within the pair
          let valuePos: number | null = null
          pair.forEach((child, offset) => {
            if (child.type.name === 'jsonValue') {
              // Calculate absolute position
              const pairStart = $from.start($from.depth - 1)
              valuePos = pairStart + offset + 1 // +1 to enter the value node
            }
          })

          if (valuePos !== null) {
            editor.commands.setTextSelection(valuePos)
            return true
          }
        }
        return false
      },

      Tab: ({ editor }) => {
        // Tab also jumps to value
        return editor.commands.command(({ tr, dispatch }) => {
          if (dispatch) {
            // Same logic as colon - find value and jump
            const { $from } = editor.state.selection
            const pair = $from.node($from.depth - 1)

            if (pair?.type.name === 'jsonPair') {
              let valuePos: number | null = null
              pair.forEach((child, offset) => {
                if (child.type.name === 'jsonValue') {
                  const pairStart = $from.start($from.depth - 1)
                  valuePos = pairStart + offset + 1
                }
              })

              if (valuePos !== null) {
                tr.setSelection(editor.state.selection.constructor.near(tr.doc.resolve(valuePos)))
                dispatch(tr)
                return true
              }
            }
          }
          return false
        })
      },
    }
  },
})

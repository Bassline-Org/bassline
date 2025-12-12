import { Node, mergeAttributes } from '@tiptap/core'

export interface JsonPairOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * JsonPair - A key-value pair within a JSON object
 *
 * Contains exactly one JsonKey and one JsonValue.
 */
export const JsonPair = Node.create<JsonPairOptions>({
  name: 'jsonPair',

  group: 'jsonObjectContent',

  content: 'jsonKey jsonValue',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-json-pair]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-pair': '',
        class: 'json-pair',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Enter creates a new pair after this one
      Enter: ({ editor }) => {
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          // Check if we're in a jsonPair
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonPair') {
              // Find position after this pair
              const pairEnd = $from.end(depth) + 1

              // Create new pair
              const newPair = state.schema.nodes.jsonPair.create(null, [
                state.schema.nodes.jsonKey.create(),
                state.schema.nodes.jsonValue.create(),
              ])

              tr.insert(pairEnd, newPair)

              // Move cursor to new key
              tr.setSelection(
                state.selection.constructor.near(
                  tr.doc.resolve(pairEnd + 1) // Inside the new jsonKey
                )
              )

              dispatch(tr)
              return true
            }
          }

          return false
        })
      },

      // Backspace on empty pair removes it
      Backspace: ({ editor }) => {
        return editor.commands.command(({ tr, state, dispatch }) => {
          const { $from, empty } = state.selection

          if (!empty) return false

          // Check if we're in an empty jsonKey at start
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonKey' && node.content.size === 0) {
              // Check if we're at the start of the key
              if ($from.parentOffset === 0) {
                // Find the pair
                const pairDepth = depth - 1
                if (pairDepth < 0) return false

                const pair = $from.node(pairDepth)
                if (pair.type.name !== 'jsonPair') return false

                // Check if value is also empty
                let valueEmpty = true
                pair.forEach((child) => {
                  if (child.type.name === 'jsonValue' && child.content.size > 0) {
                    valueEmpty = false
                  }
                })

                if (valueEmpty) {
                  // Check if this isn't the only pair
                  const objectDepth = pairDepth - 1
                  if (objectDepth < 0) return false

                  const obj = $from.node(objectDepth)
                  if (obj.type.name !== 'jsonObject') return false

                  let pairCount = 0
                  obj.forEach((child) => {
                    if (child.type.name === 'jsonPair') pairCount++
                  })

                  if (pairCount > 1 && dispatch) {
                    // Delete this pair
                    const pairStart = $from.start(pairDepth) - 1
                    const pairEnd = $from.end(pairDepth) + 1
                    tr.delete(pairStart, pairEnd)
                    dispatch(tr)
                    return true
                  }
                }
              }
            }
          }

          return false
        })
      },
    }
  },
})

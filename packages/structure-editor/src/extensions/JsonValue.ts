import { Node, mergeAttributes } from '@tiptap/core'

export interface JsonValueOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * JsonValue - The value part of a JSON key-value pair
 *
 * Can contain any structure: primitive, object, or array.
 */
export const JsonValue = Node.create<JsonValueOptions>({
  name: 'jsonValue',

  group: 'jsonPairContent',

  // Can contain any structure type (jsonPrimitive handles text values)
  content: '(jsonObject | jsonArray | jsonPrimitive)*',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-json-value]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-value': '',
        class: 'json-value',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Tab moves to next pair's key
      Tab: ({ editor }) => {
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          // Walk up to find jsonPair, then find next jsonPair
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonPair') {
              // Find the parent (jsonObject)
              const parentDepth = depth - 1
              if (parentDepth < 0) return false

              const parent = $from.node(parentDepth)
              if (parent.type.name !== 'jsonObject') return false

              // Find this pair's index and get next pair
              const parentStart = $from.start(parentDepth)
              let currentIndex = -1
              let nextPairPos: number | null = null

              parent.forEach((child, offset, index) => {
                if (child.type.name === 'jsonPair') {
                  const pairStart = parentStart + offset
                  const pairEnd = pairStart + child.nodeSize

                  // Check if cursor is in this pair
                  if ($from.pos >= pairStart && $from.pos <= pairEnd) {
                    currentIndex = index
                  }

                  // If we found current, this is next
                  if (currentIndex >= 0 && index === currentIndex + 1) {
                    // Find the jsonKey in this pair
                    child.forEach((grandchild, grandchildOffset) => {
                      if (grandchild.type.name === 'jsonKey') {
                        nextPairPos = pairStart + grandchildOffset + 1
                      }
                    })
                  }
                }
              })

              if (nextPairPos !== null) {
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nextPairPos)))
                dispatch(tr)
                return true
              }

              return false
            }
          }

          return false
        })
      },

      'Shift-Tab': ({ editor }) => {
        // Go back to key of current pair
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          // Find the current jsonPair and its jsonKey
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonPair') {
              const pairStart = $from.start(depth)

              // Find jsonKey in this pair
              let keyPos: number | null = null
              node.forEach((child, offset) => {
                if (child.type.name === 'jsonKey') {
                  keyPos = pairStart + offset + 1
                }
              })

              if (keyPos !== null) {
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(keyPos)))
                dispatch(tr)
                return true
              }

              return false
            }
          }

          return false
        })
      },
    }
  },
})

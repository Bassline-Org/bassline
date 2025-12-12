import { Node, mergeAttributes } from '@tiptap/core'

export interface JsonElementOptions {
  HTMLAttributes: Record<string, any>
}

/**
 * JsonElement - An element within a JSON array
 *
 * Can contain any structure type.
 */
export const JsonElement = Node.create<JsonElementOptions>({
  name: 'jsonElement',

  group: 'jsonArrayContent',

  content: '(jsonObject | jsonArray | jsonPrimitive)*',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-json-element]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-element': '',
        class: 'json-element',
      }),
      0,
    ]
  },

  addKeyboardShortcuts() {
    return {
      // Tab moves to next element
      Tab: ({ editor }) => {
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          // Find current jsonElement
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              // Find parent array
              const arrayDepth = depth - 1
              if (arrayDepth < 0) return false

              const array = $from.node(arrayDepth)
              if (array.type.name !== 'jsonArray') return false

              // Find this element's index and next element
              const arrayStart = $from.start(arrayDepth)
              let currentIndex = -1
              let nextElementPos: number | null = null

              array.forEach((child, offset, index) => {
                if (child.type.name === 'jsonElement') {
                  const elemStart = arrayStart + offset
                  const elemEnd = elemStart + child.nodeSize

                  if ($from.pos >= elemStart && $from.pos <= elemEnd) {
                    currentIndex = index
                  }

                  if (currentIndex >= 0 && index === currentIndex + 1) {
                    nextElementPos = elemStart + 1
                  }
                }
              })

              if (nextElementPos !== null) {
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nextElementPos)))
                dispatch(tr)
                return true
              }

              return false
            }
          }

          return false
        })
      },

      // Shift+Tab moves to previous element
      'Shift-Tab': ({ editor }) => {
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              const arrayDepth = depth - 1
              if (arrayDepth < 0) return false

              const array = $from.node(arrayDepth)
              if (array.type.name !== 'jsonArray') return false

              const arrayStart = $from.start(arrayDepth)
              let currentIndex = -1
              let prevElementPos: number | null = null
              let lastElemPos: number | null = null

              array.forEach((child, offset, index) => {
                if (child.type.name === 'jsonElement') {
                  const elemStart = arrayStart + offset
                  const elemEnd = elemStart + child.nodeSize

                  if ($from.pos >= elemStart && $from.pos <= elemEnd) {
                    currentIndex = index
                    prevElementPos = lastElemPos
                  }

                  lastElemPos = elemStart + 1
                }
              })

              if (prevElementPos !== null) {
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(prevElementPos)))
                dispatch(tr)
                return true
              }

              return false
            }
          }

          return false
        })
      },

      // Enter or comma creates new element
      Enter: ({ editor }) => {
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              const elemEnd = $from.end(depth) + 1

              const newElement = state.schema.nodes.jsonElement.create()

              tr.insert(elemEnd, newElement)
              tr.setSelection(state.selection.constructor.near(tr.doc.resolve(elemEnd + 1)))

              dispatch(tr)
              return true
            }
          }

          return false
        })
      },

      ',': ({ editor }) => {
        // Same as Enter - add new element
        return editor.commands.command(({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              const elemEnd = $from.end(depth) + 1

              const newElement = state.schema.nodes.jsonElement.create()

              tr.insert(elemEnd, newElement)
              tr.setSelection(state.selection.constructor.near(tr.doc.resolve(elemEnd + 1)))

              dispatch(tr)
              return true
            }
          }

          return false
        })
      },
    }
  },
})

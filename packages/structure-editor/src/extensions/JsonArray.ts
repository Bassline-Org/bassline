import { Node, mergeAttributes } from '@tiptap/core'

export interface JsonArrayOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    jsonArray: {
      insertArray: () => ReturnType
      addElement: () => ReturnType
      removeElement: () => ReturnType
      selectNextElement: () => ReturnType
      selectPrevElement: () => ReturnType
    }
  }
}

/**
 * JsonArray - A JSON array containing elements
 *
 * Created via /array command. Contains JsonElement nodes.
 * Tab navigates between elements, Enter/comma adds new element.
 */
export const JsonArray = Node.create<JsonArrayOptions>({
  name: 'jsonArray',

  group: 'structure block',

  content: 'jsonElement+',

  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      collapsed: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-collapsed') === 'true',
        renderHTML: (attributes) => ({
          'data-collapsed': attributes.collapsed ? 'true' : 'false',
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-json-array]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-array': '',
        class: 'json-array',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertArray:
        () =>
        ({ chain, state }) => {
          // If we're in a paragraph, we need to clear it and replace with the array
          const { $from } = state.selection

          // Check if we're in a paragraph
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'paragraph') {
              const paragraphStart = $from.start(depth) - 1
              const paragraphEnd = $from.end(depth) + 1

              return chain()
                .deleteRange({ from: paragraphStart, to: paragraphEnd })
                .insertContent({
                  type: 'jsonArray',
                  content: [
                    {
                      type: 'jsonElement',
                      content: [],
                    },
                  ],
                })
                .run()
            }
          }

          // Not in a paragraph, just insert
          return chain()
            .insertContent({
              type: 'jsonArray',
              content: [
                {
                  type: 'jsonElement',
                  content: [],
                },
              ],
            })
            .run()
        },

      addElement:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonArray') {
              const arrayEnd = $from.end(depth)

              const newElement = state.schema.nodes.jsonElement.create()

              tr.insert(arrayEnd, newElement)
              tr.setSelection(state.selection.constructor.near(tr.doc.resolve(arrayEnd + 1)))

              dispatch(tr)
              return true
            }
          }

          return false
        },

      removeElement:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              const arrayDepth = depth - 1
              const array = $from.node(arrayDepth)

              if (array?.type.name !== 'jsonArray') return false

              // Count elements
              let elementCount = 0
              array.forEach((child) => {
                if (child.type.name === 'jsonElement') elementCount++
              })

              // Don't remove last element
              if (elementCount <= 1) return false

              const elemStart = $from.start(depth) - 1
              const elemEnd = $from.end(depth) + 1

              tr.delete(elemStart, elemEnd)
              dispatch(tr)
              return true
            }
          }

          return false
        },

      selectNextElement:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              const arrayDepth = depth - 1
              const array = $from.node(arrayDepth)

              if (array?.type.name !== 'jsonArray') return false

              const arrayStart = $from.start(arrayDepth)
              const currentElemStart = $from.start(depth) - 1
              let nextElemPos: number | null = null
              let foundCurrent = false

              array.forEach((child, offset) => {
                if (child.type.name === 'jsonElement') {
                  const elemStart = arrayStart + offset

                  if (foundCurrent && nextElemPos === null) {
                    nextElemPos = elemStart + 1
                  }

                  if (elemStart === currentElemStart) {
                    foundCurrent = true
                  }
                }
              })

              if (nextElemPos !== null) {
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nextElemPos)))
                dispatch(tr)
                return true
              }

              return false
            }
          }

          return false
        },

      selectPrevElement:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonElement') {
              const arrayDepth = depth - 1
              const array = $from.node(arrayDepth)

              if (array?.type.name !== 'jsonArray') return false

              const arrayStart = $from.start(arrayDepth)
              const currentElemStart = $from.start(depth) - 1
              let prevElemPos: number | null = null

              array.forEach((child, offset) => {
                if (child.type.name === 'jsonElement') {
                  const elemStart = arrayStart + offset

                  if (elemStart < currentElemStart) {
                    prevElemPos = elemStart + 1
                  }
                }
              })

              if (prevElemPos !== null) {
                tr.setSelection(state.selection.constructor.near(tr.doc.resolve(prevElemPos)))
                dispatch(tr)
                return true
              }

              return false
            }
          }

          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!editor.isActive('jsonArray')) return false
        return editor.commands.selectNextElement()
      },

      'Shift-Tab': ({ editor }) => {
        if (!editor.isActive('jsonArray')) return false
        return editor.commands.selectPrevElement()
      },

      Enter: ({ editor }) => {
        if (!editor.isActive('jsonArray')) return false
        return editor.commands.addElement()
      },

      ',': ({ editor }) => {
        if (!editor.isActive('jsonElement')) return false
        return editor.commands.addElement()
      },
    }
  },
})

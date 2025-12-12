import { Node, mergeAttributes } from '@tiptap/core'

export interface JsonObjectOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    jsonObject: {
      insertObject: () => ReturnType
      addPair: () => ReturnType
      selectNextField: () => ReturnType
      selectPrevField: () => ReturnType
    }
  }
}

/**
 * JsonObject - A JSON object containing key-value pairs
 *
 * Created via /object command. Contains JsonPair nodes.
 * Tab navigates between keys and values.
 */
export const JsonObject = Node.create<JsonObjectOptions>({
  name: 'jsonObject',

  group: 'structure block',

  content: 'jsonPair+',

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
    return [{ tag: 'div[data-json-object]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-object': '',
        class: 'json-object',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertObject:
        () =>
        ({ chain, state, editor }) => {
          // If we're in a paragraph, we need to clear it and replace with the object
          const { $from } = state.selection

          // Check if we're in a paragraph
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'paragraph') {
              // Get the paragraph's position and replace it entirely
              const paragraphStart = $from.start(depth) - 1
              const paragraphEnd = $from.end(depth) + 1

              return chain()
                .deleteRange({ from: paragraphStart, to: paragraphEnd })
                .insertContent({
                  type: 'jsonObject',
                  content: [
                    {
                      type: 'jsonPair',
                      content: [
                        { type: 'jsonKey', content: [] },
                        { type: 'jsonValue', content: [] },
                      ],
                    },
                  ],
                })
                .run()
            }
          }

          // Not in a paragraph, just insert
          return chain()
            .insertContent({
              type: 'jsonObject',
              content: [
                {
                  type: 'jsonPair',
                  content: [
                    { type: 'jsonKey', content: [] },
                    { type: 'jsonValue', content: [] },
                  ],
                },
              ],
            })
            .run()
        },

      addPair:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          // Find the jsonObject we're in
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)
            if (node.type.name === 'jsonObject') {
              // Insert at end of object
              const objectEnd = $from.end(depth)

              const newPair = state.schema.nodes.jsonPair.create(null, [
                state.schema.nodes.jsonKey.create(),
                state.schema.nodes.jsonValue.create(),
              ])

              tr.insert(objectEnd, newPair)

              // Move cursor to new key
              tr.setSelection(state.selection.constructor.near(tr.doc.resolve(objectEnd + 1)))

              dispatch(tr)
              return true
            }
          }

          return false
        },

      selectNextField:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          // Find current position in the tree and move to next editable
          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)

            if (node.type.name === 'jsonKey') {
              // Move to value
              const pair = $from.node(depth - 1)
              if (pair?.type.name === 'jsonPair') {
                const pairStart = $from.start(depth - 1)
                let valuePos: number | null = null

                pair.forEach((child, offset) => {
                  if (child.type.name === 'jsonValue') {
                    valuePos = pairStart + offset + 1
                  }
                })

                if (valuePos !== null) {
                  tr.setSelection(state.selection.constructor.near(tr.doc.resolve(valuePos)))
                  dispatch(tr)
                  return true
                }
              }
            }

            if (node.type.name === 'jsonValue') {
              // Move to next pair's key
              const pair = $from.node(depth - 1)
              const obj = $from.node(depth - 2)

              if (pair?.type.name === 'jsonPair' && obj?.type.name === 'jsonObject') {
                const objStart = $from.start(depth - 2)
                let foundCurrent = false
                let nextKeyPos: number | null = null

                obj.forEach((child, offset) => {
                  if (child.type.name === 'jsonPair') {
                    const pairStart = objStart + offset

                    if (foundCurrent && nextKeyPos === null) {
                      // This is the next pair
                      child.forEach((grandchild, grandOffset) => {
                        if (grandchild.type.name === 'jsonKey') {
                          nextKeyPos = pairStart + grandOffset + 1
                        }
                      })
                    }

                    // Check if this is current pair
                    const currentPairStart = $from.start(depth - 1) - 1
                    if (pairStart === currentPairStart) {
                      foundCurrent = true
                    }
                  }
                })

                if (nextKeyPos !== null) {
                  tr.setSelection(state.selection.constructor.near(tr.doc.resolve(nextKeyPos)))
                  dispatch(tr)
                  return true
                }
              }
            }
          }

          return false
        },

      selectPrevField:
        () =>
        ({ tr, state, dispatch }) => {
          if (!dispatch) return false

          const { $from } = state.selection

          for (let depth = $from.depth; depth >= 0; depth--) {
            const node = $from.node(depth)

            if (node.type.name === 'jsonValue') {
              // Move back to key
              const pair = $from.node(depth - 1)
              if (pair?.type.name === 'jsonPair') {
                const pairStart = $from.start(depth - 1)
                let keyPos: number | null = null

                pair.forEach((child, offset) => {
                  if (child.type.name === 'jsonKey') {
                    keyPos = pairStart + offset + 1
                  }
                })

                if (keyPos !== null) {
                  tr.setSelection(state.selection.constructor.near(tr.doc.resolve(keyPos)))
                  dispatch(tr)
                  return true
                }
              }
            }

            if (node.type.name === 'jsonKey') {
              // Move to previous pair's value
              const pair = $from.node(depth - 1)
              const obj = $from.node(depth - 2)

              if (pair?.type.name === 'jsonPair' && obj?.type.name === 'jsonObject') {
                const objStart = $from.start(depth - 2)
                const currentPairStart = $from.start(depth - 1) - 1
                let prevValuePos: number | null = null

                obj.forEach((child, offset) => {
                  if (child.type.name === 'jsonPair') {
                    const pairStart = objStart + offset

                    if (pairStart < currentPairStart) {
                      // This is a previous pair - track its value position
                      child.forEach((grandchild, grandOffset) => {
                        if (grandchild.type.name === 'jsonValue') {
                          prevValuePos = pairStart + grandOffset + 1
                        }
                      })
                    }
                  }
                })

                if (prevValuePos !== null) {
                  tr.setSelection(state.selection.constructor.near(tr.doc.resolve(prevValuePos)))
                  dispatch(tr)
                  return true
                }
              }
            }
          }

          return false
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (!editor.isActive('jsonObject')) return false
        return editor.commands.selectNextField()
      },

      'Shift-Tab': ({ editor }) => {
        if (!editor.isActive('jsonObject')) return false
        return editor.commands.selectPrevField()
      },
    }
  },
})

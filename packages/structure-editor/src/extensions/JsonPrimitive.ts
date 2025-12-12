import { Node, mergeAttributes } from '@tiptap/core'

export type PrimitiveType = 'string' | 'number' | 'boolean' | 'null'

export interface JsonPrimitiveOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    jsonPrimitive: {
      insertPrimitive: (value: string | number | boolean | null) => ReturnType
      setPrimitiveValue: (value: string | number | boolean | null) => ReturnType
    }
  }
}

/**
 * JsonPrimitive - Represents a primitive JSON value (string, number, boolean, null)
 *
 * This is a leaf node that displays and allows editing of primitive values.
 */
export const JsonPrimitive = Node.create<JsonPrimitiveOptions>({
  name: 'jsonPrimitive',

  group: 'structure',

  // Primitive is editable inline
  inline: false,

  // Content is just text for editing
  content: 'text*',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      valueType: {
        default: 'string' as PrimitiveType,
        parseHTML: (element) => element.getAttribute('data-value-type'),
        renderHTML: (attributes) => ({
          'data-value-type': attributes.valueType,
        }),
      },
      // Store the actual value for non-string types
      value: {
        default: null,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-value')
          const type = element.getAttribute('data-value-type')
          if (type === 'number') return parseFloat(raw || '0')
          if (type === 'boolean') return raw === 'true'
          if (type === 'null') return null
          return raw
        },
        renderHTML: (attributes) => ({
          'data-value': String(attributes.value),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-json-primitive]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-json-primitive': '',
        class: `json-primitive json-${HTMLAttributes['data-value-type'] || 'string'}`,
      }),
      0,
    ]
  },

  addCommands() {
    return {
      insertPrimitive:
        (value) =>
        ({ chain, state }) => {
          const valueType = getPrimitiveType(value)
          const displayText = getDisplayText(value)
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
                  type: this.name,
                  attrs: { valueType, value },
                  content: displayText ? [{ type: 'text', text: displayText }] : [],
                })
                .run()
            }
          }

          return chain()
            .insertContent({
              type: this.name,
              attrs: { valueType, value },
              content: displayText ? [{ type: 'text', text: displayText }] : [],
            })
            .run()
        },

      setPrimitiveValue:
        (value) =>
        ({ commands }) => {
          const valueType = getPrimitiveType(value)
          return commands.updateAttributes(this.name, { valueType, value })
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Tab moves to next field (handled at document level)
      Tab: () => false,
      'Shift-Tab': () => false,

      // Enter confirms the value
      Enter: ({ editor }) => {
        // Get the current text content and update the value attribute
        const { from, to } = editor.state.selection
        const text = editor.state.doc.textBetween(from, to, ' ')
        const attrs = this.editor.getAttributes(this.name)

        // Parse the text to the appropriate type
        const value = parseValue(text, attrs.valueType)
        editor.commands.updateAttributes(this.name, { value })

        return false // Let parent handle navigation
      },
    }
  },
})

function getPrimitiveType(value: any): PrimitiveType {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

function getDisplayText(value: any): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') return String(value)
  return String(value)
}

function parseValue(text: string, type: PrimitiveType): any {
  switch (type) {
    case 'null':
      return null
    case 'boolean':
      return text.toLowerCase() === 'true'
    case 'number':
      return parseFloat(text) || 0
    default:
      return text
  }
}

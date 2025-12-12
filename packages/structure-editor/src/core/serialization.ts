import type { JsonValue, TiptapJsonNode } from './types'

/**
 * Convert a JSON value to Tiptap document nodes
 */
export function jsonToTiptap(json: JsonValue): TiptapJsonNode {
  if (json === null) {
    return {
      type: 'jsonPrimitive',
      attrs: { valueType: 'null', value: null },
    }
  }

  if (typeof json === 'boolean') {
    return {
      type: 'jsonPrimitive',
      attrs: { valueType: 'boolean', value: json },
    }
  }

  if (typeof json === 'number') {
    return {
      type: 'jsonPrimitive',
      attrs: { valueType: 'number', value: json },
    }
  }

  if (typeof json === 'string') {
    return {
      type: 'jsonPrimitive',
      attrs: { valueType: 'string', value: json },
    }
  }

  if (Array.isArray(json)) {
    return {
      type: 'jsonArray',
      content: json.map((item) => ({
        type: 'jsonElement',
        content: [jsonToTiptap(item)],
      })),
    }
  }

  // Object
  return {
    type: 'jsonObject',
    content: Object.entries(json).map(([key, value]) => ({
      type: 'jsonPair',
      content: [
        {
          type: 'jsonKey',
          content: [{ type: 'text', text: key }],
        },
        {
          type: 'jsonValue',
          content: [jsonToTiptap(value)],
        },
      ],
    })),
  }
}

/**
 * Convert Tiptap document nodes back to JSON
 */
export function tiptapToJson(node: TiptapJsonNode): JsonValue {
  switch (node.type) {
    case 'jsonPrimitive':
      return node.attrs?.value ?? null

    case 'jsonArray':
      return (node.content || [])
        .filter((child) => child.type === 'jsonElement')
        .map((element) => {
          const valueNode = element.content?.[0]
          return valueNode ? tiptapToJson(valueNode) : null
        })

    case 'jsonObject': {
      const result: { [key: string]: JsonValue } = {}
      for (const pair of node.content || []) {
        if (pair.type === 'jsonPair') {
          const keyNode = pair.content?.find((c) => c.type === 'jsonKey')
          const valueNode = pair.content?.find((c) => c.type === 'jsonValue')

          // Extract key text
          const keyText = keyNode?.content?.find((c) => c.type === 'text')?.text || ''

          // Extract value
          const valueContent = valueNode?.content?.[0]
          const value = valueContent ? tiptapToJson(valueContent) : null

          if (keyText) {
            result[keyText] = value
          }
        }
      }
      return result
    }

    case 'jsonKey':
    case 'jsonValue':
    case 'jsonElement':
      // These are containers - extract their content
      return node.content?.[0] ? tiptapToJson(node.content[0]) : null

    case 'text':
      return node.text || ''

    case 'doc':
    case 'paragraph':
      // Document/paragraph wrappers - extract content
      return node.content?.[0] ? tiptapToJson(node.content[0]) : null

    default:
      console.warn(`Unknown node type: ${node.type}`)
      return null
  }
}

/**
 * Create an empty object document
 */
export function createEmptyObject(): TiptapJsonNode {
  return {
    type: 'doc',
    content: [
      {
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
      },
    ],
  }
}

/**
 * Create an empty array document
 */
export function createEmptyArray(): TiptapJsonNode {
  return {
    type: 'doc',
    content: [
      {
        type: 'jsonArray',
        content: [
          {
            type: 'jsonElement',
            content: [],
          },
        ],
      },
    ],
  }
}

/**
 * Wrap content in a document node
 */
export function wrapInDocument(content: TiptapJsonNode): TiptapJsonNode {
  return {
    type: 'doc',
    content: [content],
  }
}

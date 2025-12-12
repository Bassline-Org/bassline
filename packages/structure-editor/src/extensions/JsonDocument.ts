import { Node } from '@tiptap/core'

/**
 * JsonDocument - Root document node for the structure editor
 *
 * Replaces the default Document to only allow JSON structures.
 * Uses paragraph for text input, and block-level JSON structures.
 */
export const JsonDocument = Node.create({
  name: 'doc',

  topNode: true,

  // Allow paragraphs for text input, plus JSON structures
  content: '(paragraph | jsonObject | jsonArray | jsonPrimitive)*',
})

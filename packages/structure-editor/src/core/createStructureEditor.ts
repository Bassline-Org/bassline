import { Editor } from '@tiptap/core'
import { History } from '@tiptap/extension-history'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'

import {
  JsonDocument,
  JsonObject,
  JsonArray,
  JsonPair,
  JsonElement,
  JsonKey,
  JsonValue,
  JsonPrimitive,
  CommandPrefix,
} from '../extensions'

import { jsonToTiptap, tiptapToJson, wrapInDocument } from './serialization'
import type { StructureEditorOptions, StructureEditor, JsonValue as JsonValueType } from './types'

/**
 * Create a structure editor instance
 *
 * The editor provides structural JSON editing with:
 * - /object and /array commands
 * - Tab navigation between fields
 * - Automatic structure validation
 * - JSON serialization
 */
export function createStructureEditor(
  element: HTMLElement,
  options: StructureEditorOptions = {}
): StructureEditor {
  const {
    content,
    onChange,
    onReady,
    readonly = false,
    placeholder = 'Type / for commands...',
    onShowPalette,
    onHidePalette,
  } = options

  // Build initial document from JSON content
  // Always provide at least an empty paragraph for editability
  const initialDoc = content
    ? wrapInDocument(jsonToTiptap(content))
    : { type: 'doc', content: [{ type: 'paragraph' }] }

  // Create the editor
  const editor = new Editor({
    element,
    editable: !readonly,

    extensions: [
      // Custom document node
      JsonDocument,

      // Basic text editing - Paragraph contains Text
      Paragraph,
      Text,

      // JSON structure nodes
      JsonObject,
      JsonArray,
      JsonPair,
      JsonElement,
      JsonKey,
      JsonValue,
      JsonPrimitive,

      // Command system
      CommandPrefix.configure({
        prefix: '/',
        onShowPalette:
          onShowPalette ??
          ((query, commands) => {
            console.log(
              'Command palette:',
              query,
              commands.map((c) => c.name)
            )
          }),
        onHidePalette:
          onHidePalette ??
          (() => {
            console.log('Command palette hidden')
          }),
      }),

      // Undo/redo
      History,
    ],

    content: initialDoc,

    onUpdate: ({ editor }) => {
      if (onChange) {
        try {
          const json = getJson(editor)
          onChange(json)
        } catch (e) {
          console.warn('Failed to serialize editor content:', e)
        }
      }
    },

    onCreate: ({ editor }) => {
      onReady?.(editor)
    },
  })

  // Helper to get JSON from editor
  function getJson(ed: Editor = editor): JsonValueType {
    const doc = ed.getJSON()
    if (!doc.content || doc.content.length === 0) {
      return null
    }
    // Get the first structure node
    const firstNode = doc.content[0]
    return tiptapToJson(firstNode)
  }

  // Helper to set JSON content
  function setJson(json: JsonValueType) {
    const doc = wrapInDocument(jsonToTiptap(json))
    editor.commands.setContent(doc)
  }

  return {
    editor,
    getJson: () => getJson(),
    setJson,
    focus: () => editor.commands.focus(),
    destroy: () => editor.destroy(),
  }
}

export { createStructureEditor as default }

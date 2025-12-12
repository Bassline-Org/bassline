import type { Editor } from '@tiptap/core'

/**
 * JSON value types that can be represented in the structure editor
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

/**
 * Tiptap node representation of JSON structures
 */
export interface TiptapJsonNode {
  type: string
  attrs?: Record<string, any>
  content?: TiptapJsonNode[]
  text?: string
}

/**
 * Command palette command definition
 */
export interface StructureCommand {
  name: string
  description: string
  icon?: string
  execute: (editor: Editor) => void
}

/**
 * Options for creating a structure editor
 */
export interface StructureEditorOptions {
  /** Initial JSON content */
  content?: JsonValue
  /** Callback when content changes */
  onChange?: (json: JsonValue) => void
  /** Callback when editor is ready */
  onReady?: (editor: Editor) => void
  /** Whether editor is read-only */
  readonly?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Callback when command palette should show */
  onShowPalette?: (query: string, commands: StructureCommand[]) => void
  /** Callback when command palette should hide */
  onHidePalette?: () => void
}

/**
 * Structure editor instance
 */
export interface StructureEditor {
  editor: Editor
  /** Get current content as JSON */
  getJson: () => JsonValue
  /** Set content from JSON */
  setJson: (json: JsonValue) => void
  /** Focus the editor */
  focus: () => void
  /** Destroy the editor */
  destroy: () => void
}

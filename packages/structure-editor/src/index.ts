// Core
export { createStructureEditor, default as createEditor } from './core/createStructureEditor'
export type {
  JsonValue,
  TiptapJsonNode,
  StructureCommand,
  StructureEditorOptions,
  StructureEditor,
} from './core/types'

// Serialization
export {
  jsonToTiptap,
  tiptapToJson,
  createEmptyObject,
  createEmptyArray,
  wrapInDocument,
} from './core/serialization'

// Extensions
export * from './extensions'

// Components (Solid)
export { StructureEditor as StructureEditorComponent } from './components/StructureEditor'
export type { StructureEditorProps } from './components/StructureEditor'

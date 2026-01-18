// Vocab factories
export { createIoVocab } from './io.js'
export { createEventsVocab } from './events.js'
export { createEditorVocab } from './editor.js'
export { createReflectVocab } from './reflect.js'

// Registry of built-in vocab factories
export const builtinVocabs = {
  io: async (rt) => (await import('./io.js')).createIoVocab(rt),
  events: async (rt) => (await import('./events.js')).createEventsVocab(rt),
  editor: async (rt) => (await import('./editor.js')).createEditorVocab(rt),
  reflect: async (rt) => (await import('./reflect.js')).createReflectVocab(rt),
}

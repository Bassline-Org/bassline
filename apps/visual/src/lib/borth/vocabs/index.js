// Vocab factories
export { createIoVocab } from './io.js'
export { createEventsVocab } from './events.js'
export { createEditorVocab } from './editor.js'
export { createReflectVocab } from './reflect.js'
export { createGraphVocab } from './graph.js'
export { createHooksVocab } from './hooks.js'
export { createEntitiesVocab } from './entities.js'
export { createUiVocab } from './ui.js'
export { createCardsVocab } from './cards.js'

// Registry of built-in vocab factories
export const builtinVocabs = {
  io: async (rt) => (await import('./io.js')).createIoVocab(rt),
  events: async (rt) => (await import('./events.js')).createEventsVocab(rt),
  editor: async (rt) => (await import('./editor.js')).createEditorVocab(rt),
  reflect: async (rt) => (await import('./reflect.js')).createReflectVocab(rt),
  graph: async (rt) => (await import('./graph.js')).createGraphVocab(rt),
  hooks: async (rt) => (await import('./hooks.js')).createHooksVocab(rt),
  entities: async (rt) => (await import('./entities.js')).createEntitiesVocab(rt),
  ui: async (rt) => (await import('./ui.js')).createUiVocab(rt),
  cards: async (rt) => (await import('./cards.js')).createCardsVocab(rt),
}

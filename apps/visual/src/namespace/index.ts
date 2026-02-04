import { atom } from 'jotai'
import { atomWithImmer } from 'jotai-immer'
import { selectAtom } from 'jotai/utils'
import { useAtomValue, useSetAtom } from 'jotai'
import { enablePatches, enableMapSet, produceWithPatches, type Patch, type Draft } from 'immer'

// Enable Immer plugins once
enablePatches()
enableMapSet()

// Types
export interface PatchEntry {
  patches: Patch[]
  inverse: Patch[]
  timestamp: number
}

// Core store atom
export const storeAtom = atomWithImmer(new Map<string, object>())

// Patch history
export const patchHistoryAtom = atom<PatchEntry[]>([])

// Write atom that tracks patches
export const trackedStoreAtom = atom(
  get => get(storeAtom),
  (get, set, update: (draft: Draft<Map<string, object>>) => void) => {
    const current = get(storeAtom)
    const [next, patches, inverse] = produceWithPatches(current, update)
    set(storeAtom, next)
    set(patchHistoryAtom, prev => [...prev, { patches, inverse, timestamp: Date.now() }])
    return { patches, inverse }
  }
)

// Derived atom for a specific path
export const pathAtom = <T extends object>(path: string) =>
  selectAtom(storeAtom, store => store.get(path) as T | undefined)

// React hook
export const useNamespace = () => {
  const store = useAtomValue(storeAtom)
  const setStore = useSetAtom(trackedStoreAtom)

  return {
    get: <T extends object>(path: string) => store.get(path) as T | undefined,
    has: (path: string) => store.has(path),
    keys: (prefix = '') => [...store.keys()].filter(k => k.startsWith(prefix)),
    set: <T extends object>(path: string, value: T) =>
      setStore(draft => {
        draft.set(path, value)
      }),
    delete: (path: string) =>
      setStore(draft => {
        draft.delete(path)
      }),
  }
}

// Re-export types
export * from './types'

// Re-export schema utilities
export { schemaToZod, fieldDefToZod, createAddEntitySchema, createNewQuerySchema } from './schema'

// Re-export query utilities
export { runQuery, findBySchema, findByKind } from './query'

// Re-export graph viewable
export { useGraph, useSeedNamespace } from './graph'

import { enableMapSet, enablePatches, Patch } from 'immer'
import { atom } from 'jotai'
import { atomWithImmer } from 'jotai-immer'
import { atomWithReducer } from 'jotai/utils'

enablePatches()
enableMapSet()

export type Change = Patched
export type Patched = PatchCreated | PatchApplied
export type PatchCreated = {
  type: 'patchCreated'
  patches: Patch[]
  inverse: Patch[]
  timestamp: number
}
export type PatchApplied = {
  type: 'patchApplied'
  patches: Patch[]
  inverse: Patch[]
  timestamp: number
}

export const storeAtom = atomWithImmer<Map<string, object>>(new Map())

export const patchHistoryAtom = atom<PatchEntry[]>([])

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

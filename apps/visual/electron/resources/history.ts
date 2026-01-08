/**
 * History Resource - Undo/Redo via kit
 *
 * Supports batching: multiple operations can be grouped into a single undo step.
 * Use beginBatch/endBatch to group operations.
 */

import { resource, routes } from '@bassline/core'

export interface HistoryEntry {
  forward: { path: string; body: unknown }
  backward: { path: string; body: unknown }
}

// Compound entry for batched operations
export interface CompoundHistoryEntry {
  operations: HistoryEntry[]
}

export type StackEntry = HistoryEntry | CompoundHistoryEntry

function isCompound(entry: StackEntry): entry is CompoundHistoryEntry {
  return 'operations' in entry
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
  inBatch: boolean
}

const MAX_STACK = 100

export function createHistory() {
  const undoStack: StackEntry[] = []
  const redoStack: StackEntry[] = []

  // Batch state - when batching, operations collect here instead of undoStack
  let batchOperations: HistoryEntry[] | null = null

  return routes({
    // GET /history - get undo/redo state
    '': resource({
      get: async (): Promise<{ headers: object; body: HistoryState }> => ({
        headers: {},
        body: {
          canUndo: undoStack.length > 0,
          canRedo: redoStack.length > 0,
          undoCount: undoStack.length,
          redoCount: redoStack.length,
          inBatch: batchOperations !== null,
        },
      }),
    }),

    // PUT /history/push - record an undoable operation
    push: resource({
      put: async (_h: unknown, entry: HistoryEntry) => {
        // If batching, collect instead of pushing directly
        if (batchOperations !== null) {
          batchOperations.push(entry)
          return { headers: {}, body: { pushed: true, batched: true } }
        }

        undoStack.push(entry)
        if (undoStack.length > MAX_STACK) {
          undoStack.shift() // Drop oldest
        }
        redoStack.length = 0 // Clear redo on new action
        return { headers: {}, body: { pushed: true } }
      },
    }),

    // PUT /history/beginBatch - start collecting operations into a batch
    beginBatch: resource({
      put: async () => {
        if (batchOperations !== null) {
          // Already in a batch - this is an error but we'll handle gracefully
          return { headers: { condition: 'already-batching' }, body: null }
        }
        batchOperations = []
        return { headers: {}, body: { started: true } }
      },
    }),

    // PUT /history/endBatch - finalize batch as single undo step
    endBatch: resource({
      put: async () => {
        if (batchOperations === null) {
          return { headers: { condition: 'not-batching' }, body: null }
        }

        const operations = batchOperations
        batchOperations = null

        // If no operations were collected, nothing to push
        if (operations.length === 0) {
          return { headers: {}, body: { ended: true, operationCount: 0 } }
        }

        // If only one operation, push it directly (no need for compound)
        if (operations.length === 1) {
          undoStack.push(operations[0])
        } else {
          // Push as compound entry
          undoStack.push({ operations })
        }

        if (undoStack.length > MAX_STACK) {
          undoStack.shift()
        }
        redoStack.length = 0

        return { headers: {}, body: { ended: true, operationCount: operations.length } }
      },
    }),

    // PUT /history/cancelBatch - discard batch without pushing
    cancelBatch: resource({
      put: async () => {
        if (batchOperations === null) {
          return { headers: { condition: 'not-batching' }, body: null }
        }
        const count = batchOperations.length
        batchOperations = null
        return { headers: {}, body: { cancelled: true, discardedCount: count } }
      },
    }),

    // PUT /history/undo - undo last operation
    undo: resource({
      put: async (h: { kit?: { put: (h: object, b: unknown) => Promise<unknown> } }) => {
        const entry = undoStack.pop()
        if (!entry) {
          return { headers: { condition: 'empty' }, body: null }
        }

        // Execute backward operation(s) via kit
        // Pass skipHistory flag to prevent re-recording this action
        if (h.kit) {
          if (isCompound(entry)) {
            // Compound: undo all operations in reverse order
            for (let i = entry.operations.length - 1; i >= 0; i--) {
              const op = entry.operations[i]
              await h.kit.put({ path: op.backward.path, skipHistory: true }, op.backward.body)
            }
          } else {
            // Single operation
            await h.kit.put({ path: entry.backward.path, skipHistory: true }, entry.backward.body)
          }
        }
        redoStack.push(entry)

        return { headers: {}, body: { undone: true } }
      },
    }),

    // PUT /history/redo - redo last undone operation
    redo: resource({
      put: async (h: { kit?: { put: (h: object, b: unknown) => Promise<unknown> } }) => {
        const entry = redoStack.pop()
        if (!entry) {
          return { headers: { condition: 'empty' }, body: null }
        }

        // Execute forward operation(s) via kit
        // Pass skipHistory flag to prevent re-recording this action
        if (h.kit) {
          if (isCompound(entry)) {
            // Compound: redo all operations in forward order
            for (const op of entry.operations) {
              await h.kit.put({ path: op.forward.path, skipHistory: true }, op.forward.body)
            }
          } else {
            // Single operation
            await h.kit.put({ path: entry.forward.path, skipHistory: true }, entry.forward.body)
          }
        }
        undoStack.push(entry)

        return { headers: {}, body: { redone: true } }
      },
    }),

    // PUT /history/clear - clear all history
    clear: resource({
      put: async () => {
        undoStack.length = 0
        redoStack.length = 0
        return { headers: {}, body: { cleared: true } }
      },
    }),
  })
}

/**
 * UI State Resource - Viewport and selection (no undo needed)
 */

import { resource } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

interface UIStateData {
  viewport_x?: number
  viewport_y?: number
  viewport_zoom?: number
  selected_entity?: string | null
}

export function createUIStateResource(db: Db) {
  return (projectId: string) =>
    resource({
      // GET /ui-state - get current UI state
      get: async () => ({
        headers: {},
        body: db.uiState.get(projectId),
      }),

      // PUT /ui-state - update UI state (partial)
      put: async (_h: unknown, body: UIStateData) => {
        const updated = db.uiState.update(projectId, body)
        return { headers: {}, body: updated }
      },
    })
}

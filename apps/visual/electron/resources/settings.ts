/**
 * Settings Resource - Key-value settings (no undo needed)
 */

import { resource, bind } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
}

export function createSettingsResource(db: Db) {
  return bind('key', resource({
    // GET /settings/:key - get setting value
    get: async (h: ResourceHeaders) => {
      const key = h.params?.key || ''
      const value = db.settings.get(key)
      if (value === null) {
        return { headers: { condition: 'not-found' }, body: null }
      }
      return { headers: {}, body: value }
    },

    // PUT /settings/:key - set setting value
    put: async (h: ResourceHeaders, body: string) => {
      const key = h.params?.key || ''
      db.settings.set(key, body)
      return { headers: { updated: true }, body }
    },
  }))
}

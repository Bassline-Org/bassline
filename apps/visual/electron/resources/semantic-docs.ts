/**
 * Semantic Docs Resource
 *
 * Provides access to semantic documentation stored in the database.
 * Used to fetch help.* attributes when creating new semantic entities.
 */

import { resource, bind, routes } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
}

export function createSemanticDocsResource(db: Db) {
  // Get a specific doc by id
  const singleDoc = resource({
    get: async (h: ResourceHeaders) => {
      const id = h.params?.id
      if (!id) {
        return { headers: { condition: 'error' }, body: 'Missing id' }
      }
      const doc = db.semanticDocs.get(id)
      if (!doc) {
        return { headers: { condition: 'not-found' }, body: null }
      }
      return { headers: {}, body: doc }
    },
    put: async () => {
      return { headers: { condition: 'not-implemented' }, body: null }
    },
  })

  // List all docs or get single doc
  return routes({
    '': resource({
      get: async () => {
        const docs = db.semanticDocs.list()
        return { headers: {}, body: docs }
      },
      put: async () => {
        return { headers: { condition: 'not-implemented' }, body: null }
      },
    }),
    unknown: bind('id', singleDoc),
  })
}

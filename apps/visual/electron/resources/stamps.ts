/**
 * Stamps Resource with undo support for apply
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'
import type { AttrValue } from '../../src/types'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
  skipHistory?: boolean
  kit?: {
    put: (h: object, b: unknown) => Promise<unknown>
  }
}

interface CreateStampData {
  name: string
  sourceEntityId?: string
  kind?: 'template' | 'vocabulary'
  category?: string
  description?: string
}

export function createStampsResource(db: Db) {
  return routes({
    // GET /stamps - list all stamps
    // PUT /stamps - create new stamp
    '': resource({
      get: async (_h: unknown, body: { kind?: 'template' | 'vocabulary'; category?: string } | undefined) => ({
        headers: { type: 'js/arr' },
        body: db.stamps.list(body),
      }),
      put: async (_h: ResourceHeaders, body: CreateStampData) => {
        const stampId = db.stamps.create(body)
        const stamp = db.stamps.get(stampId)
        return { headers: { created: true }, body: stamp }
      },
    }),

    // Individual stamp routes
    unknown: bind('stampId', routes({
      // GET /stamps/:id - get stamp with members
      // DELETE /stamps/:id - delete stamp
      '': resource({
        get: async (h: ResourceHeaders) => {
          const stampId = h.params?.stampId || ''
          const stamp = db.stamps.get(stampId)
          if (!stamp) {
            return { headers: { condition: 'not-found' }, body: null }
          }
          return { headers: {}, body: stamp }
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const stampId = h.params?.stampId || ''

          if (body === null) {
            // DELETE stamp (no undo - stamps are templates)
            db.stamps.delete(stampId)
            return { headers: { deleted: true }, body: null }
          }

          // UPDATE stamp metadata
          if (body && typeof body === 'object') {
            db.stamps.update(stampId, body as Partial<{ name: string; description: string; icon: string; category: string }>)
            const stamp = db.stamps.get(stampId)
            return { headers: { updated: true }, body: stamp }
          }

          return { headers: { condition: 'not-implemented' }, body: null }
        },
      }),

      // PUT /stamps/:id/apply/:targetEntityId - apply stamp to entity
      apply: bind('targetEntityId', resource({
        put: async (h: ResourceHeaders) => {
          const stampId = h.params?.stampId || ''
          const targetEntityId = h.params?.targetEntityId || ''

          // Get target entity to find projectId
          const targetEntity = db.entities.get(targetEntityId)
          if (!targetEntity) {
            return { headers: { condition: 'not-found' }, body: { error: 'Target entity not found' } }
          }
          const projectId = targetEntity.project_id

          // Apply stamp - returns full undo info
          const result = db.stamps.apply(stampId, targetEntityId)

          // Push to history with undo data (unless this is an undo/redo operation)
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: '/history/push' },
              {
                forward: {
                  path: `/stamps/${stampId}/apply/${targetEntityId}`,
                  body: null,
                },
                backward: {
                  path: `/stamps/${stampId}/unapply/${targetEntityId}`,
                  body: {
                    projectId,
                    createdEntityIds: result.createdEntityIds,
                    createdRelationshipIds: result.createdRelationshipIds,
                    appliedAttrs: result.appliedAttrs,
                    previousAttrs: result.previousAttrs,
                  },
                },
              }
            )
          }

          return { headers: { applied: true }, body: result }
        },
      })),

      // PUT /stamps/:id/unapply/:targetEntityId - undo stamp application
      unapply: bind('targetEntityId', resource({
        put: async (h: ResourceHeaders, body: {
          projectId: string
          createdEntityIds: string[]
          createdRelationshipIds: string[]
          appliedAttrs: Record<string, AttrValue>
          previousAttrs: Record<string, AttrValue>
        }) => {
          const targetEntityId = h.params?.targetEntityId || ''

          // Delete created relationships (reverse order)
          for (const id of [...body.createdRelationshipIds].reverse()) {
            db.relationships.delete(id)
          }

          // Delete created entities (reverse order)
          for (const id of [...body.createdEntityIds].reverse()) {
            db.entities.delete(id)
          }

          // Restore target's original attrs
          // Delete attrs that were added by stamp
          for (const key of Object.keys(body.appliedAttrs)) {
            if (!(key in body.previousAttrs)) {
              db.attrs.delete(targetEntityId, key)
            }
          }

          // Restore previous values
          if (Object.keys(body.previousAttrs).length > 0) {
            db.attrs.setBatch(targetEntityId, body.previousAttrs)
          }

          return { headers: { unapplied: true }, body: null }
        },
      })),
    })),
  })
}

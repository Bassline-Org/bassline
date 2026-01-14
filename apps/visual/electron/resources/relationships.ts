/**
 * Relationships Resource with undo support
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
  skipHistory?: boolean
  kit?: {
    put: (h: object, b: unknown) => Promise<unknown>
  }
}

interface RelationshipData {
  from_entity: string
  to_entity: string
  kind: 'contains' | 'connects' | 'binds'
  label?: string | null
  binding_name?: string | null
  from_port?: string | null
  to_port?: string | null
}

export function createRelationshipsResource(db: Db) {
  return (projectId: string) =>
    routes({
      // GET /relationships - list all relationships
      // PUT /relationships - create new relationship
      '': resource({
        get: async () => ({
          headers: { type: 'js/arr' },
          body: db.relationships.list(projectId),
        }),
        put: async (h: ResourceHeaders, body: RelationshipData) => {
          const rel = db.relationships.create(projectId, {
            from_entity: body.from_entity,
            to_entity: body.to_entity,
            kind: body.kind,
            label: body.label ?? null,
            binding_name: body.binding_name ?? null,
            from_port: body.from_port ?? null,
            to_port: body.to_port ?? null,
          })

          // Push to history (unless this is an undo/redo operation)
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: '/history/push' },
              {
                forward: {
                  path: `/projects/${projectId}/relationships`,
                  body,
                },
                backward: {
                  path: `/projects/${projectId}/relationships/${rel.id}`,
                  body: null,
                },
              }
            )
          }

          return { headers: { created: true }, body: rel }
        },
      }),

      // GET/DELETE /relationships/:id
      unknown: bind('relationshipId', resource({
        get: async (h: ResourceHeaders) => {
          const relId = h.params?.relationshipId || ''
          const rel = db.relationships.get(relId)
          if (!rel) {
            return { headers: { condition: 'not-found' }, body: null }
          }
          return { headers: {}, body: rel }
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const relId = h.params?.relationshipId || ''

          if (body === null) {
            // DELETE - capture state for undo
            const rel = db.relationships.get(relId)
            if (!rel) {
              return { headers: { condition: 'not-found' }, body: null }
            }

            db.relationships.delete(relId)

            // Push to history with restoration data (unless this is an undo/redo operation)
            if (h.kit && !h.skipHistory) {
              await h.kit.put(
                { path: '/history/push' },
                {
                  forward: {
                    path: `/projects/${projectId}/relationships/${relId}`,
                    body: null,
                  },
                  backward: {
                    path: `/projects/${projectId}/relationships/${relId}`,
                    body: {
                      _restore: true,
                      id: rel.id,
                      from_entity: rel.from_entity,
                      to_entity: rel.to_entity,
                      kind: rel.kind,
                      label: rel.label,
                      binding_name: rel.binding_name,
                      from_port: rel.from_port,
                      to_port: rel.to_port,
                    },
                  },
                }
              )
            }

            return { headers: { deleted: true }, body: null }
          }

          // RESTORE - special case for undo
          if (body && typeof body === 'object' && '_restore' in body) {
            const restore = body as {
              _restore: boolean
              id: string
              from_entity: string
              to_entity: string
              kind: string
              label: string | null
              binding_name: string | null
              from_port: string | null
              to_port: string | null
            }

            db.relationships.createWithId(projectId, restore.id, {
              from_entity: restore.from_entity,
              to_entity: restore.to_entity,
              kind: restore.kind,
              label: restore.label,
              binding_name: restore.binding_name,
              from_port: restore.from_port,
              to_port: restore.to_port,
            })

            return { headers: { restored: true }, body: restore }
          }

          return { headers: { condition: 'not-implemented' }, body: null }
        },
      })),
    })
}

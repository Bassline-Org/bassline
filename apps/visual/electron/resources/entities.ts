/**
 * Entities Resource - Entities and Attrs with undo support
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'
import type { AttrValue, AttrType } from '../../src/types'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
  skipHistory?: boolean
  kit?: {
    put: (h: object, b: unknown) => Promise<unknown>
  }
}

export function createEntitiesResource(db: Db) {
  // Attrs sub-resource for a specific entity
  const createAttrsResource = (projectId: string, entityId: string) =>
    routes({
      // GET /attrs - get all attrs
      // PUT /attrs - batch set attrs
      '': resource({
        get: async () => ({
          headers: { type: 'js/obj' },
          body: db.attrs.get(entityId),
        }),
        put: async (h: ResourceHeaders, body: Record<string, AttrValue>) => {
          // Capture previous for undo
          const prev = db.attrs.get(entityId)

          db.attrs.setBatch(entityId, body)

          // Push to history (unless this is an undo/redo operation)
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: '/history/push' },
              {
                forward: {
                  path: `/projects/${projectId}/entities/${entityId}/attrs`,
                  body,
                },
                backward: {
                  path: `/projects/${projectId}/entities/${entityId}/attrs`,
                  body: prev,
                },
              }
            )
          }

          return { headers: {}, body }
        },
      }),

      // GET/PUT/DELETE /attrs/:key - single attr
      unknown: bind('key', resource({
        get: async (h: ResourceHeaders) => {
          const key = h.params?.key || ''
          const attrs = db.attrs.get(entityId)
          const value = attrs[key]
          if (value === undefined) {
            return { headers: { condition: 'not-found' }, body: null }
          }
          return { headers: {}, body: value }
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const key = h.params?.key || ''

          // Capture previous value for undo
          const attrs = db.attrs.get(entityId)
          const prev = attrs[key]
          const hadValue = key in attrs

          if (body === null) {
            // DELETE semantics
            db.attrs.delete(entityId, key)

            // Push to history (unless this is an undo/redo operation)
            if (h.kit && hadValue && !h.skipHistory) {
              await h.kit.put(
                { path: '/history/push' },
                {
                  forward: {
                    path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                    body: null,
                  },
                  backward: {
                    path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                    body: prev,
                  },
                }
              )
            }
          } else {
            // SET - extract value and type from body
            // Support both { value, type } format and direct value
            let value: AttrValue
            let type: AttrType | undefined
            if (body && typeof body === 'object' && 'value' in body) {
              const typed = body as { value: AttrValue; type?: AttrType }
              value = typed.value
              type = typed.type
            } else {
              value = body as AttrValue
            }
            db.attrs.set(entityId, key, value, type)

            // Push to history (unless this is an undo/redo operation)
            if (h.kit && !h.skipHistory) {
              await h.kit.put(
                { path: '/history/push' },
                {
                  forward: {
                    path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                    body,
                  },
                  backward: hadValue
                    ? {
                        path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                        body: prev,
                      }
                    : {
                        path: `/projects/${projectId}/entities/${entityId}/attrs/${key}`,
                        body: null,
                      },
                }
              )
            }
          }

          return { headers: {}, body }
        },
      })),
    })

  // Single entity resource
  const createEntityResource = (projectId: string) =>
    bind('entityId', routes({
      // GET /entities/:id - get entity with attrs
      // PUT /entities/:id with null - delete entity
      '': resource({
        get: async (h: ResourceHeaders) => {
          const entityId = h.params?.entityId || ''
          const entity = db.entities.get(entityId)
          if (!entity) {
            return { headers: { condition: 'not-found' }, body: null }
          }
          return { headers: {}, body: entity }
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const entityId = h.params?.entityId || ''

          // Check for cascade delete request
          const isCascadeDelete = body && typeof body === 'object' && 'cascade' in body && (body as { cascade: boolean }).cascade

          if (body === null || isCascadeDelete) {
            // DELETE - capture full state for undo
            const entity = db.entities.get(entityId)
            if (!entity) {
              return { headers: { condition: 'not-found' }, body: null }
            }

            // Get all relationships in this project
            const allRels = db.relationships.list(projectId) as Array<{
              id: string
              from_entity: string
              to_entity: string
              kind: string
              label: string | null
              binding_name: string | null
              from_port: string | null
              to_port: string | null
            }>

            // Find all descendants if cascade delete
            const entitiesToDelete: string[] = []
            if (isCascadeDelete) {
              // Recursive helper to find all descendants
              const findDescendants = (parentId: string): string[] => {
                const children = allRels
                  .filter(r => r.kind === 'contains' && r.from_entity === parentId)
                  .map(r => r.to_entity)
                const descendants = [...children]
                for (const childId of children) {
                  descendants.push(...findDescendants(childId))
                }
                return descendants
              }

              const descendants = findDescendants(entityId)
              // Add descendants in reverse order (children first), then the entity itself
              entitiesToDelete.push(...descendants.reverse(), entityId)
            } else {
              entitiesToDelete.push(entityId)
            }

            // Collect full state for undo
            const deletedEntities: Array<{
              entity: { id: string; created_at: number; modified_at: number }
              attrs: Record<string, AttrValue>
            }> = []
            const deletedRelationships: typeof allRels = []

            for (const id of entitiesToDelete) {
              const e = db.entities.get(id)
              if (e) {
                deletedEntities.push({
                  entity: { id: e.id, created_at: e.created_at, modified_at: e.modified_at },
                  attrs: e.attrs,
                })
              }
            }

            // Get relationships involving any of these entities
            const entitySet = new Set(entitiesToDelete)
            for (const rel of allRels) {
              if (entitySet.has(rel.from_entity) || entitySet.has(rel.to_entity)) {
                deletedRelationships.push(rel)
              }
            }

            // Delete all entities (this also cascades to their relationships via DB)
            for (const id of entitiesToDelete) {
              db.entities.delete(id)
            }

            // Push to history with full restoration data (unless this is an undo/redo operation)
            if (h.kit && !h.skipHistory) {
              await h.kit.put(
                { path: '/history/push' },
                {
                  forward: {
                    path: `/projects/${projectId}/entities/${entityId}`,
                    body: isCascadeDelete ? { cascade: true } : null,
                  },
                  backward: {
                    path: `/projects/${projectId}/entities/${entityId}`,
                    body: {
                      _restoreBatch: true,
                      entities: deletedEntities,
                      relationships: deletedRelationships,
                    },
                  },
                }
              )
            }

            return { headers: { deleted: true, count: entitiesToDelete.length }, body: null }
          }

          // RESTORE - special case for undo
          if (body && typeof body === 'object' && '_restore' in body) {
            const restore = body as {
              _restore: boolean
              entity: { id: string; created_at: number; modified_at: number }
              attrs: Record<string, AttrValue>
              relationships: Array<{
                id: string
                from_entity: string
                to_entity: string
                kind: string
                label: string | null
                binding_name: string | null
              }>
            }

            db.entities.createWithId(projectId, restore.entity.id, {
              created_at: restore.entity.created_at,
              modified_at: restore.entity.modified_at,
            })

            if (Object.keys(restore.attrs).length > 0) {
              db.attrs.setBatch(restore.entity.id, restore.attrs)
            }

            for (const rel of restore.relationships) {
              db.relationships.createWithId(projectId, rel.id, {
                from_entity: rel.from_entity,
                to_entity: rel.to_entity,
                kind: rel.kind,
                label: rel.label,
                binding_name: rel.binding_name,
              })
            }

            return { headers: { restored: true }, body: restore.entity }
          }

          // RESTORE BATCH - special case for undo of cascade delete
          if (body && typeof body === 'object' && '_restoreBatch' in body) {
            const restore = body as {
              _restoreBatch: boolean
              entities: Array<{
                entity: { id: string; created_at: number; modified_at: number }
                attrs: Record<string, AttrValue>
              }>
              relationships: Array<{
                id: string
                from_entity: string
                to_entity: string
                kind: string
                label: string | null
                binding_name: string | null
                from_port: string | null
                to_port: string | null
              }>
            }

            // Restore entities in reverse order (parents first)
            for (const { entity, attrs } of [...restore.entities].reverse()) {
              db.entities.createWithId(projectId, entity.id, {
                created_at: entity.created_at,
                modified_at: entity.modified_at,
              })

              if (Object.keys(attrs).length > 0) {
                db.attrs.setBatch(entity.id, attrs)
              }
            }

            // Restore relationships
            for (const rel of restore.relationships) {
              db.relationships.createWithId(projectId, rel.id, {
                from_entity: rel.from_entity,
                to_entity: rel.to_entity,
                kind: rel.kind,
                label: rel.label,
                binding_name: rel.binding_name,
                from_port: rel.from_port,
                to_port: rel.to_port,
              })
            }

            return { headers: { restored: true, count: restore.entities.length }, body: restore.entities[0]?.entity }
          }

          return { headers: { condition: 'not-implemented' }, body: null }
        },
      }),

      // /entities/:id/attrs/...
      attrs: resource({
        get: async (h: ResourceHeaders) => {
          const entityId = h.params?.entityId || ''
          return createAttrsResource(projectId, entityId).get(h)
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const entityId = h.params?.entityId || ''
          return createAttrsResource(projectId, entityId).put(h, body)
        },
      }),
    }))

  // Main entities resource (needs projectId from parent route)
  return (projectId: string) =>
    routes({
      // GET /entities - list all entities
      // PUT /entities - create new entity
      '': resource({
        get: async () => ({
          headers: { type: 'js/arr' },
          body: db.entities.list(projectId),
        }),
        put: async (h: ResourceHeaders, body: { attrs?: Record<string, AttrValue> } | null) => {
          const entity = db.entities.create(projectId)

          if (body?.attrs && Object.keys(body.attrs).length > 0) {
            db.attrs.setBatch(entity.id, body.attrs)
          }

          // Push to history (unless this is an undo/redo operation)
          if (h.kit && !h.skipHistory) {
            await h.kit.put(
              { path: '/history/push' },
              {
                forward: {
                  path: `/projects/${projectId}/entities`,
                  body,
                },
                backward: {
                  path: `/projects/${projectId}/entities/${entity.id}`,
                  body: null,
                },
              }
            )
          }

          // Return entity with attrs
          const entityWithAttrs = db.entities.get(entity.id)
          return { headers: { created: true }, body: entityWithAttrs }
        },
      }),

      // /entities/:id/...
      unknown: createEntityResource(projectId),
    })
}

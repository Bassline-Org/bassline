/**
 * Projects Resource
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

export function createProjectsResource(db: Db) {
  return routes({
    // GET /projects - list all projects
    // PUT /projects - create new project
    '': resource({
      get: async () => ({
        headers: { type: 'js/arr' },
        body: db.projects.list(),
      }),
      put: async (_h: unknown, body: { name?: string }) => {
        const project = db.projects.create(body?.name || 'Untitled Project')
        return { headers: { created: true }, body: project }
      },
    }),

    // GET /projects/:id - get project
    // PUT /projects/:id with null body - delete project
    unknown: bind('projectId', resource({
      get: async (h: { params?: { projectId?: string } }) => {
        const project = db.projects.get(h.params?.projectId || '')
        if (!project) {
          return { headers: { condition: 'not-found' }, body: null }
        }
        return { headers: {}, body: project }
      },
      put: async (h: { params?: { projectId?: string } }, body: unknown) => {
        const projectId = h.params?.projectId || ''

        // DELETE semantics: PUT with null body
        if (body === null) {
          db.projects.delete(projectId)
          return { headers: { deleted: true }, body: null }
        }

        // Could support update here in future
        return { headers: { condition: 'not-implemented' }, body: null }
      },
    })),
  })
}

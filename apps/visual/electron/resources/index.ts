/**
 * Visual Editor Resources
 *
 * Composes all resources into a single tree with kit wiring for undo/redo.
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'
import { createHistory } from './history'
import { createProjectsResource } from './projects'
import { createEntitiesResource } from './entities'
import { createRelationshipsResource } from './relationships'
import { createStampsResource } from './stamps'
import { createUIStateResource } from './ui-state'
import { createThemesResource } from './themes'
import { createSettingsResource } from './settings'
import { createShellResource } from './shell'
import { createSemanticDocsResource } from './semantic-docs'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
  kit?: {
    get: (h: object) => Promise<{ headers: object; body: unknown }>
    put: (h: object, b: unknown) => Promise<{ headers: object; body: unknown }>
  }
}

export function createVisualResources(db: Db) {
  // Create history resource
  const history = createHistory()

  // Create domain resources
  const projects = createProjectsResource(db)
  const entitiesFactory = createEntitiesResource(db)
  const relationshipsFactory = createRelationshipsResource(db)
  const uiStateFactory = createUIStateResource(db)
  const stamps = createStampsResource(db)
  const themes = createThemesResource(db)
  const settings = createSettingsResource(db)

  // Project-scoped resources (entities, relationships, ui-state)
  const projectScopedResource = bind('projectId', routes({
    '': resource({
      get: async (h: ResourceHeaders) => {
        const projectId = h.params?.projectId || ''
        const project = db.projects.get(projectId)
        if (!project) {
          return { headers: { condition: 'not-found' }, body: null }
        }
        return { headers: {}, body: project }
      },
      put: async (h: ResourceHeaders, body: unknown) => {
        const projectId = h.params?.projectId || ''
        if (body === null) {
          db.projects.delete(projectId)
          return { headers: { deleted: true }, body: null }
        }
        return { headers: { condition: 'not-implemented' }, body: null }
      },
    }),
    entities: resource({
      get: async (h: ResourceHeaders) => {
        const projectId = h.params?.projectId || ''
        return entitiesFactory(projectId).get(h)
      },
      put: async (h: ResourceHeaders, body: unknown) => {
        const projectId = h.params?.projectId || ''
        return entitiesFactory(projectId).put(h, body)
      },
    }),
    relationships: resource({
      get: async (h: ResourceHeaders) => {
        const projectId = h.params?.projectId || ''
        return relationshipsFactory(projectId).get(h)
      },
      put: async (h: ResourceHeaders, body: unknown) => {
        const projectId = h.params?.projectId || ''
        return relationshipsFactory(projectId).put(h, body)
      },
    }),
    'ui-state': resource({
      get: async (h: ResourceHeaders) => {
        const projectId = h.params?.projectId || ''
        return uiStateFactory(projectId).get(h)
      },
      put: async (h: ResourceHeaders, body: unknown) => {
        const projectId = h.params?.projectId || ''
        return uiStateFactory(projectId).put(h, body)
      },
    }),
  }))

  // Create shell resource
  const shell = createShellResource()

  // Create semantic docs resource
  const semanticDocs = createSemanticDocsResource(db)

  // Main resource tree
  const tree = routes({
    projects: routes({
      '': resource({
        get: async () => projects.get({ path: '/' }),
        put: async (h: ResourceHeaders, body: unknown) => projects.put({ ...h, path: '/' }, body),
      }),
      unknown: projectScopedResource,
    }),
    stamps,
    themes,
    settings,
    history,
    shell,
    'semantic-docs': semanticDocs,
  })

  // Create a wrapper that injects kit (self-reference) into all requests
  // This allows resources to push to /history via h.kit
  const withKit = (res: typeof tree): typeof tree => {
    const kit = {
      get: (h: object) => withKit(res).get(h),
      put: (h: object, b: unknown) => withKit(res).put(h, b),
    }

    return {
      get: async (h: ResourceHeaders) => {
        return res.get({ ...h, kit })
      },
      put: async (h: ResourceHeaders, body: unknown) => {
        return res.put({ ...h, kit }, body)
      },
    }
  }

  return withKit(tree)
}

export type VisualResources = ReturnType<typeof createVisualResources>

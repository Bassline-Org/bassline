/**
 * Themes Resource - Theme management (no undo needed)
 */

import { resource, routes, bind } from '@bassline/core'
import type { db as DbType } from '../db'

type Db = typeof DbType

interface ResourceHeaders {
  path?: string
  params?: Record<string, string>
}

export function createThemesResource(db: Db) {
  return routes({
    // GET /themes - list all themes
    // PUT /themes - create new theme
    '': resource({
      get: async () => ({
        headers: { type: 'js/arr' },
        body: db.themes.list(),
      }),
      put: async (_h: ResourceHeaders, body: { name: string; basedOn?: string }) => {
        const theme = db.themes.create(body.name, body.basedOn)
        return { headers: { created: true }, body: theme }
      },
    }),

    // Token definitions
    tokens: resource({
      get: async () => ({
        headers: { type: 'js/arr' },
        body: db.themes.getTokens(),
      }),
    }),

    // Individual theme routes
    unknown: bind('themeId', routes({
      // GET /themes/:id - get theme with colors
      // PUT /themes/:id with null - delete theme
      '': resource({
        get: async (h: ResourceHeaders) => {
          const themeId = h.params?.themeId || ''
          const theme = db.themes.get(themeId)
          if (!theme) {
            return { headers: { condition: 'not-found' }, body: null }
          }
          return { headers: {}, body: theme }
        },
        put: async (h: ResourceHeaders, body: unknown) => {
          const themeId = h.params?.themeId || ''

          if (body === null) {
            db.themes.delete(themeId)
            return { headers: { deleted: true }, body: null }
          }

          return { headers: { condition: 'not-implemented' }, body: null }
        },
      }),

      // PUT /themes/:id/colors/:tokenId - update color
      colors: bind('tokenId', resource({
        put: async (h: ResourceHeaders, body: string) => {
          const themeId = h.params?.themeId || ''
          const tokenId = h.params?.tokenId || ''

          db.themes.updateColor(themeId, tokenId, body)
          return { headers: { updated: true }, body }
        },
      })),
    })),
  })
}

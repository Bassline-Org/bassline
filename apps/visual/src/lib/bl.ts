/**
 * Typed Bassline Client
 *
 * Provides a familiar API shape while using resources underneath.
 */

import type {
  Project,
  EntityWithAttrs,
  Relationship,
  UIState,
  Theme,
  TokenDefinition,
  StampWithAttrs,
  StampWithMembers,
  ApplyStampResult,
} from '../types'

// =============================================================================
// Window Type Declarations
// =============================================================================

export interface ResourceHeaders {
  path: string
  [key: string]: unknown
}

export interface ResourceResponse<T = unknown> {
  headers: {
    type?: string
    condition?: 'not-found' | 'error' | 'empty'
    created?: boolean
    deleted?: boolean
    updated?: boolean
    [key: string]: unknown
  }
  body: T
}

declare global {
  interface Window {
    bl: {
      get: <T = unknown>(headers: ResourceHeaders) => Promise<ResourceResponse<T>>
      put: <T = unknown>(headers: ResourceHeaders, body?: unknown) => Promise<ResourceResponse<T>>
    }
  }
}

// =============================================================================
// History State
// =============================================================================

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  undoCount: number
  redoCount: number
}

// =============================================================================
// Typed Client
// =============================================================================

export const bl = {
  // ===========================================================================
  // Projects
  // ===========================================================================

  projects: {
    list: async (): Promise<Project[]> => {
      const res = await window.bl.get<Project[]>({ path: '/projects' })
      return res.body
    },

    get: async (id: string): Promise<Project | null> => {
      const res = await window.bl.get<Project>({ path: `/projects/${id}` })
      return res.headers.condition === 'not-found' ? null : res.body
    },

    create: async (name: string): Promise<Project> => {
      const res = await window.bl.put<Project>({ path: '/projects' }, { name })
      return res.body
    },

    delete: async (id: string): Promise<void> => {
      await window.bl.put({ path: `/projects/${id}` }, null)
    },

    update: async (id: string, data: { name?: string }): Promise<Project> => {
      const res = await window.bl.put<Project>({ path: `/projects/${id}` }, data)
      return res.body
    },
  },

  // ===========================================================================
  // Entities
  // ===========================================================================

  entities: {
    list: async (projectId: string): Promise<EntityWithAttrs[]> => {
      const res = await window.bl.get<EntityWithAttrs[]>({
        path: `/projects/${projectId}/entities`,
      })
      return res.body
    },

    get: async (projectId: string, id: string): Promise<EntityWithAttrs | null> => {
      const res = await window.bl.get<EntityWithAttrs>({
        path: `/projects/${projectId}/entities/${id}`,
      })
      return res.headers.condition === 'not-found' ? null : res.body
    },

    create: async (
      projectId: string,
      attrs?: Record<string, string>
    ): Promise<EntityWithAttrs> => {
      const res = await window.bl.put<EntityWithAttrs>(
        { path: `/projects/${projectId}/entities` },
        { attrs }
      )
      return res.body
    },

    delete: async (projectId: string, id: string, options?: { cascade?: boolean }): Promise<void> => {
      const body = options?.cascade ? { cascade: true } : null
      await window.bl.put({ path: `/projects/${projectId}/entities/${id}` }, body)
    },
  },

  // ===========================================================================
  // Attrs
  // ===========================================================================

  attrs: {
    get: async (projectId: string, entityId: string): Promise<Record<string, string>> => {
      const res = await window.bl.get<Record<string, string>>({
        path: `/projects/${projectId}/entities/${entityId}/attrs`,
      })
      return res.body
    },

    set: async (
      projectId: string,
      entityId: string,
      key: string,
      value: string
    ): Promise<void> => {
      await window.bl.put(
        { path: `/projects/${projectId}/entities/${entityId}/attrs/${key}` },
        value
      )
    },

    delete: async (projectId: string, entityId: string, key: string): Promise<void> => {
      await window.bl.put(
        { path: `/projects/${projectId}/entities/${entityId}/attrs/${key}` },
        null
      )
    },

    setBatch: async (
      projectId: string,
      entityId: string,
      attrs: Record<string, string>
    ): Promise<void> => {
      await window.bl.put(
        { path: `/projects/${projectId}/entities/${entityId}/attrs` },
        attrs
      )
    },
  },

  // ===========================================================================
  // Relationships
  // ===========================================================================

  relationships: {
    list: async (projectId: string): Promise<Relationship[]> => {
      const res = await window.bl.get<Relationship[]>({
        path: `/projects/${projectId}/relationships`,
      })
      return res.body
    },

    get: async (projectId: string, id: string): Promise<Relationship | null> => {
      const res = await window.bl.get<Relationship>({
        path: `/projects/${projectId}/relationships/${id}`,
      })
      return res.headers.condition === 'not-found' ? null : res.body
    },

    create: async (
      projectId: string,
      data: {
        from_entity: string
        to_entity: string
        kind: 'contains' | 'connects' | 'binds'
        label?: string | null
        binding_name?: string | null
        from_port?: string | null
        to_port?: string | null
      }
    ): Promise<Relationship> => {
      const res = await window.bl.put<Relationship>(
        { path: `/projects/${projectId}/relationships` },
        data
      )
      return res.body
    },

    delete: async (projectId: string, id: string): Promise<void> => {
      await window.bl.put({ path: `/projects/${projectId}/relationships/${id}` }, null)
    },
  },

  // ===========================================================================
  // UI State
  // ===========================================================================

  uiState: {
    get: async (projectId: string): Promise<UIState> => {
      const res = await window.bl.get<UIState>({
        path: `/projects/${projectId}/ui-state`,
      })
      return res.body
    },

    update: async (
      projectId: string,
      data: Partial<{
        viewport_x: number
        viewport_y: number
        viewport_zoom: number
        selected_entity: string | null
      }>
    ): Promise<UIState> => {
      const res = await window.bl.put<UIState>(
        { path: `/projects/${projectId}/ui-state` },
        data
      )
      return res.body
    },
  },

  // ===========================================================================
  // Stamps
  // ===========================================================================

  stamps: {
    list: async (filter?: {
      kind?: 'template' | 'vocabulary'
      category?: string
    }): Promise<StampWithAttrs[]> => {
      const res = await window.bl.get<StampWithAttrs[]>({ path: '/stamps' })
      // Filter client-side for now (could move to resource later)
      let stamps = res.body
      if (filter?.kind) {
        stamps = stamps.filter((s) => s.kind === filter.kind)
      }
      if (filter?.category) {
        stamps = stamps.filter((s) => s.category === filter.category)
      }
      return stamps
    },

    get: async (id: string): Promise<StampWithMembers | null> => {
      const res = await window.bl.get<StampWithMembers>({ path: `/stamps/${id}` })
      return res.headers.condition === 'not-found' ? null : res.body
    },

    create: async (data: {
      name: string
      sourceEntityId?: string
      kind?: 'template' | 'vocabulary'
      category?: string
      description?: string
    }): Promise<StampWithMembers> => {
      const res = await window.bl.put<StampWithMembers>({ path: '/stamps' }, data)
      return res.body
    },

    apply: async (stampId: string, targetEntityId: string): Promise<ApplyStampResult> => {
      const res = await window.bl.put<ApplyStampResult>(
        { path: `/stamps/${stampId}/apply/${targetEntityId}` },
        null
      )
      return res.body
    },

    update: async (
      id: string,
      data: Partial<{ name: string; description: string; icon: string; category: string }>
    ): Promise<void> => {
      await window.bl.put({ path: `/stamps/${id}` }, data)
    },

    delete: async (id: string): Promise<void> => {
      await window.bl.put({ path: `/stamps/${id}` }, null)
    },
  },

  // ===========================================================================
  // Themes
  // ===========================================================================

  themes: {
    list: async (): Promise<Theme[]> => {
      const res = await window.bl.get<Theme[]>({ path: '/themes' })
      return res.body
    },

    get: async (id: string): Promise<Theme | null> => {
      const res = await window.bl.get<Theme>({ path: `/themes/${id}` })
      return res.headers.condition === 'not-found' ? null : res.body
    },

    create: async (name: string, basedOn?: string): Promise<Theme> => {
      const res = await window.bl.put<Theme>({ path: '/themes' }, { name, basedOn })
      return res.body
    },

    updateColor: async (themeId: string, tokenId: string, value: string): Promise<void> => {
      await window.bl.put({ path: `/themes/${themeId}/colors/${tokenId}` }, value)
    },

    delete: async (id: string): Promise<void> => {
      await window.bl.put({ path: `/themes/${id}` }, null)
    },

    getTokens: async (): Promise<TokenDefinition[]> => {
      const res = await window.bl.get<TokenDefinition[]>({ path: '/themes/tokens' })
      return res.body
    },
  },

  // ===========================================================================
  // Settings
  // ===========================================================================

  settings: {
    get: async (key: string): Promise<string | null> => {
      const res = await window.bl.get<string>({ path: `/settings/${key}` })
      return res.headers.condition === 'not-found' ? null : res.body
    },

    set: async (key: string, value: string): Promise<void> => {
      await window.bl.put({ path: `/settings/${key}` }, value)
    },
  },

  // ===========================================================================
  // Semantic Docs
  // ===========================================================================

  semanticDocs: {
    list: async (): Promise<Array<{
      id: string
      name: string
      summary: string | null
      description: string | null
      usage: string | null
      examples: string | null
    }>> => {
      const res = await window.bl.get<Array<{
        id: string
        name: string
        summary: string | null
        description: string | null
        usage: string | null
        examples: string | null
      }>>({ path: '/semantic-docs' })
      return res.body
    },

    get: async (id: string): Promise<{
      id: string
      name: string
      summary: string | null
      description: string | null
      usage: string | null
      examples: string | null
    } | null> => {
      const res = await window.bl.get<{
        id: string
        name: string
        summary: string | null
        description: string | null
        usage: string | null
        examples: string | null
      }>({ path: `/semantic-docs/${id}` })
      return res.headers.condition === 'not-found' ? null : res.body
    },
  },

  // ===========================================================================
  // History (Undo/Redo)
  // ===========================================================================

  history: {
    state: async (): Promise<HistoryState> => {
      const res = await window.bl.get<HistoryState>({ path: '/history' })
      return res.body
    },

    undo: async (): Promise<void> => {
      await window.bl.put({ path: '/history/undo' }, null)
    },

    redo: async (): Promise<void> => {
      await window.bl.put({ path: '/history/redo' }, null)
    },

    clear: async (): Promise<void> => {
      await window.bl.put({ path: '/history/clear' }, null)
    },

    /** Start a batch - all operations until endBatch are grouped as one undo step */
    beginBatch: async (): Promise<void> => {
      await window.bl.put({ path: '/history/beginBatch' }, null)
    },

    /** End a batch - commits all collected operations as one undo step */
    endBatch: async (): Promise<void> => {
      await window.bl.put({ path: '/history/endBatch' }, null)
    },

    /** Cancel a batch - discards collected operations without adding to history */
    cancelBatch: async (): Promise<void> => {
      await window.bl.put({ path: '/history/cancelBatch' }, null)
    },
  },
}

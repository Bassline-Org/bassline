// =============================================================================
// Entity-Attribute-Value Data Model
// =============================================================================

export interface Project {
  id: string
  name: string
  created_at: number
  modified_at: number
}

/** Core entity - just identity. All properties are attrs. */
export interface Entity {
  id: string
  project_id: string
  created_at: number
  modified_at: number
}

/** Entity with attrs resolved (for convenience in views) */
export interface EntityWithAttrs extends Entity {
  attrs: Record<string, string>
}

/** Attribute - key/value pair on an entity */
export interface Attr {
  entity_id: string
  key: string
  value: string | null
  type: 'string' | 'number' | 'boolean' | 'json'
}

/** Relationship between entities */
export interface Relationship {
  id: string
  project_id: string
  from_entity: string
  to_entity: string
  kind: 'contains' | 'connects' | 'binds'
  label: string | null
  binding_name: string | null
}

/** Stored view (named query) */
export interface StoredView {
  id: string
  project_id: string | null
  name: string
  description: string | null
  query: string
  layout: 'graph' | 'table' | 'tree' | 'cards'
  layout_config: string | null
  created_at: number
}

/** UI state per project */
export interface UIState {
  project_id: string
  viewport_x: number
  viewport_y: number
  viewport_zoom: number
  selected_entity: string | null
}

/** Theme definition */
export interface Theme {
  id: string
  name: string
  description: string
  author: string
  isSystem: boolean
  colors: Record<string, string>
  typography: Record<string, string>
}

export interface TokenDefinition {
  id: string
  category: string
  label: string
  description: string
}

// =============================================================================
// Stamps
// =============================================================================

/** Stamp - reusable template or vocabulary definition */
export interface Stamp {
  id: string
  name: string
  description: string | null
  icon: string | null
  category: string | null
  kind: 'template' | 'vocabulary'
  created_at: number
  modified_at: number
}

/** Stamp with its attrs loaded */
export interface StampWithAttrs extends Stamp {
  attrs: Record<string, string>
}

/** Stamp member (child entity template) */
export interface StampMember {
  id: string
  stamp_id: string
  local_id: string
}

/** Stamp member with attrs */
export interface StampMemberWithAttrs extends StampMember {
  attrs: Record<string, string>
}

/** Full stamp with members and relationships */
export interface StampWithMembers extends StampWithAttrs {
  members: StampMemberWithAttrs[]
  relationships: StampRelationship[]
}

/** Internal relationship within a stamp */
export interface StampRelationship {
  id: string
  stamp_id: string
  from_local_id: string | null
  to_local_id: string | null
  kind: string
}

/** Result of applying a stamp */
export interface ApplyStampResult {
  createdEntityIds: string[]
  createdRelationshipIds: string[]
  appliedAttrs: Record<string, string>
  previousAttrs: Record<string, string>
}

// =============================================================================
// Loader Data Types
// =============================================================================

export interface ProjectsLoaderData {
  projects: Project[]
}

export interface EditorLoaderData {
  project: Project
  entities: EntityWithAttrs[]
  relationships: Relationship[]
  stamps: StampWithAttrs[]
  uiState: UIState
}

// =============================================================================
// Window API
// =============================================================================

declare global {
  interface Window {
    db: {
      projects: {
        list: () => Promise<Project[]>
        get: (id: string) => Promise<Project | null>
        create: (name: string) => Promise<Project>
        delete: (id: string) => Promise<void>
      }
      entities: {
        list: (projectId: string) => Promise<EntityWithAttrs[]>
        get: (id: string) => Promise<EntityWithAttrs | null>
        create: (projectId: string) => Promise<Entity>
        createWithId: (projectId: string, id: string, timestamps?: { created_at: number; modified_at: number }) => Promise<Entity>
        delete: (id: string) => Promise<void>
      }
      attrs: {
        get: (entityId: string) => Promise<Record<string, string>>
        set: (entityId: string, key: string, value: string, type?: string) => Promise<void>
        delete: (entityId: string, key: string) => Promise<void>
        setBatch: (entityId: string, attrs: Record<string, string>) => Promise<void>
      }
      relationships: {
        list: (projectId: string) => Promise<Relationship[]>
        get: (id: string) => Promise<Relationship | null>
        create: (projectId: string, data: Omit<Relationship, 'id' | 'project_id'>) => Promise<Relationship>
        createWithId: (projectId: string, id: string, data: Omit<Relationship, 'id' | 'project_id'>) => Promise<Relationship>
        delete: (id: string) => Promise<void>
      }
      uiState: {
        get: (projectId: string) => Promise<UIState>
        update: (projectId: string, data: Partial<UIState>) => Promise<UIState>
      }
      themes: {
        list: () => Promise<Theme[]>
        get: (id: string) => Promise<Theme | null>
        create: (name: string, basedOn?: string) => Promise<Theme>
        updateColor: (themeId: string, tokenId: string, value: string) => Promise<void>
        delete: (id: string) => Promise<void>
        getTokens: () => Promise<TokenDefinition[]>
      }
      stamps: {
        list: (filter?: { kind?: 'template' | 'vocabulary'; category?: string }) => Promise<StampWithAttrs[]>
        get: (id: string) => Promise<StampWithMembers | null>
        create: (data: { name: string; sourceEntityId?: string; kind?: 'template' | 'vocabulary'; category?: string; description?: string }) => Promise<string>
        apply: (stampId: string, targetEntityId: string) => Promise<ApplyStampResult>
        delete: (stampId: string) => Promise<void>
        update: (id: string, data: Partial<{ name: string; description: string; icon: string; category: string }>) => Promise<void>
      }
      settings: {
        get: (key: string) => Promise<string | null>
        set: (key: string, value: string) => Promise<void>
      }
    }
  }
}

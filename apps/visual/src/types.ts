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

// =============================================================================
// Typed Attributes
// =============================================================================

/** Supported attribute types */
export type AttrType = 'string' | 'number' | 'json' | 'blob'

/** Attribute value - typed based on AttrType */
export type AttrValue = string | number | object | ArrayBuffer

/**
 * Safely convert an AttrValue to string.
 * Most attrs are strings, this helper handles the type safely.
 */
export function attrString(value: AttrValue | undefined): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return ''
}

/**
 * Get an attr as string, with optional default.
 * Shorthand for common pattern: attrString(entity.attrs.foo) || 'default'
 */
export function getAttr(attrs: Record<string, AttrValue>, key: string, defaultValue = ''): string {
  return attrString(attrs[key]) || defaultValue
}

/**
 * Safely convert an AttrValue to number.
 * Returns the value if it's already a number, otherwise parses from string.
 */
export function attrNumber(value: AttrValue | undefined, defaultValue = 0): number {
  if (value === undefined || value === null) return defaultValue
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const num = parseFloat(value)
    return isNaN(num) ? defaultValue : num
  }
  return defaultValue
}

// =============================================================================
// DataObject Model
// =============================================================================

/**
 * A DataObject is a typed key-value object.
 * It's "entity-shaped" when it has an `id` field.
 *
 * This is the core abstraction for semantic I/O:
 * - Semantics receive DataObject[] as input
 * - Semantics produce DataObject[] as output
 * - Entity attrs IS a DataObject (with id injected)
 *
 * The `body` field (if present) contains typed payload data.
 * This aligns with Bassline's request/response model.
 */
export type DataObject = Record<string, AttrValue>

/**
 * Convert a DataObject to a Bassline request.
 * Extracts `body` as the request body, everything else becomes headers.
 */
export function toRequest(data: DataObject): { headers: DataObject; body?: AttrValue } {
  const { body, ...headers } = data
  return body !== undefined ? { headers, body } : { headers }
}

/**
 * Convert a Bassline response to a DataObject.
 * Merges headers and body into a single object.
 */
export function fromResponse(res: { headers: Record<string, unknown>; body?: unknown }): DataObject {
  const data: DataObject = {}
  for (const [key, value] of Object.entries(res.headers)) {
    if (value !== undefined && value !== null) {
      data[key] = value as AttrValue
    }
  }
  if (res.body !== undefined) {
    data.body = res.body as AttrValue
  }
  return data
}

/**
 * Get relationships that involve the given data objects (by their id fields).
 * Returns relationships where both from_entity and to_entity are in the data set.
 */
export function getRelationshipsForData(
  data: DataObject[],
  allRelationships: Relationship[]
): Relationship[] {
  const ids = new Set(
    data
      .map(d => d.id)
      .filter((id): id is string => typeof id === 'string')
  )
  return allRelationships.filter(r => ids.has(r.from_entity) && ids.has(r.to_entity))
}

/**
 * Entity with attrs resolved (for convenience in views)
 *
 * The `attrs` object includes:
 * - `id`: The entity id (always injected)
 * - All attribute key/value pairs with their typed values
 *
 * This aligns with Bassline's request model where attrs = headers
 * and attrs.body (if present) = body
 */
export interface EntityWithAttrs extends Entity {
  attrs: Record<string, AttrValue>
}

/** Attribute row as stored in database */
export interface Attr {
  entity_id: string
  key: string
  type: AttrType
  string_value: string | null
  number_value: number | null
  json_value: string | null
  blob_value: ArrayBuffer | null
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
  from_port: string | null
  to_port: string | null
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
  attrs: Record<string, AttrValue>
}

/** Stamp member (child entity template) */
export interface StampMember {
  id: string
  stamp_id: string
  local_id: string
}

/** Stamp member with attrs */
export interface StampMemberWithAttrs extends StampMember {
  attrs: Record<string, AttrValue>
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
  appliedAttrs: Record<string, AttrValue>
  previousAttrs: Record<string, AttrValue>
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


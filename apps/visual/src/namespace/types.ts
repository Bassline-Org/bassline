// ============================================================================
// Namespace Meta-Model Types
// ============================================================================

/**
 * Field definition for schemas and query parameters.
 * Describes the shape and validation of a single field.
 */
export interface FieldDef {
  type: 'string' | 'number' | 'boolean' | 'ref' | 'array' | 'object'
  ref?: string // For type='ref', the name of target (late-bound)
  items?: FieldDef // For type='array'
  fields?: Record<string, FieldDef> // For type='object' (nested)
  label?: string
  placeholder?: string
  required?: boolean
  min?: number
  max?: number
}

/**
 * Schema - Describes the shape of data for entities
 */
export interface Schema {
  $kind: 'schema'
  name: string
  fields: Record<string, FieldDef>
}

/**
 * View - A phlow view definition as data
 */
export interface View {
  $kind: 'view'
  name: string
  viewType: 'list' | 'columnedList' | 'textEditor' | 'descriptor'
  title: string
  priority?: number
  source: string // Name of query or object to display
  textField?: string // for list, textEditor
  columns?: Record<string, { field: string; label?: string }> // for columnedList
  schema?: string // for descriptor - name of schema
}

/**
 * WhereClause - A single condition in a query
 */
export interface WhereClause {
  field: string
  op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte'
  param?: string // Bind to query param
  value?: unknown // Or use literal value
}

/**
 * Query - A query with its own parameter schema (for forms)
 */
export interface Query {
  $kind: 'query'
  name: string
  description?: string
  params: Record<string, FieldDef> // Schema for the query form
  match: {
    schema?: string // Only match objects with this $schema
    kind?: string // Only match objects with this $kind
    where?: WhereClause[]
  }
}

/**
 * Document - Text content
 */
export interface Document {
  $kind: 'document'
  title?: string
  content: string
  format?: 'text' | 'markdown' | 'json'
}

/**
 * Entity - Data instance referencing a schema
 */
export interface Entity {
  $kind: 'entity'
  $schema: string // Name of schema object
  [key: string]: unknown
}

/**
 * Union of all graph object kinds
 */
export type GraphObject = Schema | View | Query | Document | Entity

/**
 * Type guard for Schema
 */
export function isSchema(obj: unknown): obj is Schema {
  return typeof obj === 'object' && obj !== null && (obj as any).$kind === 'schema'
}

/**
 * Type guard for View
 */
export function isView(obj: unknown): obj is View {
  return typeof obj === 'object' && obj !== null && (obj as any).$kind === 'view'
}

/**
 * Type guard for Query
 */
export function isQuery(obj: unknown): obj is Query {
  return typeof obj === 'object' && obj !== null && (obj as any).$kind === 'query'
}

/**
 * Type guard for Document
 */
export function isDocument(obj: unknown): obj is Document {
  return typeof obj === 'object' && obj !== null && (obj as any).$kind === 'document'
}

/**
 * Type guard for Entity
 */
export function isEntity(obj: unknown): obj is Entity {
  return typeof obj === 'object' && obj !== null && (obj as any).$kind === 'entity'
}

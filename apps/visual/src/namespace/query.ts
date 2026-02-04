import type { Query, WhereClause, Entity } from './types'

/**
 * Evaluate a single where clause against an object
 */
function evaluateClause(obj: Record<string, unknown>, clause: WhereClause, params: Record<string, unknown>): boolean {
  const fieldValue = obj[clause.field]
  const compareValue = clause.param !== undefined ? params[clause.param] : clause.value

  // Skip clause if param is undefined/null (treat as "any")
  if (clause.param !== undefined && (compareValue === undefined || compareValue === null || compareValue === '')) {
    return true
  }

  switch (clause.op) {
    case 'eq':
      return fieldValue === compareValue

    case 'neq':
      return fieldValue !== compareValue

    case 'contains':
      if (typeof fieldValue === 'string' && typeof compareValue === 'string') {
        return fieldValue.toLowerCase().includes(compareValue.toLowerCase())
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(compareValue)
      }
      return false

    case 'gt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue > compareValue

    case 'lt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue < compareValue

    case 'gte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue >= compareValue

    case 'lte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue <= compareValue

    default:
      return true
  }
}

/**
 * Check if an object matches a query
 */
function matchesQuery(obj: Record<string, unknown>, query: Query, params: Record<string, unknown>): boolean {
  const { match } = query

  // Check $schema constraint
  if (match.schema && obj.$schema !== match.schema) {
    return false
  }

  // Check $kind constraint
  if (match.kind && obj.$kind !== match.kind) {
    return false
  }

  // Check where clauses
  if (match.where) {
    for (const clause of match.where) {
      if (!evaluateClause(obj, clause, params)) {
        return false
      }
    }
  }

  return true
}

/**
 * Run a query against the store
 *
 * @param store - The namespace store (Map<string, object>)
 * @param query - The query definition
 * @param params - Parameter values for the query
 * @returns Array of matching objects with their paths
 */
export function runQuery(
  store: Map<string, object>,
  query: Query,
  params: Record<string, unknown> = {}
): Array<{ path: string; value: object }> {
  const results: Array<{ path: string; value: object }> = []

  for (const [path, obj] of store.entries()) {
    if (matchesQuery(obj as Record<string, unknown>, query, params)) {
      results.push({ path, value: obj })
    }
  }

  return results
}

/**
 * Find all entities matching a schema name
 */
export function findBySchema(store: Map<string, object>, schemaName: string): Array<{ path: string; value: Entity }> {
  const results: Array<{ path: string; value: Entity }> = []

  for (const [path, obj] of store.entries()) {
    const o = obj as Record<string, unknown>
    if (o.$kind === 'entity' && o.$schema === schemaName) {
      results.push({ path, value: obj as Entity })
    }
  }

  return results
}

/**
 * Find all objects of a specific kind
 */
export function findByKind(store: Map<string, object>, kind: string): Array<{ path: string; value: object }> {
  const results: Array<{ path: string; value: object }> = []

  for (const [path, obj] of store.entries()) {
    if ((obj as Record<string, unknown>).$kind === kind) {
      results.push({ path, value: obj })
    }
  }

  return results
}

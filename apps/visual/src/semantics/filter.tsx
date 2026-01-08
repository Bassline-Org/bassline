/**
 * Filter Semantic
 *
 * Filters entities based on predicates. Supports two modes:
 *
 * MANUAL MODE (default):
 * - Operates on entities that bind to it
 * - Uses filter.predicate: "attr:value" or "attr" syntax
 *
 * QUERY MODE:
 * - Scans ALL entities in the project
 * - Uses filter.where.* attributes for predicates
 * - Multiple predicates are ANDed together
 *
 * Configuration:
 * - filter.mode = "manual" | "query"
 * - filter.predicate = "attr:value" (manual mode only)
 * - filter.where.<attr> = "<predicate>" (query mode)
 *
 * Predicate syntax for query mode:
 * - "value"      - exact match
 * - "~pattern"   - glob pattern (* and ? wildcards)
 * - "!value"     - not equal
 * - ">N"         - greater than
 * - "<N"         - less than
 * - ">=N"        - greater than or equal
 * - "<=N"        - less than or equal
 */

import { useMemo } from 'react'
import { Filter as FilterIcon, Search, Link } from 'lucide-react'
import type { EntityWithAttrs, EditorLoaderData } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useLoaderData } from 'react-router'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useBl } from '../hooks/useBl'
import { useCallback } from 'react'

interface FilterSemanticProps {
  entity: EntityWithAttrs
}

/**
 * Parse and match a predicate against an entity (manual mode).
 *
 * Predicate formats:
 * - "attr:value" - exact match
 * - "attr:*value*" - contains (wildcards)
 * - "attr" - attribute exists
 */
function matchManualPredicate(entity: EntityWithAttrs, predicate: string): boolean {
  if (!predicate) return true

  const colonIndex = predicate.indexOf(':')

  if (colonIndex === -1) {
    // Just attribute name - check existence
    return entity.attrs[predicate] !== undefined
  }

  const attr = predicate.slice(0, colonIndex)
  const pattern = predicate.slice(colonIndex + 1)
  const value = entity.attrs[attr]

  if (value === undefined) return false

  // Check for wildcards
  if (pattern.startsWith('*') && pattern.endsWith('*')) {
    const search = pattern.slice(1, -1).toLowerCase()
    return value.toLowerCase().includes(search)
  }

  if (pattern.startsWith('*')) {
    const search = pattern.slice(1).toLowerCase()
    return value.toLowerCase().endsWith(search)
  }

  if (pattern.endsWith('*')) {
    const search = pattern.slice(0, -1).toLowerCase()
    return value.toLowerCase().startsWith(search)
  }

  // Exact match
  return value === pattern
}

/**
 * Simple glob pattern matching (* and ? wildcards)
 */
function globMatch(str: string, pattern: string): boolean {
  // Convert glob to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
    .replace(/\*/g, '.*')                  // * -> .*
    .replace(/\?/g, '.')                   // ? -> .

  const regex = new RegExp(`^${regexPattern}$`, 'i')
  return regex.test(str)
}

/**
 * Match a query predicate against an attribute value.
 *
 * Predicate formats:
 * - "value"      - exact match
 * - "~pattern"   - glob pattern
 * - "!value"     - not equal
 * - ">N"         - greater than
 * - "<N"         - less than
 * - ">=N"        - greater or equal
 * - "<=N"        - less or equal
 */
function matchQueryPredicate(attrValue: string | undefined, predicate: string): boolean {
  // For existence check (empty predicate means "has this attr")
  if (!predicate) return attrValue !== undefined

  // Glob pattern: ~pattern
  if (predicate.startsWith('~')) {
    if (attrValue === undefined) return false
    return globMatch(attrValue, predicate.slice(1))
  }

  // Not equal: !value
  if (predicate.startsWith('!')) {
    const expected = predicate.slice(1)
    return attrValue !== expected
  }

  // Numeric comparisons: >=, <=, >, <
  const compMatch = predicate.match(/^(>=|<=|>|<)(.+)$/)
  if (compMatch) {
    const [, op, numStr] = compMatch
    if (attrValue === undefined) return false
    const attrNum = parseFloat(attrValue)
    const predNum = parseFloat(numStr)
    if (isNaN(attrNum) || isNaN(predNum)) return false
    switch (op) {
      case '>': return attrNum > predNum
      case '<': return attrNum < predNum
      case '>=': return attrNum >= predNum
      case '<=': return attrNum <= predNum
    }
  }

  // Exact match
  return attrValue === predicate
}

export function FilterSemantic({ entity }: FilterSemanticProps) {
  const { project, entities: allEntities } = useLoaderData() as EditorLoaderData
  const { bl, revalidate } = useBl()

  const mode = entity.attrs['filter.mode'] || 'manual'
  const predicate = entity.attrs['filter.predicate'] || ''
  const { inputEntities, inputRelationships, boundEntityIds } = useSemanticInput(entity)

  // Parse query predicates from filter.where.* attrs
  const queryPredicates = useMemo(() => {
    const predicates: [string, string][] = []
    for (const [key, value] of Object.entries(entity.attrs)) {
      if (key.startsWith('filter.where.')) {
        const attrName = key.slice('filter.where.'.length)
        predicates.push([attrName, value])
      }
    }
    return predicates
  }, [entity.attrs])

  // Get entities to filter based on mode
  const sourceEntities = useMemo(() => {
    if (mode === 'query') {
      // Query mode: all project entities except semantic entities
      return allEntities.filter(e =>
        e.id !== entity.id && !e.attrs['semantic.type']
      )
    }
    // Manual mode: bound entities
    return inputEntities
  }, [mode, allEntities, inputEntities, entity.id])

  // Apply the filter
  const filtered = useMemo(() => {
    if (mode === 'query') {
      // Query mode: use filter.where.* predicates (ANDed)
      if (queryPredicates.length === 0) return sourceEntities
      return sourceEntities.filter(e =>
        queryPredicates.every(([attr, pred]) =>
          matchQueryPredicate(e.attrs[attr], pred)
        )
      )
    }

    // Manual mode: use filter.predicate
    if (!predicate) return sourceEntities
    return sourceEntities.filter(e => matchManualPredicate(e, predicate))
  }, [mode, sourceEntities, predicate, queryPredicates])

  // Filter relationships to only include those between filtered entities
  const filteredRelationships = useMemo(() => {
    const filteredIds = new Set(filtered.map(e => e.id))
    return inputRelationships.filter(
      r => filteredIds.has(r.from_entity) && filteredIds.has(r.to_entity)
    )
  }, [filtered, inputRelationships])

  // Expose output for downstream semantics
  useSemanticOutput(entity.id, {
    entities: filtered,
    relationships: filteredRelationships,
  })

  // Mode change handler
  const handleModeChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'filter.mode', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const hasBindings = boundEntityIds.length > 0
  const isQueryMode = mode === 'query'

  return (
    <div className="filter-semantic">
      <div className="filter-semantic__header">
        <FilterIcon className="w-4 h-4" />
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className="filter-semantic__mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">
              <div className="flex items-center gap-2">
                <Link className="w-3 h-3" />
                Manual
              </div>
            </SelectItem>
            <SelectItem value="query">
              <div className="flex items-center gap-2">
                <Search className="w-3 h-3" />
                Query
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isQueryMode ? (
        // Query mode UI
        <div className="filter-semantic__query">
          {queryPredicates.length === 0 ? (
            <div className="filter-semantic__hint">
              Add filter.where.* attrs to query entities
            </div>
          ) : (
            <div className="filter-semantic__predicates">
              {queryPredicates.map(([attr, pred]) => (
                <div key={attr} className="filter-semantic__predicate-item">
                  <span className="filter-semantic__predicate-attr">{attr}</span>
                  <span className="filter-semantic__predicate-op">=</span>
                  <span className="filter-semantic__predicate-value">{pred}</span>
                </div>
              ))}
            </div>
          )}

          <div className="filter-semantic__stats">
            {filtered.length} / {sourceEntities.length} entities
          </div>

          <div className="filter-semantic__list">
            {filtered.slice(0, 10).map(e => (
              <div key={e.id} className="filter-semantic__item">
                <span className="filter-semantic__item-name">
                  {e.attrs.name || 'Unnamed'}
                </span>
                {e.attrs.role && (
                  <span className="filter-semantic__item-role">
                    {e.attrs.role}
                  </span>
                )}
              </div>
            ))}
            {filtered.length > 10 && (
              <div className="filter-semantic__more">
                +{filtered.length - 10} more
              </div>
            )}
          </div>
        </div>
      ) : (
        // Manual mode UI
        <>
          <div className="filter-semantic__manual">
            <span className="filter-semantic__predicate">
              {predicate || '(no filter)'}
            </span>
          </div>

          {!hasBindings ? (
            <div className="filter-semantic__empty">
              No entities bound. Bind entities to filter them.
            </div>
          ) : (
            <>
              <div className="filter-semantic__stats">
                {filtered.length} / {inputEntities.length} entities
              </div>

              <div className="filter-semantic__list">
                {filtered.map(e => (
                  <div key={e.id} className="filter-semantic__item">
                    <span className="filter-semantic__item-name">
                      {e.attrs.name || 'Unnamed'}
                    </span>
                    {e.attrs.role && (
                      <span className="filter-semantic__item-role">
                        {e.attrs.role}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

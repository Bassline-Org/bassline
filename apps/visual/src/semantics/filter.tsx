/**
 * Filter Semantic
 *
 * Filters entities that bind to it based on a predicate.
 * Produces filtered syntax that can be consumed by downstream semantics.
 *
 * Configuration:
 * - filter.predicate: "attr:value" or "attr" (checks for existence)
 *
 * Examples:
 * - "role:service" - entities where role === "service"
 * - "role" - entities that have a role attribute
 * - "name:*api*" - entities where name contains "api" (wildcard)
 */

import { useMemo } from 'react'
import { Filter as FilterIcon } from 'lucide-react'
import type { EntityWithAttrs } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'

interface FilterSemanticProps {
  entity: EntityWithAttrs
}

/**
 * Parse and match a predicate against an entity.
 *
 * Predicate formats:
 * - "attr:value" - exact match
 * - "attr:*value*" - contains (wildcards)
 * - "attr" - attribute exists
 */
function matchPredicate(entity: EntityWithAttrs, predicate: string): boolean {
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

export function FilterSemantic({ entity }: FilterSemanticProps) {
  const predicate = entity.attrs['filter.predicate'] || ''
  const { inputEntities, inputRelationships, boundEntityIds } = useSemanticInput(entity)

  // Apply the filter
  const filtered = useMemo(() => {
    if (!predicate) return inputEntities
    return inputEntities.filter(e => matchPredicate(e, predicate))
  }, [inputEntities, predicate])

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

  const hasBindings = boundEntityIds.length > 0

  return (
    <div className="filter-semantic">
      <div className="filter-semantic__header">
        <FilterIcon className="w-4 h-4" />
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
    </div>
  )
}

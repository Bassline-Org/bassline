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

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Filter as FilterIcon, Search, Link, Plus, X } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useBl } from '../hooks/useBl'

interface FilterSemanticProps {
  entity: EntityWithAttrs
}

// Local input that persists on blur
function LocalInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local)
      }}
      placeholder={placeholder}
      className={className}
    />
  )
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

  // State for new predicate input
  const [newAttr, setNewAttr] = useState('')
  const [newValue, setNewValue] = useState('')

  // Add a new predicate
  const handleAddPredicate = useCallback(async () => {
    if (!newAttr.trim()) return
    await bl.attrs.set(project.id, entity.id, `filter.where.${newAttr.trim()}`, newValue)
    setNewAttr('')
    setNewValue('')
    revalidate()
  }, [bl, project.id, entity.id, newAttr, newValue, revalidate])

  // Update predicate attr name (rename)
  const handleUpdateAttr = useCallback(
    async (oldAttr: string, newAttrName: string) => {
      const oldKey = `filter.where.${oldAttr}`
      const newKey = `filter.where.${newAttrName}`
      const value = entity.attrs[oldKey]
      await bl.attrs.delete(project.id, entity.id, oldKey)
      await bl.attrs.set(project.id, entity.id, newKey, value)
      revalidate()
    },
    [bl, project.id, entity.id, entity.attrs, revalidate]
  )

  // Update predicate value
  const handleUpdateValue = useCallback(
    async (attr: string, newVal: string) => {
      await bl.attrs.set(project.id, entity.id, `filter.where.${attr}`, newVal)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Delete a predicate
  const handleDeletePredicate = useCallback(
    async (attr: string) => {
      await bl.attrs.delete(project.id, entity.id, `filter.where.${attr}`)
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
          {/* Predicate builder */}
          <div className="filter-semantic__predicates">
            {queryPredicates.map(([attr, pred]) => (
              <div key={attr} className="filter-semantic__predicate-row">
                <LocalInput
                  value={attr}
                  onCommit={(v) => handleUpdateAttr(attr, v)}
                  placeholder="attr"
                  className="filter-semantic__predicate-attr-input"
                />
                <span className="filter-semantic__predicate-op">=</span>
                <LocalInput
                  value={pred}
                  onCommit={(v) => handleUpdateValue(attr, v)}
                  placeholder="value"
                  className="filter-semantic__predicate-value-input"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="filter-semantic__delete-btn"
                  onClick={() => handleDeletePredicate(attr)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}

            {/* Add new predicate row */}
            <div className="filter-semantic__predicate-row filter-semantic__add-row">
              <Input
                value={newAttr}
                onChange={(e) => setNewAttr(e.target.value)}
                placeholder="attr"
                className="filter-semantic__predicate-attr-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPredicate()
                }}
              />
              <span className="filter-semantic__predicate-op">=</span>
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="value"
                className="filter-semantic__predicate-value-input"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddPredicate()
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="filter-semantic__add-btn"
                onClick={handleAddPredicate}
                disabled={!newAttr.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

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

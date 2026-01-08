/**
 * Merge Combinator
 *
 * Combines entities from multiple bound sources into one syntax.
 * Deduplicates by entity ID.
 *
 * Configuration: None needed - just accepts multiple binds.
 */

import { useMemo } from 'react'
import type { EntityWithAttrs } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'

interface MergeSemanticProps {
  entity: EntityWithAttrs
}

export function MergeSemantic({ entity }: MergeSemanticProps) {
  const { inputEntities, inputRelationships, boundEntityIds } = useSemanticInput(entity)

  // Deduplicate entities by ID (last one wins)
  const mergedEntities = useMemo(() => {
    const seen = new Map<string, EntityWithAttrs>()
    for (const e of inputEntities) {
      seen.set(e.id, e)
    }
    return Array.from(seen.values())
  }, [inputEntities])

  // Deduplicate relationships by ID
  const mergedRelationships = useMemo(() => {
    const seen = new Map<string, typeof inputRelationships[0]>()
    for (const r of inputRelationships) {
      seen.set(r.id, r)
    }
    return Array.from(seen.values())
  }, [inputRelationships])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    entities: mergedEntities,
    relationships: mergedRelationships,
  })

  const sourceCount = boundEntityIds.length

  return (
    <div className="merge-semantic">
      <div className="merge-semantic__stats">
        <span className="merge-semantic__count">{mergedEntities.length}</span>
        <span className="merge-semantic__label">
          {mergedEntities.length === 1 ? 'entity' : 'entities'}
        </span>
        {sourceCount > 0 && (
          <span className="merge-semantic__sources">
            from {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </span>
        )}
      </div>
      {mergedEntities.length > 0 && (
        <ul className="merge-semantic__list">
          {mergedEntities.slice(0, 10).map((e) => (
            <li key={e.id} className="merge-semantic__item">
              {e.attrs.name || e.id.slice(0, 8)}
            </li>
          ))}
          {mergedEntities.length > 10 && (
            <li className="merge-semantic__more">
              +{mergedEntities.length - 10} more
            </li>
          )}
        </ul>
      )}
      {mergedEntities.length === 0 && (
        <div className="merge-semantic__empty">
          No entities bound. Bind entities or semantics to merge.
        </div>
      )}
    </div>
  )
}

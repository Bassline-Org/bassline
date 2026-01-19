/**
 * Merge Combinator
 *
 * Combines entities from multiple bound sources into one syntax.
 * Deduplicates by entity ID.
 *
 * Configuration: None needed - just accepts multiple binds.
 */

import { useMemo } from 'react'
import type { EntityWithAttrs, DataObject } from '../types'
import { getAttr } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'

interface MergeSemanticProps {
  entity: EntityWithAttrs
}

export function MergeSemantic({ entity }: MergeSemanticProps) {
  const { inputData, inputRelationships, boundEntityIds } = useSemanticInput(entity)

  // Deduplicate data objects by ID (last one wins)
  const mergedData = useMemo((): DataObject[] => {
    const seen = new Map<string, DataObject>()
    for (const data of inputData) {
      const id = typeof data.id === 'string' ? data.id : undefined
      if (id) {
        seen.set(id, data)
      }
    }
    return Array.from(seen.values())
  }, [inputData])

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
    data: mergedData,
    relationships: mergedRelationships,
  })

  const sourceCount = boundEntityIds.length

  return (
    <div className="merge-semantic">
      <div className="merge-semantic__stats">
        <span className="merge-semantic__count">{mergedData.length}</span>
        <span className="merge-semantic__label">
          {mergedData.length === 1 ? 'entity' : 'entities'}
        </span>
        {sourceCount > 0 && (
          <span className="merge-semantic__sources">
            from {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
          </span>
        )}
      </div>
      {mergedData.length > 0 && (
        <ul className="merge-semantic__list">
          {mergedData.slice(0, 10).map((data, i) => {
            const id = typeof data.id === 'string' ? data.id : `_${i}`
            const name = getAttr(data, 'name', id.slice(0, 8))
            return (
              <li key={id} className="merge-semantic__item">
                {name}
              </li>
            )
          })}
          {mergedData.length > 10 && (
            <li className="merge-semantic__more">
              +{mergedData.length - 10} more
            </li>
          )}
        </ul>
      )}
      {mergedData.length === 0 && (
        <div className="merge-semantic__empty">
          No entities bound. Bind entities or semantics to merge.
        </div>
      )}
    </div>
  )
}

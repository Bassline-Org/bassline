/**
 * ObjectBlock
 *
 * A block that renders key-value pairs where each value is a child block.
 * Used for semantic.type = "object".
 *
 * Children are entities with 'contains' relationships and a 'key' attr.
 * The object's content value is computed: { key1: child1.content, key2: child2.content, ... }
 */

import { useCallback, type KeyboardEvent } from 'react'
import type { EntityWithAttrs, AttrValue } from '../../types'
import { useBlockContext, useDocumentContext } from '../../contexts/DocumentContext'
import { getChildEntities, getBlockKey } from '../../lib/blocks'
import { BlockRenderer } from './BlockRenderer'
import { cn } from '@/lib/utils'

export interface ObjectBlockProps {
  entity: EntityWithAttrs
  value?: AttrValue
  onChange?: (value: AttrValue) => void
  blockType?: string
  className?: string
}

export function ObjectBlock({
  entity,
  value: propValue,
  className,
}: ObjectBlockProps) {
  const ctx = useBlockContext(entity.id)
  const doc = useDocumentContext()

  // Get children from document context
  const children = doc
    ? getChildEntities(entity.id, doc.entities, doc.relationships)
    : []

  // If standalone with propValue, render inline object
  const standaloneObject =
    !doc && typeof propValue === 'object' && propValue !== null && !Array.isArray(propValue)
      ? (propValue as Record<string, AttrValue>)
      : null

  // Handle keyboard at object level
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (doc) {
        doc.onKeyDown(e)
      }
    },
    [doc]
  )

  // Standalone mode: render simple inline object
  if (standaloneObject !== null) {
    const entries = Object.entries(standaloneObject)

    return (
      <div
        className={cn(
          'block-input block-input--object space-y-1',
          ctx.isFocused && 'block-input--focused',
          className
        )}
      >
        {entries.length === 0 ? (
          <div className="text-muted-foreground text-sm italic pl-4">
            Empty object
          </div>
        ) : (
          entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 pl-4">
              <span className="text-muted-foreground text-xs font-medium min-w-16">
                {key}:
              </span>
              <span className="text-sm flex-1">{String(value)}</span>
            </div>
          ))
        )}
      </div>
    )
  }

  // Document mode: render child blocks with keys
  return (
    <div
      className={cn(
        'block-input block-input--object space-y-1',
        ctx.isFocused && 'block-input--focused',
        ctx.isSelected && 'block-input--selected',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {children.map((child) => {
        const key = getBlockKey(child) ?? child.id.slice(0, 8)

        return (
          <div key={child.id} className="flex items-start gap-2 pl-2">
            <span className="text-muted-foreground text-xs font-medium min-w-16 pt-2 flex-shrink-0">
              {key}:
            </span>
            <div className="flex-1 min-w-0">
              <BlockRenderer entity={child} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

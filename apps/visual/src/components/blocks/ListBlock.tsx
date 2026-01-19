/**
 * ListBlock
 *
 * A block that renders a list of child blocks.
 * Used for semantic.type = "list".
 *
 * Children are entities with 'contains' relationships, ordered by block.order.
 * The list's content value is computed from children: [child1.content, child2.content, ...]
 */

import { useCallback, type KeyboardEvent } from 'react'
import type { EntityWithAttrs, AttrValue } from '../../types'
import { useBlockContext, useDocumentContext } from '../../contexts/DocumentContext'
import { getChildEntities } from '../../lib/blocks'
import { BlockRenderer } from './BlockRenderer'
import { cn } from '@/lib/utils'

export interface ListBlockProps {
  entity: EntityWithAttrs
  value?: AttrValue
  onChange?: (value: AttrValue) => void
  blockType?: string
  className?: string
}

export function ListBlock({
  entity,
  value: propValue,
  className,
}: ListBlockProps) {
  const ctx = useBlockContext(entity.id)
  const doc = useDocumentContext()

  // Get children from document context or compute from value
  const children = doc
    ? getChildEntities(entity.id, doc.entities, doc.relationships)
    : []

  // If standalone with propValue, render inline items
  const standaloneItems = !doc && Array.isArray(propValue) ? propValue : null

  // Handle keyboard at list level
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Bubble to document
      if (doc) {
        doc.onKeyDown(e)
      }
    },
    [doc]
  )

  // Standalone mode: render simple inline list
  if (standaloneItems !== null) {
    return (
      <div
        className={cn(
          'block-input block-input--list space-y-1',
          ctx.isFocused && 'block-input--focused',
          className
        )}
      >
        {standaloneItems.map((item, index) => (
          <div key={index} className="flex items-center gap-2 pl-4">
            <span className="text-muted-foreground text-xs w-4">{index}.</span>
            <div className="flex-1">
              <span className="text-sm">{String(item)}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Document mode: render child blocks
  return (
    <div
      className={cn(
        'block-input block-input--list space-y-1',
        ctx.isFocused && 'block-input--focused',
        ctx.isSelected && 'block-input--selected',
        className
      )}
      onKeyDown={handleKeyDown}
    >
      {children.map((child, index) => (
        <div key={child.id} className="flex items-start gap-2 pl-2">
          <span className="text-muted-foreground text-xs w-4 pt-2 flex-shrink-0">
            {index}.
          </span>
          <div className="flex-1 min-w-0">
            <BlockRenderer entity={child} />
          </div>
        </div>
      ))}
    </div>
  )
}

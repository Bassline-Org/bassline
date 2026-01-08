/**
 * BooleanBlock
 *
 * A block that renders a checkbox/switch for boolean values.
 * Used for semantic.type = "boolean".
 */

import { useCallback, useRef, useEffect, type KeyboardEvent } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import type { EntityWithAttrs, AttrValue } from '../../types'
import { useBlockContext } from '../../contexts/DocumentContext'
import { cn } from '@/lib/utils'

export interface BooleanBlockProps {
  entity: EntityWithAttrs
  value?: AttrValue
  onChange?: (value: AttrValue) => void
  blockType?: string
  className?: string
}

export function BooleanBlock({
  entity,
  value: propValue,
  onChange: propOnChange,
  className,
}: BooleanBlockProps) {
  const switchRef = useRef<HTMLButtonElement>(null)
  const ctx = useBlockContext(entity.id)

  // Get value from props or entity
  const entityValue = entity.attrs['content']
  const initialValue = propValue ?? entityValue
  const boolValue = Boolean(initialValue)

  // Focus switch when block is focused
  useEffect(() => {
    if (ctx.isFocused && switchRef.current) {
      switchRef.current.focus()
    }
  }, [ctx.isFocused])

  // Handle change
  // Note: boolean is stored as number (0/1) since AttrValue doesn't include boolean
  const handleChange = useCallback(
    (checked: boolean) => {
      const value = checked ? 1 : 0
      if (propOnChange) {
        propOnChange(value)
      } else if (ctx.update) {
        ctx.update(value)
      }
    },
    [propOnChange, ctx]
  )

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      // Enter: insert new text block after
      if (e.key === 'Enter') {
        e.preventDefault()
        if (ctx.insert) {
          ctx.insert('text', entity.id)
        }
        return
      }

      // Space: toggle (handled by Switch naturally)

      // Tab: navigate
      if (e.key === 'Tab') {
        e.preventDefault()
        ctx.onKeyDown(e)
        return
      }

      // Arrow up/down: navigate
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        ctx.focusPrev()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        ctx.focusNext()
        return
      }

      // Backspace: delete block
      if (e.key === 'Backspace' && ctx.deleteBlock) {
        e.preventDefault()
        ctx.deleteBlock()
        return
      }

      // Escape: blur
      if (e.key === 'Escape') {
        e.preventDefault()
        ctx.blur()
        return
      }
    },
    [boolValue, handleChange, ctx, entity.id]
  )

  const label = entity.attrs['name'] ?? entity.attrs['key']
  const labelString = typeof label === 'string' ? label : undefined

  return (
    <div
      className={cn(
        'block-input block-input--boolean flex items-center gap-2',
        ctx.isFocused && 'block-input--focused',
        ctx.isSelected && 'block-input--selected',
        className
      )}
    >
      <Switch
        ref={switchRef}
        checked={boolValue}
        onCheckedChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => ctx.focus()}
      />
      {labelString && (
        <Label className="text-sm text-muted-foreground">{labelString}</Label>
      )}
    </div>
  )
}

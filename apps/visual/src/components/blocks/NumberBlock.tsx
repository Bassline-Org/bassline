/**
 * NumberBlock
 *
 * A block that renders a numeric input.
 * Used for semantic.type = "number".
 */

import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import type { EntityWithAttrs, AttrValue } from '../../types'
import { useBlockContext } from '../../contexts/DocumentContext'
import { attrNumber } from '../../types'
import { cn } from '@/lib/utils'

export interface NumberBlockProps {
  entity: EntityWithAttrs
  value?: AttrValue
  onChange?: (value: AttrValue) => void
  blockType?: string
  className?: string
}

export function NumberBlock({
  entity,
  value: propValue,
  onChange: propOnChange,
  className,
}: NumberBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ctx = useBlockContext(entity.id)

  // Get value from props or entity
  const entityValue = entity.attrs['content']
  const initialValue = propValue ?? entityValue
  const numericValue = attrNumber(initialValue, 0)

  // Local state for editing (as string for input)
  const [localValue, setLocalValue] = useState(String(numericValue))

  // Sync local value when entity changes
  useEffect(() => {
    setLocalValue(String(numericValue))
  }, [numericValue])

  // Focus input when block is focused
  useEffect(() => {
    if (ctx.isFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [ctx.isFocused])

  // Commit changes
  const commit = useCallback(() => {
    const parsed = parseFloat(localValue)
    const finalValue = isNaN(parsed) ? 0 : parsed

    if (finalValue !== numericValue) {
      if (propOnChange) {
        propOnChange(finalValue)
      } else if (ctx.update) {
        ctx.update(finalValue)
      }
    }

    // Normalize display
    setLocalValue(String(finalValue))
  }, [localValue, numericValue, propOnChange, ctx])

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // Enter: insert new text block after (in document mode)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commit()
        if (ctx.insert) {
          ctx.insert('text', entity.id)
        }
        return
      }

      // Backspace on empty: delete block
      if (e.key === 'Backspace' && localValue === '' && ctx.deleteBlock) {
        e.preventDefault()
        ctx.deleteBlock()
        return
      }

      // Tab: navigate
      if (e.key === 'Tab') {
        e.preventDefault()
        commit()
        ctx.onKeyDown(e)
        return
      }

      // Arrow up: focus previous (or increment with modifier)
      if (e.key === 'ArrowUp') {
        if (e.altKey || e.metaKey) {
          // Increment value
          const current = parseFloat(localValue) || 0
          const step = e.shiftKey ? 10 : 1
          setLocalValue(String(current + step))
          return
        }
        e.preventDefault()
        commit()
        ctx.focusPrev()
        return
      }

      // Arrow down: focus next (or decrement with modifier)
      if (e.key === 'ArrowDown') {
        if (e.altKey || e.metaKey) {
          // Decrement value
          const current = parseFloat(localValue) || 0
          const step = e.shiftKey ? 10 : 1
          setLocalValue(String(current - step))
          return
        }
        e.preventDefault()
        commit()
        ctx.focusNext()
        return
      }

      // Escape: blur
      if (e.key === 'Escape') {
        e.preventDefault()
        commit()
        ctx.blur()
        return
      }
    },
    [localValue, commit, ctx, entity.id]
  )

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      onFocus={() => ctx.focus()}
      className={cn(
        'block-input block-input--number h-8 text-sm',
        ctx.isFocused && 'block-input--focused',
        ctx.isSelected && 'block-input--selected',
        className
      )}
      placeholder="0"
    />
  )
}

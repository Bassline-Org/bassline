/**
 * TextBlock
 *
 * A block that renders a text input for string values.
 * Used for semantic.type = "text" and as fallback for unknown types.
 *
 * Features:
 * - Type "/" to open SlashMenu for changing block type
 * - Enter creates new block after
 * - Backspace on empty deletes block
 */

import { useState, useEffect, useCallback, useRef, type KeyboardEvent, type ChangeEvent } from 'react'
import { Input } from '@/components/ui/input'
import type { EntityWithAttrs, AttrValue } from '../../types'
import { useBlockContext } from '../../contexts/DocumentContext'
import { cn } from '@/lib/utils'
import { SlashMenu } from './SlashMenu'
import type { BlockType } from '../../lib/blocks'

export interface TextBlockProps {
  entity: EntityWithAttrs
  value?: AttrValue
  onChange?: (value: AttrValue) => void
  blockType?: string
  className?: string
}

export function TextBlock({
  entity,
  value: propValue,
  onChange: propOnChange,
  className,
}: TextBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const ctx = useBlockContext(entity.id)

  // Get value from props or entity
  const entityValue = entity.attrs['content']
  const initialValue = propValue ?? entityValue ?? ''
  const valueString = typeof initialValue === 'string' ? initialValue : String(initialValue ?? '')

  // Local state for editing
  const [localValue, setLocalValue] = useState(valueString)

  // Slash menu state
  const [slashMenu, setSlashMenu] = useState<{
    open: boolean
    position: { x: number; y: number }
    slashIndex: number
  } | null>(null)

  // Compute filter from value (text after "/")
  const slashFilter = slashMenu
    ? localValue.slice(slashMenu.slashIndex + 1)
    : ''

  // Sync local value when entity changes
  useEffect(() => {
    setLocalValue(valueString)
  }, [valueString])

  // Focus input when block is focused
  useEffect(() => {
    if (ctx.isFocused && inputRef.current) {
      inputRef.current.focus()
    }
  }, [ctx.isFocused])

  // Commit changes
  const commit = useCallback(() => {
    if (localValue !== valueString) {
      if (propOnChange) {
        propOnChange(localValue)
      } else if (ctx.update) {
        ctx.update(localValue)
      }
    }
  }, [localValue, valueString, propOnChange, ctx])

  // Handle input change - detect "/" for slash menu
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const prevValue = localValue

    // Detect if "/" was just typed
    if (newValue.length > prevValue.length) {
      const addedChar = newValue[e.target.selectionStart! - 1]
      if (addedChar === '/') {
        // Open slash menu at cursor position
        const rect = inputRef.current?.getBoundingClientRect()
        if (rect) {
          setSlashMenu({
            open: true,
            position: { x: rect.left, y: rect.bottom + 4 },
            slashIndex: e.target.selectionStart! - 1,
          })
        }
      }
    }

    // Close slash menu if "/" was deleted or cursor moved before it
    if (slashMenu) {
      const slashStillExists = newValue[slashMenu.slashIndex] === '/'
      if (!slashStillExists) {
        setSlashMenu(null)
      }
    }

    setLocalValue(newValue)
  }, [localValue, slashMenu])

  // Handle slash menu selection
  const handleSlashSelect = useCallback((type: BlockType) => {
    // Close menu
    setSlashMenu(null)

    // Clear the "/" and filter text from the value
    if (slashMenu) {
      const cleanValue = localValue.slice(0, slashMenu.slashIndex)
      setLocalValue(cleanValue)

      // Update content first (clear the slash command text)
      if (propOnChange) {
        propOnChange(cleanValue)
      } else if (ctx.update) {
        ctx.update(cleanValue)
      }
    }

    // Change block type
    if (ctx.changeType) {
      ctx.changeType(type)
    }
  }, [slashMenu, localValue, propOnChange, ctx])

  // Close slash menu
  const handleSlashClose = useCallback(() => {
    setSlashMenu(null)
  }, [])

  // Handle keyboard
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      // If slash menu is open, let it handle arrow/enter/escape
      if (slashMenu?.open) {
        if (['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(e.key)) {
          // SlashMenu handles these via window listener
          return
        }
      }

      // Enter: insert new block after (in document mode)
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

      // Tab: navigate (let document handle)
      if (e.key === 'Tab') {
        e.preventDefault()
        commit()
        ctx.onKeyDown(e)
        return
      }

      // Arrow up at start: focus previous
      if (e.key === 'ArrowUp' && inputRef.current?.selectionStart === 0) {
        e.preventDefault()
        commit()
        ctx.focusPrev()
        return
      }

      // Arrow down at end: focus next
      if (
        e.key === 'ArrowDown' &&
        inputRef.current?.selectionStart === localValue.length
      ) {
        e.preventDefault()
        commit()
        ctx.focusNext()
        return
      }

      // Escape: blur (if slash menu not open)
      if (e.key === 'Escape' && !slashMenu?.open) {
        e.preventDefault()
        commit()
        ctx.blur()
        return
      }
    },
    [localValue, commit, ctx, entity.id, slashMenu]
  )

  return (
    <>
      <Input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onFocus={() => ctx.focus()}
        className={cn(
          'block-input block-input--text h-8 text-sm',
          ctx.isFocused && 'block-input--focused',
          ctx.isSelected && 'block-input--selected',
          className
        )}
        placeholder="Type / for commands..."
      />
      {slashMenu && (
        <SlashMenu
          open={slashMenu.open}
          position={slashMenu.position}
          filter={slashFilter}
          onSelect={handleSlashSelect}
          onClose={handleSlashClose}
        />
      )}
    </>
  )
}

/**
 * SlashMenu
 *
 * A popup menu for selecting block types when user types "/".
 * Shows available block types with icons and descriptions.
 * Filters based on user input after the slash.
 *
 * Usage:
 *   <SlashMenu
 *     open={isOpen}
 *     position={{ x: 100, y: 200 }}
 *     filter={filterText}
 *     onSelect={(type) => changeBlockType(type)}
 *     onClose={() => setIsOpen(false)}
 *   />
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  Type,
  Hash,
  ToggleLeft,
  List,
  Braces,
} from 'lucide-react'
import type { BlockType } from '../../lib/blocks'

// =============================================================================
// Types
// =============================================================================

export interface SlashMenuItem {
  type: BlockType
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

export interface SlashMenuProps {
  /** Whether the menu is open */
  open: boolean
  /** Position of the menu (relative to viewport) */
  position: { x: number; y: number }
  /** Filter text (what user typed after /) */
  filter: string
  /** Called when user selects a block type */
  onSelect: (type: BlockType) => void
  /** Called when menu should close */
  onClose: () => void
}

// =============================================================================
// Menu Items - exported for reuse
// =============================================================================

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    type: 'text',
    label: 'Text',
    description: 'Plain text',
    icon: Type,
  },
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric value',
    icon: Hash,
  },
  {
    type: 'boolean',
    label: 'Boolean',
    description: 'True/false toggle',
    icon: ToggleLeft,
  },
  {
    type: 'list',
    label: 'List',
    description: 'Array of items',
    icon: List,
  },
  {
    type: 'object',
    label: 'Object',
    description: 'Key-value pairs',
    icon: Braces,
  },
]

// =============================================================================
// Component
// =============================================================================

export function SlashMenu({
  open,
  position,
  filter,
  onSelect,
  onClose,
}: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter items based on input
  const filteredItems = useMemo(() => {
    if (!filter) return SLASH_MENU_ITEMS
    const lowerFilter = filter.toLowerCase()
    return SLASH_MENU_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerFilter) ||
        item.type.toLowerCase().includes(lowerFilter) ||
        item.description.toLowerCase().includes(lowerFilter)
    )
  }, [filter])

  // Reset selection when filter changes or menu opens
  useEffect(() => {
    setSelectedIndex(0)
  }, [filter, open])

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          e.stopPropagation()
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredItems.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          e.stopPropagation()
          if (filteredItems[selectedIndex]) {
            onSelect(filteredItems[selectedIndex].type)
          }
          break
        case 'Escape':
          e.preventDefault()
          e.stopPropagation()
          onClose()
          break
        case 'Tab':
          // Close on tab
          onClose()
          break
      }
    }

    // Capture phase to intercept before input handlers
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [open, filteredItems, selectedIndex, onSelect, onClose])

  // Close when clicking outside
  useEffect(() => {
    if (!open) return

    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Small delay to avoid closing on the click that might have opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown)
    }, 10)

    return () => {
      clearTimeout(timeoutId)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [open, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (!open || !menuRef.current) return
    const selectedEl = menuRef.current.querySelector('[data-selected="true"]')
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [open, selectedIndex])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
      }}
    >
      <div className="bg-popover border rounded-md shadow-lg py-1 min-w-48 max-h-64 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No matching blocks
          </div>
        ) : (
          filteredItems.map((item, index) => {
            const Icon = item.icon
            const isSelected = index === selectedIndex
            return (
              <button
                key={item.type}
                data-selected={isSelected}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent cursor-pointer',
                  isSelected && 'bg-accent'
                )}
                onClick={() => onSelect(item.type)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

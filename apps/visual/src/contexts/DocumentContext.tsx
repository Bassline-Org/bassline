/**
 * DocumentContext
 *
 * Provides shared state and commands for block-based editing.
 * Used by document and block semantics to coordinate:
 * - Focus management (which block has keyboard input)
 * - Selection (which blocks are selected for operations)
 * - Mutations (insert, delete, update blocks)
 * - Keyboard handling (bubble unhandled events to document level)
 *
 * Blocks access this context to:
 * - Know if they're focused/selected
 * - Trigger navigation (focus next/prev)
 * - Perform mutations (insert sibling, delete self)
 * - Bubble keyboard events
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type KeyboardEvent,
} from 'react'
import type { EntityWithAttrs, AttrValue, Relationship } from '../types'
import { getChildEntities } from '../lib/blocks'

// =============================================================================
// Types
// =============================================================================

/** Selection state */
export type Selection =
  | { type: 'none' }
  | { type: 'caret'; blockId: string; offset?: number }
  | { type: 'blocks'; blockIds: string[] }

/** Document context value */
export interface DocumentContextValue {
  // Identity
  documentId: string

  // State (ephemeral)
  focusedBlockId: string | null
  selection: Selection

  // Data (from loader, passed in)
  entities: EntityWithAttrs[]
  relationships: Relationship[]

  // Queries
  getBlock: (id: string) => EntityWithAttrs | undefined
  getChildren: (parentId: string) => EntityWithAttrs[]

  // Navigation (ephemeral state changes)
  focus: (blockId: string) => void
  blur: () => void
  focusNext: () => void
  focusPrev: () => void
  select: (selection: Selection) => void

  // Mutations (persist to entities via callbacks)
  insert: (type: string, afterId?: string, parentId?: string) => Promise<string>
  deleteBlock: (blockId: string) => Promise<void>
  update: (blockId: string, content: AttrValue) => Promise<void>
  updateAttr: (blockId: string, key: string, value: AttrValue) => Promise<void>
  changeType: (blockId: string, newType: string) => Promise<void>

  // Keyboard handling
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

/** Props for DocumentProvider */
export interface DocumentProviderProps {
  documentId: string
  entities: EntityWithAttrs[]
  relationships: Relationship[]
  children: ReactNode

  // Mutation callbacks (provided by parent semantic)
  onInsert: (type: string, afterId?: string, parentId?: string) => Promise<string>
  onDelete: (blockId: string) => Promise<void>
  onUpdate: (blockId: string, content: AttrValue) => Promise<void>
  onUpdateAttr: (blockId: string, key: string, value: AttrValue) => Promise<void>
  onChangeType: (blockId: string, newType: string) => Promise<void>
}

// =============================================================================
// Context
// =============================================================================

const DocumentContext = createContext<DocumentContextValue | null>(null)

// =============================================================================
// Provider
// =============================================================================

export function DocumentProvider({
  documentId,
  entities,
  relationships,
  children,
  onInsert,
  onDelete,
  onUpdate,
  onUpdateAttr,
  onChangeType,
}: DocumentProviderProps) {
  // Ephemeral state
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>({ type: 'none' })

  // Queries
  const getBlock = useCallback(
    (id: string) => entities.find((e) => e.id === id),
    [entities]
  )

  const getChildren = useCallback(
    (parentId: string) => getChildEntities(parentId, entities, relationships),
    [entities, relationships]
  )

  // Get all blocks in document order (for navigation)
  const allBlocksOrdered = useMemo(() => {
    // Start with direct children of document
    const result: EntityWithAttrs[] = []

    const addBlockAndChildren = (parentId: string) => {
      const children = getChildren(parentId)
      for (const child of children) {
        result.push(child)
        // Recursively add nested children
        addBlockAndChildren(child.id)
      }
    }

    addBlockAndChildren(documentId)
    return result
  }, [documentId, getChildren])

  // Navigation
  const focus = useCallback((blockId: string) => {
    setFocusedBlockId(blockId)
    setSelection({ type: 'caret', blockId })
  }, [])

  const blur = useCallback(() => {
    setFocusedBlockId(null)
    setSelection({ type: 'none' })
  }, [])

  const focusNext = useCallback(() => {
    if (!focusedBlockId) {
      // Focus first block
      if (allBlocksOrdered.length > 0) {
        focus(allBlocksOrdered[0].id)
      }
      return
    }

    const currentIndex = allBlocksOrdered.findIndex((b) => b.id === focusedBlockId)
    if (currentIndex < allBlocksOrdered.length - 1) {
      focus(allBlocksOrdered[currentIndex + 1].id)
    }
  }, [focusedBlockId, allBlocksOrdered, focus])

  const focusPrev = useCallback(() => {
    if (!focusedBlockId) return

    const currentIndex = allBlocksOrdered.findIndex((b) => b.id === focusedBlockId)
    if (currentIndex > 0) {
      focus(allBlocksOrdered[currentIndex - 1].id)
    }
  }, [focusedBlockId, allBlocksOrdered, focus])

  const select = useCallback((newSelection: Selection) => {
    setSelection(newSelection)
    if (newSelection.type === 'caret') {
      setFocusedBlockId(newSelection.blockId)
    } else if (newSelection.type === 'blocks' && newSelection.blockIds.length > 0) {
      setFocusedBlockId(newSelection.blockIds[0])
    }
  }, [])

  // Mutations (delegate to callbacks)
  const insert = useCallback(
    async (type: string, afterId?: string, parentId?: string) => {
      const newId = await onInsert(type, afterId, parentId)
      // Focus the new block
      focus(newId)
      return newId
    },
    [onInsert, focus]
  )

  const deleteBlock = useCallback(
    async (blockId: string) => {
      // Find what to focus after deletion
      const currentIndex = allBlocksOrdered.findIndex((b) => b.id === blockId)
      const nextFocus =
        currentIndex > 0
          ? allBlocksOrdered[currentIndex - 1].id
          : allBlocksOrdered.length > 1
            ? allBlocksOrdered[1].id
            : null

      await onDelete(blockId)

      // Focus previous/next block
      if (nextFocus) {
        focus(nextFocus)
      } else {
        blur()
      }
    },
    [onDelete, allBlocksOrdered, focus, blur]
  )

  const update = useCallback(
    async (blockId: string, content: AttrValue) => {
      await onUpdate(blockId, content)
    },
    [onUpdate]
  )

  const updateAttr = useCallback(
    async (blockId: string, key: string, value: AttrValue) => {
      await onUpdateAttr(blockId, key, value)
    },
    [onUpdateAttr]
  )

  const changeType = useCallback(
    async (blockId: string, newType: string) => {
      await onChangeType(blockId, newType)
    },
    [onChangeType]
  )

  // Keyboard handling (document level)
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      // Tab: navigate between blocks
      if (e.key === 'Tab') {
        e.preventDefault()
        if (e.shiftKey) {
          focusPrev()
        } else {
          focusNext()
        }
        return
      }

      // Arrow keys: navigate (when not in editable content)
      if (e.key === 'ArrowUp' && !e.shiftKey) {
        // Only handle if at beginning of block or non-text block
        focusPrev()
        return
      }

      if (e.key === 'ArrowDown' && !e.shiftKey) {
        // Only handle if at end of block or non-text block
        focusNext()
        return
      }

      // Escape: blur
      if (e.key === 'Escape') {
        blur()
        return
      }
    },
    [focusNext, focusPrev, blur]
  )

  // Context value
  const value = useMemo<DocumentContextValue>(
    () => ({
      documentId,
      focusedBlockId,
      selection,
      entities,
      relationships,
      getBlock,
      getChildren,
      focus,
      blur,
      focusNext,
      focusPrev,
      select,
      insert,
      deleteBlock,
      update,
      updateAttr,
      changeType,
      onKeyDown,
    }),
    [
      documentId,
      focusedBlockId,
      selection,
      entities,
      relationships,
      getBlock,
      getChildren,
      focus,
      blur,
      focusNext,
      focusPrev,
      select,
      insert,
      deleteBlock,
      update,
      updateAttr,
      changeType,
      onKeyDown,
    ]
  )

  return (
    <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access document context.
 * Returns null if not inside a DocumentProvider (standalone mode).
 */
export function useDocumentContext(): DocumentContextValue | null {
  return useContext(DocumentContext)
}

/**
 * Access document context, throwing if not available.
 * Use this when you know you're inside a DocumentProvider.
 */
export function useRequiredDocumentContext(): DocumentContextValue {
  const context = useContext(DocumentContext)
  if (!context) {
    throw new Error('useRequiredDocumentContext must be used within DocumentProvider')
  }
  return context
}

// =============================================================================
// Block-level hook
// =============================================================================

/**
 * Hook for individual blocks to access document context with block-specific helpers.
 * Returns a consistent interface whether in a document or standalone.
 */
export function useBlockContext(blockId: string) {
  const doc = useDocumentContext()

  // Derived state
  const isFocused = doc?.focusedBlockId === blockId
  const isSelected =
    doc?.selection.type === 'blocks' && doc.selection.blockIds.includes(blockId)

  // If standalone (no document context), provide minimal interface
  if (!doc) {
    return {
      isFocused: true, // Always focused when standalone
      isSelected: false,
      inDocument: false as const,

      // No-op navigation
      focus: () => {},
      blur: () => {},
      focusNext: () => {},
      focusPrev: () => {},

      // Mutations not available in standalone
      // (parent component handles via onChange prop)
      insert: null,
      deleteBlock: null,
      update: null,
      changeType: null,

      // Keyboard - no bubbling
      onKeyDown: () => {},
    }
  }

  return {
    isFocused,
    isSelected,
    inDocument: true as const,

    // Navigation
    focus: () => doc.focus(blockId),
    blur: doc.blur,
    focusNext: doc.focusNext,
    focusPrev: doc.focusPrev,

    // Mutations
    insert: doc.insert,
    deleteBlock: () => doc.deleteBlock(blockId),
    update: (content: AttrValue) => doc.update(blockId, content),
    changeType: (newType: string) => doc.changeType(blockId, newType),

    // Keyboard bubbling
    onKeyDown: doc.onKeyDown,
  }
}

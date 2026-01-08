/**
 * useBl Hook - React integration for Bassline resources
 *
 * Provides:
 * - Access to bl client
 * - Undo/redo with keyboard shortcuts
 * - Automatic revalidation after mutations
 */

import { useCallback, useEffect, useState } from 'react'
import { useRevalidator } from 'react-router'
import { bl, type HistoryState } from '../lib/bl'

export interface UseBlReturn {
  /** The typed bl client */
  bl: typeof bl

  /** Trigger undo */
  undo: () => Promise<void>

  /** Trigger redo */
  redo: () => Promise<void>

  /** Whether undo is available */
  canUndo: boolean

  /** Whether redo is available */
  canRedo: boolean

  /** Revalidate after a mutation */
  revalidate: () => void

  /** Refresh history state */
  refreshHistory: () => Promise<void>
}

export function useBl(): UseBlReturn {
  const revalidator = useRevalidator()
  const [historyState, setHistoryState] = useState<HistoryState>({
    canUndo: false,
    canRedo: false,
    undoCount: 0,
    redoCount: 0,
  })

  const refreshHistory = useCallback(async () => {
    try {
      const state = await bl.history.state()
      setHistoryState(state)
    } catch (e) {
      // Ignore errors during history refresh
    }
  }, [])

  const revalidate = useCallback(() => {
    revalidator.revalidate()
    refreshHistory()
  }, [revalidator, refreshHistory])

  const undo = useCallback(async () => {
    await bl.history.undo()
    revalidator.revalidate()
    await refreshHistory()
  }, [revalidator, refreshHistory])

  const redo = useCallback(async () => {
    await bl.history.redo()
    revalidator.revalidate()
    await refreshHistory()
  }, [revalidator, refreshHistory])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }

      // Also support Cmd/Ctrl+Y for redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Initial history state fetch
  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  return {
    bl,
    undo,
    redo,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    revalidate,
    refreshHistory,
  }
}

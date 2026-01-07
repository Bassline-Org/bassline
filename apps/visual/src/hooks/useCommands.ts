import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRevalidator } from 'react-router'
import { Command, CommandExecutor } from '../lib/commands'

export interface UseCommandsOptions {
  /** Enable keyboard shortcuts (Cmd/Ctrl+Z for undo, Cmd/Ctrl+Shift+Z for redo) */
  enableKeyboardShortcuts?: boolean
}

export interface UseCommandsReturn {
  /** Execute a command */
  execute: (command: Command) => Promise<void>
  /** Undo the last undoable command */
  undo: () => Promise<void>
  /** Redo the last undone command */
  redo: () => Promise<void>
  /** Whether undo is available */
  canUndo: boolean
  /** Whether redo is available */
  canRedo: boolean
}

/**
 * Hook to manage command execution with undo/redo support
 *
 * All mutations go through execute(), which:
 * 1. Executes the command (calls window.db)
 * 2. Tracks undoable commands in the undo stack
 * 3. Triggers React Router revalidation to refresh loader data
 *
 * @example
 * ```tsx
 * const { execute, undo, redo, canUndo, canRedo } = useCommands()
 *
 * // Execute a command
 * await execute(new SetAttrCommand(entityId, 'name', 'New Name'))
 *
 * // Undo/redo
 * if (canUndo) await undo()
 * if (canRedo) await redo()
 * ```
 */
export function useCommands(options: UseCommandsOptions = {}): UseCommandsReturn {
  const { enableKeyboardShortcuts = true } = options
  const revalidator = useRevalidator()

  // Track undo/redo state for re-renders
  const [undoRedoState, setUndoRedoState] = useState({ canUndo: false, canRedo: false })

  // Create stable executor instance
  const executorRef = useRef<CommandExecutor | null>(null)

  // Initialize executor with revalidation callback
  const executor = useMemo(() => {
    if (!executorRef.current) {
      executorRef.current = new CommandExecutor(() => {
        // Trigger revalidation after command execution
        revalidator.revalidate()
        // Update state for UI
        setUndoRedoState({
          canUndo: executorRef.current?.canUndo ?? false,
          canRedo: executorRef.current?.canRedo ?? false,
        })
      })
    }
    return executorRef.current
  }, [revalidator])

  const execute = useCallback(
    async (command: Command) => {
      await executor.execute(command)
    },
    [executor]
  )

  const undo = useCallback(async () => {
    await executor.undo()
  }, [executor])

  const redo = useCallback(async () => {
    await executor.redo()
  }, [executor])

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboardShortcuts) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      const isMod = e.metaKey || e.ctrlKey

      // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z = redo
      if (isMod && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }

      // Cmd/Ctrl+Y = redo (Windows convention)
      if (isMod && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardShortcuts, undo, redo])

  return {
    execute,
    undo,
    redo,
    canUndo: undoRedoState.canUndo,
    canRedo: undoRedoState.canRedo,
  }
}

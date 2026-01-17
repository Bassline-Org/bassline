/**
 * useKeybindings Hook
 *
 * Global keybinding handler with Emacs-style key notation.
 * Supports chord sequences (e.g., C-x C-s) with timeout.
 */

import { useEffect, useState, useRef, useCallback } from 'react'
import { getCommandByKey, hasChordStartingWith } from '../lib/CommandRegistry'
import { useToast } from '../components/ToastProvider'

// Timeout for chord sequences (ms)
const CHORD_TIMEOUT = 2000

/**
 * Parse a KeyboardEvent into Emacs-style key notation
 */
export function parseKeyEvent(e: KeyboardEvent): string | null {
  const parts: string[] = []

  // Build modifier prefix
  if (e.ctrlKey) parts.push('C-')
  if (e.altKey) parts.push('M-')
  if (e.metaKey) parts.push('S-')

  let key = e.key

  // Skip if it's just a modifier key
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    return null
  }

  // Handle special keys
  const specialKeys: Record<string, string> = {
    Enter: '<return>',
    Escape: '<escape>',
    Tab: '<tab>',
    ' ': '<space>',
    Backspace: '<backspace>',
    Delete: '<delete>',
    ArrowUp: '<up>',
    ArrowDown: '<down>',
    ArrowLeft: '<left>',
    ArrowRight: '<right>',
  }

  if (specialKeys[key]) {
    key = specialKeys[key]
  } else if (key.length === 1) {
    // For letters, uppercase means shift is pressed
    if (e.shiftKey && key >= 'a' && key <= 'z') {
      key = key.toUpperCase()
    } else if (!e.shiftKey && key >= 'A' && key <= 'Z') {
      key = key.toLowerCase()
    }
  } else if (key.startsWith('F') && key.length <= 3 && /^F\d+$/.test(key)) {
    key = `<f${key.slice(1)}>`
  } else {
    // Unknown key, just lowercase it
    key = key.toLowerCase()
  }

  return parts.join('') + key
}

/**
 * Format a key combo for display
 */
export function formatKeyCombo(combo: string): string {
  return combo
    .replace(/C-/g, 'Ctrl+')
    .replace(/M-/g, 'Alt+')
    .replace(/S-/g, 'Cmd+')
    .replace(/<return>/g, 'Enter')
    .replace(/<escape>/g, 'Esc')
    .replace(/<space>/g, 'Space')
    .replace(/<tab>/g, 'Tab')
    .replace(/<backspace>/g, 'Backspace')
    .replace(/<delete>/g, 'Delete')
    .replace(/<up>/g, '\u2191')
    .replace(/<down>/g, '\u2193')
    .replace(/<left>/g, '\u2190')
    .replace(/<right>/g, '\u2192')
    .replace(/<f(\d+)>/g, 'F$1')
}

interface UseKeybindingsOptions {
  /** Function to run a command by name */
  runCommand: (name: string) => Promise<{ success: boolean; error?: string }>
  /** Whether keybindings are enabled */
  enabled?: boolean
  /** Special handlers for built-in actions */
  onCommandPalette?: () => void
}

interface UseKeybindingsResult {
  /** Currently pending chord sequence, if any */
  pendingChord: string | null
}

export function useKeybindings({
  runCommand,
  enabled = true,
  onCommandPalette,
}: UseKeybindingsOptions): UseKeybindingsResult {
  const [pendingChord, setPendingChord] = useState<string | null>(null)
  const chordTimeoutRef = useRef<number | undefined>(undefined)
  const { showToast } = useToast()

  // Clear pending chord
  const clearChord = useCallback(() => {
    if (chordTimeoutRef.current) {
      clearTimeout(chordTimeoutRef.current)
      chordTimeoutRef.current = undefined
    }
    setPendingChord(null)
  }, [])

  useEffect(() => {
    if (!enabled) return

    async function handleKeyDown(e: KeyboardEvent) {
      // Ignore if in input/textarea (unless it's a command key combo)
      const target = e.target as HTMLElement
      if (
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) &&
        !e.ctrlKey && !e.metaKey && !e.altKey
      ) {
        return
      }

      const keyCombo = parseKeyEvent(e)
      if (!keyCombo) return

      // Build full key with pending chord
      const fullKey = pendingChord ? `${pendingChord} ${keyCombo}` : keyCombo

      // Check for built-in command palette (CS-p or Cmd+Shift+P)
      if (fullKey === 'S-P' || fullKey === 'CS-p') {
        e.preventDefault()
        e.stopPropagation()
        clearChord()
        onCommandPalette?.()
        return
      }

      try {
        // Look up command for this key
        const command = await getCommandByKey(fullKey)

        if (command) {
          e.preventDefault()
          e.stopPropagation()
          clearChord()

          const result = await runCommand(command.name)
          if (!result.success && result.error) {
            showToast({
              type: 'error',
              title: `Command failed: ${command.name}`,
              message: result.error,
            })
          }
          return
        }

        // Check if this could be the start of a chord
        const couldBeChord = await hasChordStartingWith(fullKey)
        if (couldBeChord) {
          e.preventDefault()
          e.stopPropagation()
          setPendingChord(fullKey)

          // Show what we're waiting for
          showToast({
            type: 'info',
            title: `${formatKeyCombo(fullKey)}-`,
            duration: CHORD_TIMEOUT,
          })

          // Set timeout to clear chord
          if (chordTimeoutRef.current) {
            clearTimeout(chordTimeoutRef.current)
          }
          chordTimeoutRef.current = window.setTimeout(() => {
            setPendingChord(null)
          }, CHORD_TIMEOUT)
          return
        }

        // No match - if we had a pending chord, show undefined
        if (pendingChord) {
          e.preventDefault()
          e.stopPropagation()
          showToast({
            type: 'warning',
            title: `${formatKeyCombo(fullKey)} is undefined`,
            duration: 1500,
          })
          clearChord()
        }
      } catch (err) {
        console.error('Keybinding handler error:', err)
        // Don't throw - keep UI responsive
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [enabled, pendingChord, runCommand, showToast, clearChord, onCommandPalette])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (chordTimeoutRef.current) {
        clearTimeout(chordTimeoutRef.current)
      }
    }
  }, [])

  return { pendingChord }
}

import { createSignal, createEffect, For, Show, onCleanup } from 'solid-js'
import type { StructureCommand } from '../core/types'

export interface CommandPaletteProps {
  /** Whether the palette is visible */
  isVisible: boolean
  /** Current filter query */
  query: string
  /** Available commands (already filtered) */
  commands: StructureCommand[]
  /** Currently selected index */
  selectedIndex?: number
  /** Callback when a command is selected */
  onSelect: (command: StructureCommand) => void
  /** Callback when palette should close */
  onClose: () => void
  /** Position anchor element (editor) */
  anchorRef?: HTMLElement
}

/**
 * Visual command palette overlay
 * Shows filtered commands and allows selection via mouse or keyboard
 */
export function CommandPalette(props: CommandPaletteProps) {
  const [selectedIdx, setSelectedIdx] = createSignal(0)

  // Reset selection when commands change
  createEffect(() => {
    props.commands // trigger on change
    setSelectedIdx(0)
  })

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.isVisible) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIdx((i) => Math.min(i + 1, props.commands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIdx((i) => Math.max(i - 1, 0))
        break
      case 'Tab':
        e.preventDefault()
        if (e.shiftKey) {
          setSelectedIdx((i) => Math.max(i - 1, 0))
        } else {
          setSelectedIdx((i) => Math.min(i + 1, props.commands.length - 1))
        }
        break
      case 'Escape':
        e.preventDefault()
        props.onClose()
        break
    }
  }

  // Add global keyboard listener when visible
  createEffect(() => {
    if (props.isVisible) {
      document.addEventListener('keydown', handleKeyDown)
      onCleanup(() => document.removeEventListener('keydown', handleKeyDown))
    }
  })

  return (
    <Show when={props.isVisible && props.commands.length > 0}>
      <div class="command-palette">
        <div class="command-palette__header">
          <span class="command-palette__prefix">/</span>
          <span class="command-palette__query">{props.query}</span>
        </div>
        <div class="command-palette__list">
          <For each={props.commands}>
            {(cmd, idx) => (
              <div
                class={`command-palette__item ${idx() === selectedIdx() ? 'command-palette__item--selected' : ''}`}
                onClick={() => props.onSelect(cmd)}
                onMouseEnter={() => setSelectedIdx(idx())}
              >
                <span class="command-palette__item-name">/{cmd.name}</span>
                <span class="command-palette__item-desc">{cmd.description}</span>
              </div>
            )}
          </For>
        </div>
        <div class="command-palette__hint">
          <kbd>↑↓</kbd> navigate <kbd>Enter</kbd> select <kbd>Esc</kbd> close
        </div>
      </div>
    </Show>
  )
}

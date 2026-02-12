/**
 * CommandPalette
 *
 * A fuzzy-searchable command palette that lists all registered commands.
 * Triggered by Cmd+Shift+P (CS-p in Emacs notation).
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Search, Command as CommandIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCommands, type Command } from './BorthProvider'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onRunCommand: (name: string) => Promise<void>
}

// Simple fuzzy match - checks if query chars appear in order
function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  if (q.length === 0) return { match: true, score: 0 }

  let qi = 0
  let ti = 0
  let score = 0
  let lastMatchIndex = -1

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      // Bonus for consecutive matches
      if (lastMatchIndex === ti - 1) score += 2
      // Bonus for matching at word boundaries
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 3

      lastMatchIndex = ti
      qi++
      score++
    }
    ti++
  }

  return { match: qi === q.length, score }
}

export function CommandPalette({ open, onClose, onRunCommand }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [commands, setCommands] = useState<Command[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load commands when opened
  useEffect(() => {
    if (open) {
      getCommands().then(setCommands)
      setQuery('')
      setSelectedIndex(0)
      // Focus input after a short delay to allow animation
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Filter and sort commands by fuzzy match
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return commands

    return commands
      .map(cmd => {
        const nameMatch = fuzzyMatch(query, cmd.name)
        const docMatch = cmd.doc ? fuzzyMatch(query, cmd.doc) : { match: false, score: 0 }
        return {
          ...cmd,
          score: Math.max(nameMatch.score * 2, docMatch.score), // Weight name matches higher
          match: nameMatch.match || docMatch.match,
        }
      })
      .filter(cmd => cmd.match)
      .sort((a, b) => b.score - a.score)
  }, [commands, query])

  // Keep selection in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1))
    }
  }, [filteredCommands.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement | undefined
    selectedElement?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const runSelected = useCallback(async () => {
    const command = filteredCommands[selectedIndex]
    if (command) {
      onClose()
      await onRunCommand(command.name)
    }
  }, [filteredCommands, selectedIndex, onClose, onRunCommand])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(i => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          runSelected()
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [filteredCommands.length, runSelected, onClose]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg bg-popover border border-border rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto"
          role="listbox"
        >
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              {commands.length === 0 ? 'No commands registered' : 'No matching commands'}
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <CommandItem
                key={cmd.name}
                command={cmd}
                selected={index === selectedIndex}
                onSelect={() => {
                  setSelectedIndex(index)
                  runSelected()
                }}
                onHover={() => setSelectedIndex(index)}
              />
            ))
          )}
        </div>

        {/* Footer with keybinding hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/50 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono text-[10px]">
              Enter
            </kbd>
            <span>to run</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono text-[10px]">
              Esc
            </kbd>
            <span>to close</span>
          </span>
        </div>
      </div>
    </div>
  )
}

interface CommandItemProps {
  command: Command
  selected: boolean
  onSelect: () => void
  onHover: () => void
}

function CommandItem({ command, selected, onSelect, onHover }: CommandItemProps) {
  return (
    <div
      role="option"
      aria-selected={selected}
      className={cn(
        'flex items-center gap-3 px-4 py-2 cursor-pointer',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <CommandIcon className="h-4 w-4 text-muted-foreground shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{command.name}</div>
        {command.doc && (
          <div className="text-xs text-muted-foreground truncate">{command.doc}</div>
        )}
      </div>

      {command.key && (
        <KeybindingBadge keybinding={command.key} />
      )}
    </div>
  )
}

function KeybindingBadge({ keybinding }: { keybinding: string }) {
  // Format the keybinding for display
  const formatted = keybinding
    .replace(/C-/g, 'Ctrl+')
    .replace(/M-/g, 'Alt+')
    .replace(/S-/g, 'Cmd+')
    .replace(/<return>/g, 'Enter')
    .replace(/<escape>/g, 'Esc')
    .replace(/<space>/g, 'Space')
    .replace(/<tab>/g, 'Tab')
    .replace(/<backspace>/g, 'Backspace')
    .replace(/<delete>/g, 'Delete')
    .replace(/<up>/g, 'Up')
    .replace(/<down>/g, 'Down')
    .replace(/<left>/g, 'Left')
    .replace(/<right>/g, 'Right')
    .replace(/<f(\d+)>/g, 'F$1')

  return (
    <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono text-muted-foreground shrink-0">
      {formatted}
    </kbd>
  )
}

import { useEffect, useRef } from 'react'
import { Sheet } from '@bassline/sheet'
import type { Registry } from '@bassline/sheet'

export interface ContextMenuState {
  x: number
  y: number
  row: number
  col: number
  range?: { r0: number; c0: number; r1: number; c1: number }
}

interface CellContextMenuProps {
  menu: ContextMenuState
  sheet: Sheet
  commands: Registry
  onClose: () => void
  onError?: (msg: string) => void
  onStartLink?: (row: number, col: number) => void
}

export function CellContextMenu({ menu, sheet, commands, onClose, onError, onStartLink }: CellContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', keyHandler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [onClose])

  const { row, col, range } = menu
  const vid = sheet.ref([row, col])
  const hasRange = !!range
  const commandNames = commands.list()

  const runExecAs = (name: string) => {
    try {
      if (range) {
        commands.execAs(name, range.r0, range.c0, range.r1, range.c1)
      } else {
        // Single cell — execAs still works, rank 0 gets one coord
        commands.execAs(name, row, col, row, col)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      onError?.(msg)
    }
    onClose()
  }

  const item = 'px-3 py-1.5 text-xs cursor-pointer hover:bg-accent/20 transition-colors'
  const sep = 'my-1 border-t border-border/50'
  const label = 'px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wider'
  const rankLabel = (r: number | undefined) => (r === 0 ? '·' : r === 1 ? '―' : '▦')

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[200px] bg-card border border-border rounded-md shadow-lg py-1 font-mono"
      style={{ left: menu.x, top: menu.y }}
    >
      {/* Header */}
      <div className={label}>
        {hasRange
          ? `Region [${range!.r0},${range!.c0}]-[${range!.r1},${range!.c1}]`
          : `Cell [${row}, ${col}]${vid ? ` → ${vid}` : ''}`}
      </div>

      {/* Cell actions */}
      {vid && (
        <div
          className={item}
          onClick={() => {
            navigator.clipboard.writeText(String(sheet.resolve(vid) ?? ''))
            onClose()
          }}
        >
          Copy value
        </div>
      )}
      {vid && (
        <div
          className={item}
          onClick={() => {
            navigator.clipboard.writeText(vid)
            onClose()
          }}
        >
          Copy ID <span className="text-[hsl(199,92%,64%)]">{vid}</span>
        </div>
      )}
      {vid && (
        <div
          className={item}
          onClick={() => {
            onStartLink?.(row, col)
            onClose()
          }}
        >
          Link another cell to this…
        </div>
      )}

      <div className={sep} />

      {/* Execute range as typed command (first cell = command name) */}
      {hasRange && (
        <>
          <div
            className={item}
            onClick={() => {
              try {
                commands.exec(range!.r0, range!.c0, range!.r1, range!.c1)
              } catch (err: unknown) {
                onError?.(err instanceof Error ? err.message : String(err))
              }
              onClose()
            }}
          >
            Execute range (first cell = command)
          </div>
          <div className={sep} />
        </>
      )}

      {/* Run as: commands grouped by rank */}
      <div className={label}>Run as command</div>
      {commandNames.map(name => {
        const rank = commands.rankOf(name)
        return (
          <div key={name} className={item} onClick={() => runExecAs(name)}>
            <span className="text-muted-foreground mr-1">{rankLabel(rank)}</span>
            {name}
          </div>
        )
      })}

      <div className={sep} />

      <div
        className={item}
        onClick={() => {
          sheet.undo()
          onClose()
        }}
      >
        Undo
      </div>
      <div
        className={item}
        onClick={() => {
          sheet.redo()
          onClose()
        }}
      >
        Redo
      </div>
    </div>
  )
}

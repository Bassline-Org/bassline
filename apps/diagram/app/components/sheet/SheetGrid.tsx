import { useCallback, useMemo, useState } from 'react'
import DataEditor, {
  type GridCell,
  GridCellKind,
  type GridColumn,
  type GridSelection,
  type EditableGridCell,
  CompactSelection,
  type Item,
  type Rectangle,
  type GridMouseEventArgs,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'
import { Sheet } from '@bassline/sheet'
import type { createRegistry } from '@bassline/sheet'
import { darkTheme } from '~/lib/theme'
import { CellContextMenu, type ContextMenuState } from './CellContextMenu'

const NUM_ROWS = 200
const NUM_COLS = 26

export interface SelectionRange {
  x: number
  y: number
  width: number
  height: number
}

interface SheetGridProps {
  sheet: Sheet
  commands: ReturnType<typeof createRegistry>
  version: number
  onCursorChange?: (row: number, col: number) => void
  onSelectionRangeChange?: (range: SelectionRange | null) => void
  onError?: (message: string) => void
}

export function SheetGrid({
  sheet,
  commands,
  version,
  onCursorChange,
  onSelectionRangeChange,
  onError,
}: SheetGridProps) {
  const [selection, setSelection] = useState<GridSelection>({
    current: undefined,
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [linkSource, setLinkSource] = useState<[number, number] | null>(null)

  // Layout stored in sheet selection "_layout" so it persists with the data
  const layout = (sheet.selection('_layout') ?? {}) as Record<string, unknown>
  const colWidthsFromSheet = (layout.colWidths ?? {}) as Record<string, number>
  const rowHeightsFromSheet = (layout.rowHeights ?? {}) as Record<string, number>

  const columns: GridColumn[] = useMemo(
    () =>
      Array.from({ length: NUM_COLS }, (_, i) => ({
        title: String(i),
        width: (colWidthsFromSheet[String(i)] as number) ?? 100,
        id: String(i),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  )

  const updateLayout = useCallback(
    (patch: Record<string, unknown>) => {
      const current = (sheet.selection('_layout') ?? {}) as Record<string, unknown>
      sheet.select('_layout', { ...current, ...patch } as any)
    },
    [sheet]
  )

  const onColumnResize = useCallback(
    (col: GridColumn, newSize: number) => {
      const current = ((sheet.selection('_layout') ?? {}) as any).colWidths ?? {}
      updateLayout({ colWidths: { ...current, [col.id!]: newSize } })
    },
    [sheet, updateLayout]
  )

  const rowHeight = useCallback(
    (row: number): number => {
      return (rowHeightsFromSheet[String(row)] as number) ?? 34
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version]
  )

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      void version
      const value = sheet.get([row, col])
      if (value == null) {
        return { kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: true }
      }
      return {
        kind: GridCellKind.Text,
        data: String(value),
        displayData: String(value),
        allowOverlay: true,
      }
    },
    [sheet, version]
  )

  // Copy support: return cell data for a selection range
  const getCellsForSelection = useCallback(
    (sel: Rectangle): readonly (readonly GridCell[])[] => {
      const result: GridCell[][] = []
      for (let row = sel.y; row < sel.y + sel.height; row++) {
        const rowCells: GridCell[] = []
        for (let col = sel.x; col < sel.x + sel.width; col++) {
          rowCells.push(getCellContent([col, row]))
        }
        result.push(rowCells)
      }
      return result
    },
    [getCellContent]
  )

  const onCellEdited = useCallback(
    ([col, row]: Item, newValue: EditableGridCell) => {
      if (newValue.kind === GridCellKind.Text) {
        const v = newValue.data.trim()
        if (!v) {
          sheet.clear([row, col])
        } else {
          const n = Number(v)
          sheet.set([row, col], isNaN(n) ? v : n)
        }
      }
    },
    [sheet]
  )

  // Paste support: handle pasted data by writing each cell
  const onPaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      const [startCol, startRow] = target
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const v = values[r][c].trim()
          if (!v) {
            sheet.clear([startRow + r, startCol + c])
          } else {
            const n = Number(v)
            sheet.set([startRow + r, startCol + c], isNaN(n) ? v : n)
          }
        }
      }
      return false // we handled it, don't call onCellEdited per cell
    },
    [sheet]
  )

  const onSelectionChange = useCallback(
    (sel: GridSelection) => {
      setSelection(sel)
      // Close context menu on any selection change
      setContextMenu(null)

      if (sel.current) {
        const [col, row] = sel.current.cell

        // If in link mode, complete the link
        if (linkSource) {
          const sourceVid = sheet.ref(linkSource)
          if (sourceVid) {
            sheet.link([row, col], sourceVid)
          }
          setLinkSource(null)
          return
        }

        onCursorChange?.(row, col)

        const range = sel.current.range
        if (range && (range.width > 1 || range.height > 1)) {
          onSelectionRangeChange?.(range)
        } else {
          onSelectionRangeChange?.(null)
        }
      } else {
        onSelectionRangeChange?.(null)
      }
    },
    [onCursorChange, onSelectionRangeChange, linkSource, sheet]
  )

  const onCellContextMenu = useCallback(
    (cell: Item, event: GridMouseEventArgs) => {
      ;(event as any).preventDefault?.()
      const [col, row] = cell
      const range = selection.current?.range
      const hasRange = range && (range.width > 1 || range.height > 1)

      setContextMenu({
        x: (event as any).bounds?.x ?? (event as any).localEventX ?? 200,
        y: (event as any).bounds?.y ?? (event as any).localEventY ?? 200,
        row,
        col,
        range: hasRange
          ? {
              r0: range!.y,
              c0: range!.x,
              r1: range!.y + range!.height - 1,
              c1: range!.x + range!.width - 1,
            }
          : undefined,
      })
    },
    [selection]
  )

  const onKeyDown = useCallback(
    (e: {
      ctrlKey: boolean
      metaKey: boolean
      shiftKey: boolean
      key: string
      preventDefault: () => void
      stopPropagation: () => void
    }) => {
      // Undo/Redo: Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) sheet.redo()
        else sheet.undo()
        e.preventDefault()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        sheet.redo()
        e.preventDefault()
        return
      }
      // Execute: Ctrl+Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        let r0: number, c0: number, r1: number, c1: number

        const range = selection.current?.range
        if (range && (range.width > 1 || range.height > 1)) {
          // Multi-cell selection — use the range directly
          r0 = range.y
          c0 = range.x
          r1 = range.y + range.height - 1
          c1 = range.x + range.width - 1
        } else if (selection.current) {
          // Single cell — scan row for contiguous non-empty cells
          const [col, row] = selection.current.cell
          let left = col
          while (left > 0 && sheet.get([row, left - 1]) != null) left--
          let right = col
          while (right < NUM_COLS - 1 && sheet.get([row, right + 1]) != null) right++
          // Even a single non-empty cell is a valid command (e.g. "gc")
          if (sheet.get([row, left]) == null) return
          r0 = row
          c0 = left
          r1 = row
          c1 = right
        } else {
          return
        }

        try {
          commands.exec(r0, c0, r1, c1)
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          onError?.(msg)
        }
        e.preventDefault()
        e.stopPropagation()
        return
      }
    },
    [selection, sheet, commands, onError]
  )

  // Highlight regions for named selections
  const highlightRegions = useMemo(() => {
    void version
    const regions: { color: string; range: Rectangle }[] = []
    for (const [name, region] of sheet.selections) {
      if (name.startsWith('_')) continue // skip internal selections like _layout
      if (region?.r && region?.c) {
        regions.push({
          color: 'rgba(79, 195, 247, 0.08)',
          range: {
            x: region.c[0],
            y: region.r[0],
            width: region.c[1] - region.c[0] + 1,
            height: region.r[1] - region.r[0] + 1,
          },
        })
      }
    }
    return regions
  }, [sheet, version])

  return (
    <>
      {linkSource && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-[hsl(199,92%,64%)] text-black text-xs text-center py-1 font-mono">
          Link mode: click a cell to link it to [{linkSource[0]}, {linkSource[1]}]&apos;s value &mdash;
          <button className="ml-2 underline" onClick={() => setLinkSource(null)}>
            Cancel
          </button>
        </div>
      )}
      <DataEditor
        getCellContent={getCellContent}
        getCellsForSelection={getCellsForSelection}
        onCellEdited={onCellEdited}
        onPaste={onPaste}
        columns={columns}
        rows={NUM_ROWS}
        rowHeight={rowHeight}
        rowMarkers="number"
        rowMarkerStartIndex={0}
        gridSelection={selection}
        onGridSelectionChange={onSelectionChange}
        onKeyDown={onKeyDown}
        onCellContextMenu={onCellContextMenu}
        onColumnResize={onColumnResize}
        highlightRegions={highlightRegions}
        theme={darkTheme}
        width="100%"
        height="100%"
        smoothScrollX
        smoothScrollY
      />
      {contextMenu && (
        <CellContextMenu
          menu={contextMenu}
          sheet={sheet}
          commands={commands}
          onClose={() => setContextMenu(null)}
          onError={onError}
          onStartLink={(r, c) => setLinkSource([r, c])}
        />
      )}
    </>
  )
}

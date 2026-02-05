import { useMemo } from 'react'
import { useComponents } from '../context'
import type { ColumnedList } from '../../core/types'
import { inspect, canInspect } from '../../core/inspect'
import styles from './ColumnedListView.module.css'

export interface ColumnedListViewProps<T> {
  item: ColumnedList<T>
  /** Called when a row is clicked and has a send target */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a columned list (table) view with optional drill-down navigation.
 * By default, clicking a row inspects the row item itself.
 * If `send` is provided, it overrides what gets inspected.
 */
export function ColumnedListView<T>({ item, onInspect }: ColumnedListViewProps<T>) {
  const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = useComponents()

  const items = useMemo(() => item.items(), [item])
  const columns = useMemo(() => Object.entries(item.columns), [item.columns])
  const columnNames = columns.map(([k]) => k)

  // Get the inspection target for a row
  const getTarget = (row: T): unknown => (item.send ? item.send(row) : row)

  // Check if a row can be inspected (including primitives)
  const canInspectRow = (row: T): boolean => {
    if (!onInspect) return false
    return canInspect(getTarget(row))
  }

  return (
    <Table className={styles.table}>
      <TableHeader>
        <TableRow className={styles.headerRow}>
          {columnNames.map(name => (
            <TableHead key={name} className={styles.headerCell}>
              {name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((row, i) => {
          const isClickable = canInspectRow(row)
          return (
            <TableRow
              key={i}
              className={`${styles.row} ${isClickable ? styles.clickable : ''}`}
              onClick={() => {
                if (isClickable) {
                  const target = getTarget(row)
                  const viewable = inspect(target)
                  if (viewable) {
                    const label = item.sendLabel?.(row)
                    onInspect!(viewable, label)
                  }
                }
              }}
            >
              {columns.map(([colName, { text, icon }]) => (
                <TableCell key={colName} className={styles.cell}>
                  {icon ? icon(row) : text ? text(row) : null}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

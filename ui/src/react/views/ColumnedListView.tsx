import { useMemo } from 'react'
import { useComponents } from '../context'
import type { ColumnedList } from '../../core/types'
import { isViewable } from '../../core/phlow'
import styles from './ColumnedListView.module.css'

export interface ColumnedListViewProps<T> {
  item: ColumnedList<T>
  /** Called when a row is clicked and has a send target */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a columned list (table) view with optional drill-down navigation
 */
export function ColumnedListView<T>({ item, onInspect }: ColumnedListViewProps<T>) {
  const { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } = useComponents()

  const items = useMemo(() => item.items(), [item])
  const columns = useMemo(() => Object.entries(item.columns), [item.columns])
  const columnNames = columns.map(([k]) => k)
  const canInspect = !!item.send && !!onInspect

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
        {items.map((row, i) => (
          <TableRow
            key={i}
            className={`${styles.row} ${canInspect ? styles.clickable : ''}`}
            onClick={() => {
              if (canInspect) {
                const target = item.send!(row)
                if (target && isViewable(target)) {
                  const label = item.sendLabel?.(row)
                  onInspect(target, label)
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
        ))}
      </TableBody>
    </Table>
  )
}

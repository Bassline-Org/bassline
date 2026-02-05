import { useMemo } from 'react'
import { useComponents } from '../context'
import type { Info } from '../../core/types'
import { inspect, canInspect } from '../../core/inspect'
import styles from './InfoView.module.css'

export interface InfoViewProps {
  item: Info
  /** Called when an entry with a target is clicked */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a key-value info view with optional drill-down on entries.
 * If `target` is provided, it's used for inspection.
 * Otherwise, if `value` is provided, it's used for inspection.
 */
export function InfoView({ item, onInspect }: InfoViewProps) {
  const { Table, TableHeader, TableRow, TableHead } = useComponents()

  const entries = useMemo(() => Object.entries(item.entries), [item.entries])

  return (
    <Table className={styles.table}>
      <TableHeader>
        {entries.map(([key, getValue]) => {
          const { text, value, target } = getValue()
          // target takes precedence over value
          const inspectTarget = target !== undefined ? target : value
          const isClickable = inspectTarget !== undefined && onInspect && canInspect(inspectTarget)

          return (
            <TableRow
              key={key}
              className={`${styles.row} ${isClickable ? styles.clickable : ''}`}
              onClick={() => {
                if (isClickable && inspectTarget !== undefined) {
                  const viewable = inspect(inspectTarget)
                  if (viewable) {
                    onInspect(viewable, key)
                  }
                }
              }}
            >
              <TableHead className={styles.keyCell}>{key}</TableHead>
              <TableHead className={styles.valueCell}>
                <span className={styles.value}>{text}</span>
                {isClickable && <span className={styles.chevron}>›</span>}
              </TableHead>
            </TableRow>
          )
        })}
      </TableHeader>
    </Table>
  )
}

import { useMemo } from 'react'
import { useComponents } from '../context'
import type { Info } from '../../core/types'
import { isViewable } from '../../core/phlow'
import styles from './InfoView.module.css'

export interface InfoViewProps {
  item: Info
  /** Called when an entry with a target is clicked */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a key-value info view with optional drill-down on entries
 */
export function InfoView({ item, onInspect }: InfoViewProps) {
  const { Table, TableHeader, TableRow, TableHead } = useComponents()

  const entries = useMemo(() => Object.entries(item.entries), [item.entries])

  return (
    <Table className={styles.table}>
      <TableHeader>
        {entries.map(([key, getValue]) => {
          const { text, target } = getValue()
          const canInspect = target !== undefined && onInspect && isViewable(target)

          return (
            <TableRow
              key={key}
              className={`${styles.row} ${canInspect ? styles.clickable : ''}`}
              onClick={() => {
                if (canInspect) {
                  onInspect(target, key)
                }
              }}
            >
              <TableHead className={styles.keyCell}>{key}</TableHead>
              <TableHead className={styles.valueCell}>
                <span className={styles.value}>{text}</span>
                {canInspect && <span className={styles.chevron}>›</span>}
              </TableHead>
            </TableRow>
          )
        })}
      </TableHeader>
    </Table>
  )
}

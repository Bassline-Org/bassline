import { useMemo } from 'react'
import { useComponents } from '../context'
import type { PhlowInfoView } from '../../core/views'
import styles from '~/css/views/InfoView.module.css'

export interface InfoViewProps {
  item: PhlowInfoView
  /** Called when an entry with a target is clicked */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a key-value info view with optional drill-down on entries.
 */
export function InfoView({ item, onInspect }: InfoViewProps) {
  const { Table, TableHeader, TableRow, TableHead } = useComponents()

  const entries = useMemo(() => item.entries(), [item])

  return (
    <Table className={styles.table}>
      <TableHeader>
        {entries.map(([key, getValue]) => {
          const { text, value, target } = getValue()
          // target > value > text — always have something to inspect
          const inspectTarget = target !== undefined ? target : value !== undefined ? value : text

          return (
            <TableRow
              key={key}
              className={`${styles.row} ${onInspect ? styles.clickable : ''}`}
              onClick={() => {
                if (onInspect) {
                  onInspect(inspectTarget, key)
                }
              }}
            >
              <TableHead className={styles.keyCell}>{key}</TableHead>
              <TableHead className={styles.valueCell}>
                <span className={styles.value}>{text}</span>
                {onInspect && <span className={styles.chevron}>›</span>}
              </TableHead>
            </TableRow>
          )
        })}
      </TableHeader>
    </Table>
  )
}

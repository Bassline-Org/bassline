import { useMemo } from 'react'
import type { List } from '../../core/types'
import { isViewable } from '../../core/phlow'
import styles from './ListView.module.css'

export interface ListViewProps<T> {
  item: List<T>
  /** Called when an item is clicked and has a send target */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a simple list view with optional drill-down navigation
 */
export function ListView<T>({ item, onInspect }: ListViewProps<T>) {
  const items = useMemo(() => item.items(), [item])
  const canInspect = !!item.send && !!onInspect

  return (
    <ul className={styles.list}>
      {items.map((e, i) => {
        const text = item.text(e)
        const isClickable = canInspect && item.send

        return (
          <li
            key={i}
            className={`${styles.item} ${isClickable ? styles.clickable : ''}`}
            onClick={() => {
              if (isClickable) {
                const target = item.send!(e)
                if (target && isViewable(target)) {
                  onInspect(target, text)
                }
              }
            }}
          >
            <span className={styles.text}>{text}</span>
            {isClickable && <span className={styles.chevron}>›</span>}
          </li>
        )
      })}
    </ul>
  )
}

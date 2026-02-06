import { useMemo } from 'react'
import type { PhlowListView } from '../../core/views'
import { inspect, canInspect } from '../../core/inspect'
import styles from '~/css/views/ListView.module.css'

export interface ListViewProps {
  item: PhlowListView<any, any>
  /** Called when an item is clicked and has a send target */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a simple list view with optional drill-down navigation.
 * By default, clicking an item inspects the item itself.
 * If `send` is provided, it overrides what gets inspected.
 */
export function ListView({ item, onInspect }: ListViewProps) {
  const items = useMemo(() => item.items(), [item])

  // Get the inspection target for an item
  const getTarget = (e: unknown): unknown => (item.hasSend() ? item.sendFor(e) : e)

  // Check if an item can be inspected (including primitives)
  const canInspectItem = (e: unknown): boolean => {
    if (!onInspect) return false
    return canInspect(getTarget(e))
  }

  return (
    <ol className={styles.list} start={0}>
      {items.map((e: any, i: number) => {
        const text = item.textFor(e)
        const isClickable = canInspectItem(e)

        return (
          <li
            key={i}
            className={`${styles.item} ${isClickable ? styles.clickable : ''}`}
            onClick={() => {
              if (isClickable) {
                const target = getTarget(e)
                const viewable = inspect(target)
                if (viewable) {
                  onInspect!(viewable, text)
                }
              }
            }}
          >
            <span className={styles.text}>{text}</span>
            {isClickable && <span className={styles.chevron}>›</span>}
          </li>
        )
      })}
    </ol>
  )
}

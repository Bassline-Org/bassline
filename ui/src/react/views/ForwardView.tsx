import { useMemo } from 'react'
import type { Forward } from '../../core/types'
import { ViewRenderer } from './ViewRenderer'

export interface ForwardViewProps<T> {
  item: Forward<T>
  /** Passed through to the forwarded view */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a forward view by delegating to the target view
 */
export function ForwardView<T>({ item, onInspect }: ForwardViewProps<T>) {
  const targetView = useMemo(() => item.view(), [item])

  if (!targetView || targetView.phlow === 'empty') {
    return <div style={{ color: 'var(--inspector-muted, #888)', fontSize: '0.875rem' }}>No view available</div>
  }

  return <ViewRenderer view={targetView} onInspect={onInspect} />
}

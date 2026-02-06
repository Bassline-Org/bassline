import { useMemo } from 'react'
import type { PhlowForwardView } from '../../core/views'
import { ViewRenderer } from './ViewRenderer'

export interface ForwardViewProps {
  item: PhlowForwardView
  /** Passed through to the forwarded view */
  onInspect?: (target: unknown, label?: string) => void
}

/**
 * Renders a forward view by delegating to the target view
 */
export function ForwardView({ item, onInspect }: ForwardViewProps) {
  const targetView = useMemo(() => item.view(), [item])

  if (!targetView || targetView.isEmpty()) {
    return <div style={{ color: 'var(--inspector-muted, #888)', fontSize: '0.875rem' }}>No view available</div>
  }

  return <ViewRenderer view={targetView} onInspect={onInspect} />
}

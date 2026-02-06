import type { PhlowExplicitView } from '../../core/views'

export interface ExplicitViewProps {
  item: PhlowExplicitView
}

/**
 * Renders an explicit (custom React component) view
 */
export function ExplicitView({ item }: ExplicitViewProps) {
  return <>{item.component()}</>
}

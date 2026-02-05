import type { Explicit } from '../../core/types'

export interface ExplicitViewProps {
  item: Explicit
}

/**
 * Renders an explicit (custom React component) view
 */
export function ExplicitView({ item }: ExplicitViewProps) {
  return <>{item.component()}</>
}

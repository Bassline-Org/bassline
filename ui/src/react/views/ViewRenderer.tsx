import { useComponents } from '../context'
import type { View, Descriptor } from '../../core/types'
import { TextView } from './TextView'
import { ListView } from './ListView'
import { ColumnedListView } from './ColumnedListView'
import { InfoView } from './InfoView'
import { ForwardView } from './ForwardView'
import { ExplicitView } from './ExplicitView'
import { DescriptorView } from './DescriptorView'
import styles from '~/css/views/ViewRenderer.module.css'

export interface ViewRendererProps<T> {
  /** The view to render */
  view: View<T>
  /** Called when navigation is triggered from within a view */
  onInspect?: (target: unknown, label?: string) => void
  /** Whether to wrap in a card (default: true) */
  withCard?: boolean
}

/**
 * Main view dispatcher component.
 * Renders the appropriate view component based on the view type.
 *
 * This is the correct place to switch on view.phlow since views are data models
 * that describe what to render.
 */
export function ViewRenderer<T>({ view, onInspect, withCard = true }: ViewRendererProps<T>) {
  const { Card, CardHeader, CardTitle, CardContent } = useComponents()

  const type = view.phlow

  // Empty view renders nothing
  if (type === 'empty') {
    return null
  }

  // Forward delegates to target's view - renders without extra card wrapper
  if (type === 'forward') {
    return <ForwardView item={view} onInspect={onInspect} />
  }

  // Explicit views can optionally skip card wrapper
  if (type === 'explicit') {
    if (!withCard) {
      return <ExplicitView item={view} />
    }
    return (
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle className={styles.title}>{view.title}</CardTitle>
        </CardHeader>
        <CardContent className={styles.content}>
          <ExplicitView item={view} />
        </CardContent>
      </Card>
    )
  }

  // Render the appropriate view body
  let body = null
  const { title } = view

  if (type === 'textEditor') {
    body = <TextView item={view} />
  } else if (type === 'list') {
    body = <ListView item={view} onInspect={onInspect} />
  } else if (type === 'columnedList') {
    body = <ColumnedListView item={view} onInspect={onInspect} />
  } else if (type === 'descriptor') {
    body = <DescriptorView item={view as Descriptor<any>} />
  } else if (type === 'info') {
    body = <InfoView item={view} onInspect={onInspect} />
  }

  if (!withCard) {
    return body
  }

  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>{title}</CardTitle>
      </CardHeader>
      <CardContent className={styles.content}>{body}</CardContent>
    </Card>
  )
}

// Re-export with old name for backwards compatibility
export { ViewRenderer as PhlowView }
export type { ViewRendererProps as PhlowViewProps }

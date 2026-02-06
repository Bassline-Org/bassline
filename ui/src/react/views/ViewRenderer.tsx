import { useComponents } from '../context'
import type { PhlowView } from '../../core/views'
import type { PhlowDescriptorView } from '../../core/views'
import { TextView } from './TextView'
import { ListView } from './ListView'
import { ColumnedListView } from './ColumnedListView'
import { InfoView } from './InfoView'
import { ForwardView } from './ForwardView'
import { ExplicitView } from './ExplicitView'
import { DescriptorView } from './DescriptorView'
import styles from '~/css/views/ViewRenderer.module.css'

export interface ViewRendererProps {
  /** The view to render */
  view: PhlowView
  /** Called when navigation is triggered from within a view */
  onInspect?: (target: unknown, label?: string) => void
  /** Whether to wrap in a card (default: true) */
  withCard?: boolean
}

/**
 * Main view dispatcher component.
 * Renders the appropriate view component based on the view type.
 */
export function ViewRenderer({ view, onInspect, withCard = true }: ViewRendererProps) {
  const { Card, CardHeader, CardTitle, CardContent } = useComponents()

  const type = view.phlow

  // Forward delegates to target's view - renders without extra card wrapper
  if (type === 'forward') {
    return <ForwardView item={view as any} onInspect={onInspect} />
  }

  // Explicit views can optionally skip card wrapper
  if (type === 'explicit') {
    if (!withCard) {
      return <ExplicitView item={view as any} />
    }
    return (
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle className={styles.title}>{view.title}</CardTitle>
        </CardHeader>
        <CardContent className={styles.content}>
          <ExplicitView item={view as any} />
        </CardContent>
      </Card>
    )
  }

  // Render the appropriate view body
  let body = null
  const { title } = view

  if (type === 'textEditor') {
    body = <TextView item={view as any} />
  } else if (type === 'list') {
    body = <ListView item={view as any} onInspect={onInspect} />
  } else if (type === 'columnedList') {
    body = <ColumnedListView item={view as any} onInspect={onInspect} />
  } else if (type === 'descriptor') {
    body = <DescriptorView item={view as PhlowDescriptorView<any, any>} />
  } else if (type === 'info') {
    body = <InfoView item={view as any} onInspect={onInspect} />
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

import { useComponents } from '../context'
import type { View, Descriptor } from '../../core/types'
import { TextView } from './TextView'
import { ListView } from './ListView'
import { ColumnedListView } from './ColumnedListView'
import { InfoView } from './InfoView'
import { ForwardView } from './ForwardView'
import { ExplicitView } from './ExplicitView'
import { DescriptorView } from './DescriptorView'
import styles from './PhlowView.module.css'

export interface PhlowViewProps<T> {
  item: View<T>
  /** Called when navigation is triggered from within a view */
  onInspect?: (target: unknown, label?: string) => void
  /** Whether to wrap in a card (default: true) */
  withCard?: boolean
}

/**
 * Main view dispatcher component.
 * Renders the appropriate view component based on the view type.
 */
export function PhlowView<T>({ item, onInspect, withCard = true }: PhlowViewProps<T>) {
  const { Card, CardHeader, CardTitle, CardContent } = useComponents()

  const type = item.phlow

  // Empty view renders nothing
  if (type === 'empty') {
    return null
  }

  // Forward delegates to target's view - renders without extra card wrapper
  if (type === 'forward') {
    return <ForwardView item={item} onInspect={onInspect} />
  }

  // Explicit views can optionally skip card wrapper
  if (type === 'explicit') {
    if (!withCard) {
      return <ExplicitView item={item} />
    }
    return (
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle className={styles.title}>{item.title}</CardTitle>
        </CardHeader>
        <CardContent className={styles.content}>
          <ExplicitView item={item} />
        </CardContent>
      </Card>
    )
  }

  // Render the appropriate view body
  let body = null
  const { title } = item

  if (type === 'textEditor') {
    body = <TextView item={item} />
  } else if (type === 'list') {
    body = <ListView item={item} onInspect={onInspect} />
  } else if (type === 'columnedList') {
    body = <ColumnedListView item={item} onInspect={onInspect} />
  } else if (type === 'descriptor') {
    body = <DescriptorView item={item as Descriptor<any>} />
  } else if (type === 'info') {
    body = <InfoView item={item} onInspect={onInspect} />
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

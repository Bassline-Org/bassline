import { useMemo } from 'react'
import { useComponents } from '../context'
import { useViews, useInspectFrom } from '../hooks'
import { PhlowView } from '../views/PhlowView'
import type { InspectorPane as InspectorPaneType } from '../atoms'
import styles from './InspectorPane.module.css'

export interface InspectorPaneProps {
  pane: InspectorPaneType
  paneIndex: number
  isLast: boolean
  isFocused: boolean
  paneWidth: number
  onClose: () => void
  onSelectView: (viewIndex: number) => void
  onFocus: () => void
}

/**
 * Renders a single inspector pane with view tabs and content
 */
export function InspectorPane({
  pane,
  paneIndex,
  isLast: _isLast,
  isFocused,
  paneWidth,
  onClose,
  onSelectView,
  onFocus,
}: InspectorPaneProps) {
  const { Card, CardHeader, CardTitle, CardContent, Button } = useComponents()
  const views = useViews(pane.target)
  const inspectFrom = useInspectFrom(pane.id)

  const selectedView = views[pane.selectedViewIndex] ?? views[0]

  // Get a display title for the target
  const targetTitle = useMemo(() => {
    const t = pane.target as any
    if (t.name && typeof t.name === 'string') return t.name
    if (t.title && typeof t.title === 'string') return t.title
    if (t.$kind && typeof t.$kind === 'string') return t.$kind
    return t.constructor?.name ?? 'Object'
  }, [pane.target])

  return (
    <div className={`${styles.pane} ${isFocused ? styles.focused : ''}`} style={{ width: paneWidth }} onClick={onFocus}>
      <Card className={styles.card}>
        {/* Header with breadcrumb and close button */}
        <CardHeader className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleArea}>
              {pane.breadcrumbLabel && (
                <>
                  <span className={styles.breadcrumb}>{pane.breadcrumbLabel}</span>
                  <span className={styles.chevron}>›</span>
                </>
              )}
              <CardTitle className={styles.title}>{targetTitle}</CardTitle>
            </div>
            {paneIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className={styles.closeButton}
                onClick={e => {
                  e.stopPropagation()
                  onClose()
                }}
              >
                ✕
              </Button>
            )}
          </div>
        </CardHeader>

        {/* View tabs */}
        <div className={styles.tabs}>
          {views.map((view, i) => (
            <Button
              key={i}
              variant={i === pane.selectedViewIndex ? 'secondary' : 'ghost'}
              size="sm"
              className={styles.tab}
              onClick={() => onSelectView(i)}
            >
              {'title' in view ? view.title : 'View'}
            </Button>
          ))}
        </div>

        {/* View content */}
        <CardContent className={styles.content}>
          {selectedView && <PhlowView item={selectedView} onInspect={inspectFrom} withCard={false} />}
        </CardContent>
      </Card>
    </div>
  )
}

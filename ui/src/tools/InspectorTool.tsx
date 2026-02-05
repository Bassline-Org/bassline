import { useState, useMemo } from 'react'
import { useComponents } from '../react/context'
import { ViewRenderer } from '../react/views/ViewRenderer'
import type { ToolProps, View } from '../core/types'
import type { Viewable, ViewProducer } from '../core/phlow'
import { phlowViews, shouldInheritViews } from '../core/phlow'
import { collectFromPrototypeChain } from '../core/collectors'
import styles from '~/css/tools/InspectorTool.module.css'

/**
 * Hook to get views from a target - local to InspectorTool to avoid circular deps
 */
function useLocalViews<T>(target: Viewable<T> | null): View<T>[] {
  return useMemo(() => {
    if (!target) return []

    const allProducers = collectFromPrototypeChain<ViewProducer<T>>(target, phlowViews, shouldInheritViews)
    const views = allProducers
      .map(producer => producer())
      .filter(v => v.phlow !== 'empty')
      .sort((a, b) => {
        const aPriority = 'priority' in a ? a.priority : 100
        const bPriority = 'priority' in b ? b.priority : 100
        return aPriority - bPriority
      })

    return views as View<T>[]
  }, [target])
}

export interface InspectorToolProps<T> extends ToolProps<T> {
  /** Optional: actions from parent (if already computed) */
  actions?: Array<{ phlow: string; label: string; onClick: () => void | Promise<void> }>
}

/**
 * The Inspector tool - the default tool for viewing objects.
 * Renders view tabs, action bar, and the selected view.
 */
export function InspectorTool<T>({ target, onInspect }: InspectorToolProps<T>) {
  const { Button } = useComponents()
  const views = useLocalViews(target as Viewable<T>)
  const [selectedViewIndex, setSelectedViewIndex] = useState(0)

  const selectedView = views[selectedViewIndex] ?? views[0]

  if (views.length === 0) {
    return <div className={styles.empty}>No views available</div>
  }

  return (
    <div className={styles.inspector}>
      {/* View tabs */}
      {views.length > 1 && (
        <div className={styles.tabs}>
          {views.map((view, i) => (
            <Button
              key={i}
              variant={i === selectedViewIndex ? 'secondary' : 'ghost'}
              size="sm"
              className={styles.tab}
              onClick={() => setSelectedViewIndex(i)}
            >
              {'title' in view ? view.title : 'View'}
            </Button>
          ))}
        </div>
      )}

      {/* View content */}
      <div className={styles.content}>
        {selectedView && <ViewRenderer view={selectedView} onInspect={onInspect} withCard={false} />}
      </div>
    </div>
  )
}

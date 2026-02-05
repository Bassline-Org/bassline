import { useRef, useEffect, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { inspectorChainAtom, closePaneAtom, selectViewAtom, focusPaneAtom, navigateFocusAtom } from '../atoms'
import { InspectorPane } from './InspectorPane'
import styles from './InspectorPager.module.css'

export interface InspectorPagerProps {
  /** Width of each pane in pixels */
  paneWidth?: number
  /** Whether to auto-scroll to newly added panes */
  autoScrollToNew?: boolean
  /** Additional CSS class */
  className?: string
  /** Placeholder content when no panes are open */
  emptyMessage?: string
}

/**
 * Miller columns inspector pager.
 * Renders a horizontally scrolling list of inspector panes.
 */
export function InspectorPager({
  paneWidth = 400,
  autoScrollToNew = true,
  className,
  emptyMessage = 'Select an object to inspect',
}: InspectorPagerProps) {
  const chainState = useAtomValue(inspectorChainAtom)
  const closePane = useSetAtom(closePaneAtom)
  const selectView = useSetAtom(selectViewAtom)
  const focusPane = useSetAtom(focusPaneAtom)
  const navigateFocus = useSetAtom(navigateFocusAtom)

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastPaneCountRef = useRef(chainState.panes.length)

  // Auto-scroll to rightmost pane when new pane is added
  useEffect(() => {
    if (autoScrollToNew && chainState.panes.length > lastPaneCountRef.current) {
      scrollContainerRef.current?.scrollTo({
        left: scrollContainerRef.current.scrollWidth,
        behavior: 'smooth',
      })
    }
    lastPaneCountRef.current = chainState.panes.length
  }, [chainState.panes.length, autoScrollToNew])

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        navigateFocus('left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        navigateFocus('right')
      } else if (e.key === 'Escape' && chainState.focusedPaneIndex >= 0) {
        e.preventDefault()
        closePane(chainState.focusedPaneIndex)
      }
    },
    [navigateFocus, closePane, chainState.focusedPaneIndex]
  )

  if (chainState.panes.length === 0) {
    return <div className={`${styles.empty} ${className ?? ''}`}>{emptyMessage}</div>
  }

  return (
    <div
      ref={scrollContainerRef}
      className={`${styles.container} ${className ?? ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {chainState.panes.map((pane, index) => (
        <InspectorPane
          key={pane.id}
          pane={pane}
          paneIndex={index}
          isLast={index === chainState.panes.length - 1}
          isFocused={index === chainState.focusedPaneIndex}
          paneWidth={paneWidth}
          onClose={() => closePane(index)}
          onSelectView={viewIndex => selectView({ paneIndex: index, viewIndex })}
          onFocus={() => focusPane(index)}
        />
      ))}
    </div>
  )
}

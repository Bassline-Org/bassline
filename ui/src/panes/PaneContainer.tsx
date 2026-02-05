import { useRef, useEffect, useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  inspectorChainAtom,
  closePaneAtom,
  focusPaneAtom,
  navigateFocusAtom,
  selectToolAtom,
  toggleMaximizeAtom,
  maximizedPaneIdAtom,
} from '../state/atoms'
import { shouldIgnoreKeyboardEvent, isTextInputElement } from '../core/keyboard'
import { Pane } from './Pane'
import styles from '~/css/panes/PaneContainer.module.css'

export interface PaneContainerProps {
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
 * Miller columns container.
 * Renders a horizontally scrolling list of panes.
 */
export function PaneContainer({
  paneWidth = 400,
  autoScrollToNew = true,
  className,
  emptyMessage = 'Select an object to inspect',
}: PaneContainerProps) {
  const chainState = useAtomValue(inspectorChainAtom)
  const maximizedPaneId = useAtomValue(maximizedPaneIdAtom)
  const closePane = useSetAtom(closePaneAtom)
  const focusPane = useSetAtom(focusPaneAtom)
  const navigateFocus = useSetAtom(navigateFocusAtom)
  const selectTool = useSetAtom(selectToolAtom)
  const toggleMaximize = useSetAtom(toggleMaximizeAtom)

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
      // Don't capture if target has nocapture class or is a text input
      if (shouldIgnoreKeyboardEvent(e) || isTextInputElement(e.target)) {
        return
      }

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
      className={`${styles.container} ${maximizedPaneId ? styles.hasMaximized : ''} ${className ?? ''}`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {chainState.panes.map((pane, index) => {
        const isMaximized = pane.id === maximizedPaneId
        const isHidden = maximizedPaneId !== null && !isMaximized

        if (isHidden) {
          return null
        }

        return (
          <Pane
            key={pane.id}
            pane={pane}
            paneIndex={index}
            isLast={index === chainState.panes.length - 1}
            isFocused={index === chainState.focusedPaneIndex}
            isMaximized={isMaximized}
            paneWidth={paneWidth}
            onClose={() => closePane(index)}
            onSelectTool={toolId => selectTool({ paneIndex: index, toolId })}
            onToggleMaximize={() => toggleMaximize(pane.id)}
            onFocus={() => focusPane(index)}
          />
        )
      })}
    </div>
  )
}

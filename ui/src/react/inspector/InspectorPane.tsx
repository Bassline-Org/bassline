import { useMemo, useState } from 'react'
import { useComponents } from '../context'
import { useViews, useActions, useInspectFrom, useTools } from '../hooks'
import { PhlowView } from '../views/PhlowView'
import { ActionBar } from './ActionBar'
import type { InspectorPane as InspectorPaneType } from '../atoms'
import type { WindowTool } from '../../core/types'
import styles from './InspectorPane.module.css'

export interface InspectorPaneProps {
  pane: InspectorPaneType
  paneIndex: number
  isLast: boolean
  isFocused: boolean
  isMaximized: boolean
  paneWidth: number
  onClose: () => void
  onSelectView: (viewIndex: number) => void
  onSelectTool: (toolId: string) => void
  onToggleMaximize: () => void
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
  isMaximized,
  paneWidth,
  onClose,
  onSelectView,
  onSelectTool,
  onToggleMaximize,
  onFocus,
}: InspectorPaneProps) {
  const { Card, CardHeader, CardTitle, CardContent, Button } = useComponents()
  const views = useViews(pane.target)
  const actions = useActions(pane.target)
  const tools = useTools(pane.target)
  const inspectFrom = useInspectFrom(pane.id)
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false)

  const selectedView = views[pane.selectedViewIndex] ?? views[0]

  // Find the currently selected tool (default to inspector mode if no tools or 'inspector' selected)
  const selectedTool = useMemo(() => {
    if (pane.selectedToolId === 'inspector' || tools.length === 0) {
      return null // Inspector mode (show views)
    }
    return tools.find(t => t.phlow === 'windowTool' && t.title === pane.selectedToolId) as
      | WindowTool<unknown>
      | undefined
  }, [pane.selectedToolId, tools])

  // Should we show the tool dropdown? Only if there are custom tools
  const hasCustomTools = tools.length > 0

  // Get a display title for the target
  const targetTitle = useMemo(() => {
    const t = pane.target as any
    if (t.name && typeof t.name === 'string') return t.name
    if (t.title && typeof t.title === 'string') return t.title
    if (t.$kind && typeof t.$kind === 'string') return t.$kind
    return t.constructor?.name ?? 'Object'
  }, [pane.target])

  return (
    <div
      className={`${styles.pane} ${isFocused ? styles.focused : ''} ${isMaximized ? styles.maximized : ''}`}
      style={{ width: isMaximized ? '100%' : paneWidth }}
      onClick={onFocus}
    >
      <Card className={styles.card}>
        {/* Header with tool selector, title, and buttons */}
        <CardHeader className={styles.header}>
          <div className={styles.headerContent}>
            {/* Tool dropdown (only if there are custom tools) */}
            {hasCustomTools && (
              <div className={styles.toolSelector}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.toolButton}
                  onClick={e => {
                    e.stopPropagation()
                    setToolDropdownOpen(!toolDropdownOpen)
                  }}
                >
                  {selectedTool ? selectedTool.title : 'Inspector'}
                  <span className={styles.dropdownArrow}>▾</span>
                </Button>
                {toolDropdownOpen && (
                  <>
                    {/* Backdrop to close dropdown when clicking outside */}
                    <div
                      className={styles.toolDropdownBackdrop}
                      onClick={e => {
                        e.stopPropagation()
                        setToolDropdownOpen(false)
                      }}
                    />
                    <div className={styles.toolDropdown}>
                      <Button
                        variant={pane.selectedToolId === 'inspector' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={styles.toolOption}
                        onClick={e => {
                          e.stopPropagation()
                          onSelectTool('inspector')
                          setToolDropdownOpen(false)
                        }}
                      >
                        Inspector
                      </Button>
                      {tools.map(tool =>
                        tool.phlow === 'windowTool' ? (
                          <Button
                            key={tool.title}
                            variant={pane.selectedToolId === tool.title ? 'secondary' : 'ghost'}
                            size="sm"
                            className={styles.toolOption}
                            onClick={e => {
                              e.stopPropagation()
                              onSelectTool(tool.title)
                              setToolDropdownOpen(false)
                            }}
                          >
                            {tool.icon && <span className={styles.toolIcon}>{tool.icon}</span>}
                            {tool.title}
                          </Button>
                        ) : null
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={styles.titleArea}>
              {pane.breadcrumbLabel && (
                <>
                  <span className={styles.breadcrumb}>{pane.breadcrumbLabel}</span>
                  <span className={styles.chevron}>›</span>
                </>
              )}
              <CardTitle className={styles.title}>{targetTitle}</CardTitle>
            </div>

            <div className={styles.headerButtons}>
              {/* Maximize/restore button */}
              <Button
                variant="ghost"
                size="icon"
                className={styles.maximizeButton}
                onClick={e => {
                  e.stopPropagation()
                  onToggleMaximize()
                }}
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? '⤓' : '⤢'}
              </Button>

              {/* Close button (not for root pane) */}
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
          </div>
        </CardHeader>

        {/* Content: either tool or inspector */}
        {selectedTool ? (
          // Render the selected tool's component
          <CardContent className={styles.content}>
            <selectedTool.component target={pane.target} onInspect={inspectFrom} />
          </CardContent>
        ) : (
          // Render inspector (view tabs + selected view)
          <>
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

            {/* Action bar */}
            <ActionBar actions={actions} />

            {/* View content */}
            <CardContent className={styles.content}>
              {selectedView && <PhlowView item={selectedView} onInspect={inspectFrom} withCard={false} />}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}

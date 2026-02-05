import { useMemo, useState } from 'react'
import { useComponents } from '../react/context'
import { useTools, useInspectFrom, useActions } from '../hooks'
import { ActionBar } from '../tools/ActionBar'
import type { InspectorPane } from '../state/atoms'
import type { WindowTool } from '../core/types'
import styles from '~/css/panes/Pane.module.css'

export interface PaneProps {
  pane: InspectorPane
  paneIndex: number
  isLast: boolean
  isFocused: boolean
  isMaximized: boolean
  paneWidth: number
  onClose: () => void
  onSelectTool: (toolId: string) => void
  onToggleMaximize: () => void
  onFocus: () => void
}

/**
 * Renders a single pane with tool selector and content.
 * Tools are rendered uniformly - the inspector is just another tool.
 */
export function Pane({
  pane,
  paneIndex,
  isLast: _isLast,
  isFocused,
  isMaximized,
  paneWidth,
  onClose,
  onSelectTool,
  onToggleMaximize,
  onFocus,
}: PaneProps) {
  const { Card, CardHeader, CardTitle, CardContent, Button } = useComponents()
  const tools = useTools(pane.target)
  const actions = useActions(pane.target)
  const inspectFrom = useInspectFrom(pane.id)
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false)

  // Find the currently selected tool (default to first tool which is Inspector)
  const selectedTool = useMemo(() => {
    const found = tools.find(t => t.id === pane.selectedToolId)
    return found ?? tools[0]
  }, [pane.selectedToolId, tools]) as WindowTool<unknown> | undefined

  // Get a display title for the target
  const targetTitle = useMemo(() => {
    const t = pane.target as any
    if (t.name && typeof t.name === 'string') return t.name
    if (t.title && typeof t.title === 'string') return t.title
    if (t.$kind && typeof t.$kind === 'string') return t.$kind
    return t.constructor?.name ?? 'Object'
  }, [pane.target])

  // Should we show the tool dropdown? Only if there are multiple tools
  const hasMultipleTools = tools.length > 1

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
            {/* Tool dropdown (only if there are multiple tools) */}
            {hasMultipleTools && (
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
                  {selectedTool?.title ?? 'Inspector'}
                  <span className={styles.dropdownArrow}>▾</span>
                </Button>
                {toolDropdownOpen && (
                  <>
                    <div
                      className={styles.toolDropdownBackdrop}
                      onClick={e => {
                        e.stopPropagation()
                        setToolDropdownOpen(false)
                      }}
                    />
                    <div className={styles.toolDropdown}>
                      {tools.map(tool => (
                        <Button
                          key={tool.id}
                          variant={pane.selectedToolId === tool.id ? 'secondary' : 'ghost'}
                          size="sm"
                          className={styles.toolOption}
                          onClick={e => {
                            e.stopPropagation()
                            onSelectTool(tool.id)
                            setToolDropdownOpen(false)
                          }}
                        >
                          {tool.icon && <span className={styles.toolIcon}>{tool.icon}</span>}
                          {tool.title}
                        </Button>
                      ))}
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

            {/* Action buttons from target's phlowActions */}
            {actions.length > 0 && <ActionBar actions={actions} />}

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

        {/* Tool content - uniform rendering for all tools */}
        <CardContent className={styles.content}>
          {selectedTool && <selectedTool.component target={pane.target} onInspect={inspectFrom} />}
        </CardContent>
      </Card>
    </div>
  )
}

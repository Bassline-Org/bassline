import { useMemo, useState, useRef, useEffect } from 'react'
import { useComponents } from '../react/context'
import { useViews, useInspectFrom, useActions, useSearches } from '../hooks'
import { ViewRenderer } from '../react/views/ViewRenderer'
import { ActionBar } from './ActionBar'
import type { InspectorPane } from '../state/atoms'
import type { PhlowPanelView } from '../core/views'
import styles from '~/css/panes/Pane.module.css'

export interface PaneProps {
  pane: InspectorPane
  paneIndex: number
  isLast: boolean
  isFocused: boolean
  isMaximized: boolean
  paneWidth: number
  onClose: () => void
  onToggleMaximize: () => void
  onFocus: () => void
}

/**
 * Renders a single pane with views and optional panel selector.
 * Views are partitioned into tab views (rendered as tabs) and panel views
 * (rendered full-pane via a dropdown selector).
 */
export function Pane({
  pane,
  paneIndex,
  isLast: _isLast,
  isFocused,
  isMaximized,
  paneWidth,
  onClose,
  onToggleMaximize,
  onFocus,
}: PaneProps) {
  const { Card, CardHeader, CardTitle, CardContent, Button } = useComponents()
  const allViews = useViews(pane.target)
  const actions = useActions(pane.target)
  const searchSources = useSearches(pane.target)
  const inspectFrom = useInspectFrom(pane.id)
  const [panelDropdownOpen, setPanelDropdownOpen] = useState(false)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const hasSearch = searchSources.length > 0

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  // Partition views into tab views and panel views
  const { tabViews, panelViews } = useMemo(() => {
    const tabs = allViews.filter(v => v.phlow !== 'panel')
    const panels = allViews.filter(v => v.phlow === 'panel') as PhlowPanelView[]
    return { tabViews: tabs, panelViews: panels }
  }, [allViews])

  // Track which mode we're in: 'inspector' (tab group) or a panel view index
  const [selectedMode, setSelectedMode] = useState<'inspector' | number>('inspector')
  const [selectedTabIndex, setSelectedTabIndex] = useState(0)

  const selectedTab = tabViews[selectedTabIndex] ?? tabViews[0]
  const hasPanels = panelViews.length > 0

  // Get a display title for the target
  const targetTitle = useMemo(() => {
    const t = pane.target as any
    if (t.name && typeof t.name === 'string') return t.name
    if (t.title && typeof t.title === 'string') return t.title
    if (t.$kind && typeof t.$kind === 'string') return t.$kind
    return t.constructor?.name ?? 'Object'
  }, [pane.target])

  // Search results
  const hasShowOnEmpty = searchSources.some(s => s.showOnEmpty)
  const searchResults = useMemo(() => {
    if (!searchOpen) return []
    if (!searchQuery && !hasShowOnEmpty) return []
    return searchSources
      .map(source => ({
        source,
        items: source.items(searchQuery),
      }))
      .filter(g => g.items.length > 0)
  }, [searchOpen, searchQuery, searchSources, hasShowOnEmpty])

  // Render content based on selected mode
  const renderContent = () => {
    // Search results mode
    if (searchOpen && selectedMode === 'inspector') {
      if (!searchQuery && !hasShowOnEmpty) {
        return <div className={styles.empty}>Type to search...</div>
      }
      if (searchResults.length === 0) {
        return <div className={styles.empty}>No results</div>
      }
      return (
        <div className={styles.searchResults}>
          {searchResults.map(({ source, items }, gi) => (
            <div key={gi} className={styles.searchGroup}>
              <div className={styles.searchGroupTitle}>{source.title}</div>
              {items.map((item, ii) => (
                <div
                  key={ii}
                  className={`${styles.searchItem} ${styles.searchItemClickable}`}
                  onClick={() => {
                    const target = source.hasSend() ? source.sendFor(item) : item
                    inspectFrom(target, source.textFor(item))
                  }}
                >
                  {source.textFor(item)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )
    }

    if (selectedMode === 'inspector') {
      // Tab view mode (inline InspectorTool logic)
      if (tabViews.length === 0) {
        return <div className={styles.empty}>No views available</div>
      }

      return (
        <div className={styles.inspectorContent}>
          {/* View tabs */}
          {tabViews.length > 1 && (
            <div className={styles.tabs}>
              {tabViews.map((view, i) => (
                <Button
                  key={i}
                  variant={i === selectedTabIndex ? 'secondary' : 'ghost'}
                  size="sm"
                  className={styles.tab}
                  onClick={() => setSelectedTabIndex(i)}
                >
                  {view.title}
                </Button>
              ))}
            </div>
          )}

          {/* View content */}
          <div className={styles.viewContent}>
            {selectedTab && <ViewRenderer view={selectedTab} onInspect={inspectFrom} withCard={false} />}
          </div>
        </div>
      )
    } else {
      // Panel mode
      const panel = panelViews[selectedMode]
      if (!panel) return null
      return <>{panel.component(inspectFrom)}</>
    }
  }

  return (
    <div
      className={`${styles.pane} ${isFocused ? styles.focused : ''} ${isMaximized ? styles.maximized : ''}`}
      style={{ width: isMaximized ? '100%' : paneWidth }}
      onClick={onFocus}
    >
      <Card className={styles.card}>
        {/* Header with panel selector, title, and buttons */}
        <CardHeader className={styles.header}>
          <div className={styles.headerContent}>
            {/* Panel dropdown (only if there are panel views) */}
            {hasPanels && (
              <div className={styles.toolSelector}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.toolButton}
                  onClick={e => {
                    e.stopPropagation()
                    setPanelDropdownOpen(!panelDropdownOpen)
                  }}
                >
                  {selectedMode === 'inspector' ? 'Inspector' : (panelViews[selectedMode]?.title ?? 'Inspector')}
                  <span className={styles.dropdownArrow}>▾</span>
                </Button>
                {panelDropdownOpen && (
                  <>
                    <div
                      className={styles.toolDropdownBackdrop}
                      onClick={e => {
                        e.stopPropagation()
                        setPanelDropdownOpen(false)
                      }}
                    />
                    <div className={styles.toolDropdown}>
                      <Button
                        variant={selectedMode === 'inspector' ? 'secondary' : 'ghost'}
                        size="sm"
                        className={styles.toolOption}
                        onClick={e => {
                          e.stopPropagation()
                          setSelectedMode('inspector')
                          setPanelDropdownOpen(false)
                        }}
                      >
                        Inspector
                      </Button>
                      {panelViews.map((panel, i) => (
                        <Button
                          key={i}
                          variant={selectedMode === i ? 'secondary' : 'ghost'}
                          size="sm"
                          className={styles.toolOption}
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedMode(i)
                            setPanelDropdownOpen(false)
                          }}
                        >
                          {panel.title}
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
              {/* Search button (only in inspector mode when target has search sources) */}
              {hasSearch && selectedMode === 'inspector' && (
                <Button
                  variant={searchOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  className={styles.searchButton}
                  onClick={e => {
                    e.stopPropagation()
                    setSearchOpen(!searchOpen)
                    if (searchOpen) {
                      setSearchQuery('')
                    }
                  }}
                  title="Search"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </Button>
              )}

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

          {/* Search bar (inline below header when open) */}
          {searchOpen && selectedMode === 'inspector' && (
            <div className={styles.searchBar}>
              <input
                ref={searchInputRef}
                type="text"
                className={styles.searchInput}
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false)
                    setSearchQuery('')
                  }
                }}
              />
            </div>
          )}
        </CardHeader>

        {/* Content */}
        <CardContent className={styles.content}>{renderContent()}</CardContent>
      </Card>
    </div>
  )
}

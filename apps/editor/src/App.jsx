import { useState, useEffect, useCallback } from 'react'
import { useResource, useHotkey } from '@bassline/react'
import { ViewResolver, hasPrettyView, virtualViews } from './views/index.jsx'
import AppLayout from './components/AppLayout.jsx'
import Sidebar from './components/Sidebar.jsx'
import Breadcrumbs from './components/Breadcrumbs.jsx'
import ViewToggle from './components/ViewToggle.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import CreateResourceDialog from './components/CreateResourceDialog.jsx'
import ClaudePanel from './components/ClaudePanel.jsx'
import { IconCommand, IconArrowLeft, IconRefresh } from '@tabler/icons-react'

function AddressBar({ value, onChange, onCommandPalette }) {
  const [input, setInput] = useState(value)

  useEffect(() => {
    setInput(value)
  }, [value])

  const handleSubmit = (e) => {
    e.preventDefault()
    onChange(input)
  }

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      onCommandPalette()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="address-bar">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="bl:///local/data"
      />
      <button
        type="button"
        className="address-bar-cmd"
        onClick={onCommandPalette}
        title="Command Palette (Cmd+K)"
      >
        <IconCommand size={14} />
      </button>
    </form>
  )
}

export default function App() {
  const [uri, setUri] = useState('bl:///r/dashboard')
  const [history, setHistory] = useState(['bl:///r/dashboard'])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [viewMode, setViewMode] = useState('pretty')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createType, setCreateType] = useState('cell')
  const [claudePanelOpen, setClaudePanelOpen] = useState(false)
  const { data, loading, error, refetch } = useResource(uri)

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev)
  }, [])

  const navigate = useCallback(
    (newUri) => {
      // Trim history forward if we're not at the end
      const newHistory = [...history.slice(0, historyIndex + 1), newUri]
      setHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
      setUri(newUri)
    },
    [history, historyIndex]
  )

  const goBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setUri(history[newIndex])
    }
  }, [history, historyIndex])

  const goForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setUri(history[newIndex])
    }
  }, [history, historyIndex])

  const openCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true)
  }, [])

  const closeCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false)
  }, [])

  const openCreateDialog = useCallback((type = 'cell') => {
    setCreateType(type)
    setCreateDialogOpen(true)
  }, [])

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false)
  }, [])

  const openClaudePanel = useCallback(() => {
    setClaudePanelOpen(true)
  }, [])

  const closeClaudePanel = useCallback(() => {
    setClaudePanelOpen(false)
  }, [])

  // Keyboard shortcuts
  useHotkey('k', openCommandPalette, { meta: true })
  useHotkey('l', () => document.querySelector('.address-bar input')?.focus(), { meta: true })
  useHotkey('r', refetch, { meta: true })
  useHotkey('[', goBack, { meta: true })
  useHotkey(']', goForward, { meta: true })
  useHotkey('b', toggleSidebar, { meta: true })
  useHotkey('n', () => openCreateDialog('cell'), { meta: true })
  useHotkey('c', openClaudePanel, { meta: true, shift: true })
  useHotkey('Escape', closeCommandPalette)

  const toolbar = (
    <header className="toolbar">
      <div className="toolbar-nav">
        <button onClick={goBack} disabled={historyIndex <= 0} title="Back (Cmd+[)">
          <IconArrowLeft size={16} />
        </button>
        <button
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          title="Forward (Cmd+])"
        >
          <IconArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button onClick={refetch} title="Refresh (Cmd+R)">
          <IconRefresh size={16} />
        </button>
      </div>
      <Breadcrumbs uri={uri} onNavigate={navigate} />
      <AddressBar value={uri} onChange={navigate} onCommandPalette={openCommandPalette} />
      {data && hasPrettyView(data) && <ViewToggle mode={viewMode} onChange={setViewMode} />}
    </header>
  )

  const sidebar = (
    <Sidebar
      currentUri={uri}
      onNavigate={navigate}
      collapsed={sidebarCollapsed}
      onToggleCollapse={toggleSidebar}
      onCreateNew={() => openCreateDialog('cell')}
      onOpenClaude={openClaudePanel}
    />
  )

  return (
    <AppLayout toolbar={toolbar} sidebar={sidebar} sidebarCollapsed={sidebarCollapsed}>
      <main>
        {loading && !virtualViews[uri] && <div className="loading pulse">Loading...</div>}
        {error && !virtualViews[uri] && <div className="error-card">Error: {error.message}</div>}
        {(data || virtualViews[uri]) && (
          <ViewResolver resource={data} uri={uri} onNavigate={navigate} viewMode={viewMode} />
        )}
        {!loading && !error && !data && !virtualViews[uri] && <div className="empty">No data</div>}
      </main>
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={closeCommandPalette}
        onNavigate={navigate}
      />
      <CreateResourceDialog
        isOpen={createDialogOpen}
        onClose={closeCreateDialog}
        initialType={createType}
        onCreated={(uri) => {
          closeCreateDialog()
          navigate(uri)
        }}
      />
      <ClaudePanel isOpen={claudePanelOpen} onClose={closeClaudePanel} />
    </AppLayout>
  )
}

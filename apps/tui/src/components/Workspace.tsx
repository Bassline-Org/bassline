import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import Sidebar from './Sidebar.js'
import PageView from './PageView.js'
import SnippetEditor from './SnippetEditor.js'
import StatusBar from './StatusBar.js'
import ConnectionManager from './ConnectionManager.js'
import SessionManager from './SessionManager.js'
import CommandPalette from './CommandPalette.js'
import { loadPage, savePage, createPage, deletePage, loadPageList, createSnippet } from '../pages.js'
import { Connection, loadConnections } from '../connections.js'
import { Command, initCommands, registerPageCommands } from '../commands.js'
import { evalTcl } from '../client.js'

interface WorkspaceProps {
  connection: Connection
  onDisconnect: () => void
  onSwitchConnection: (connection: Connection) => void
}

export default function Workspace({ connection, onDisconnect, onSwitchConnection }: WorkspaceProps) {
  const [currentPage, setCurrentPage] = useState(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [focus, setFocus] = useState('sidebar') // 'sidebar' | 'page' | 'editor'
  const [editingIndex, setEditingIndex] = useState(null)
  const [snippetTypePrompt, setSnippetTypePrompt] = useState(null) // { afterIndex }
  const [showHelp, setShowHelp] = useState(false)
  const [showConnectionManager, setShowConnectionManager] = useState(false)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [currentSession, setCurrentSession] = useState('default')

  // On mount, ensure at least one page exists and init commands
  useEffect(() => {
    // Initialize command registry from files
    initCommands()

    const pages = loadPageList()
    if (pages.length === 0) {
      const scratchpad = createPage('Scratchpad')
      setCurrentPage(scratchpad)
      setFocus('page')
      setSidebarVisible(false)
    } else {
      // Load the most recent page
      const page = loadPage(pages[0].id)
      setCurrentPage(page)
      setFocus('page')
      setSidebarVisible(false)
      // Register commands from this page
      if (page) {
        registerPageCommands(page.id, page.snippets)
      }
    }
  }, [])

  const handleSelectPage = id => {
    const page = loadPage(id)
    setCurrentPage(page)
    setSidebarVisible(false)
    setFocus('page')
  }

  const handleCreatePage = title => {
    const page = createPage(title)
    setCurrentPage(page)
    setSidebarVisible(false)
    setFocus('page')
  }

  const handleDeletePage = id => {
    deletePage(id)
    if (currentPage?.id === id) {
      const pages = loadPageList()
      if (pages.length > 0) {
        setCurrentPage(loadPage(pages[0].id))
      } else {
        const scratchpad = createPage('Scratchpad')
        setCurrentPage(scratchpad)
      }
    }
  }

  const handlePageChange = action => {
    if (!currentPage) return

    const snippets = [...currentPage.snippets]

    if (action.type === 'add') {
      // Show type prompt
      setSnippetTypePrompt({ afterIndex: action.after })
      return
    }

    if (action.type === 'delete' && snippets.length > 1) {
      snippets.splice(action.index, 1)
    }

    if (action.type === 'move') {
      const [moved] = snippets.splice(action.from, 1)
      snippets.splice(action.to, 0, moved)
    }

    const updated = { ...currentPage, snippets }
    savePage(updated)
    setCurrentPage(updated)
  }

  const addSnippet = type => {
    if (!snippetTypePrompt || !currentPage) return
    const snippets = [...currentPage.snippets]
    snippets.splice(snippetTypePrompt.afterIndex + 1, 0, createSnippet(type))
    const updated = { ...currentPage, snippets }
    savePage(updated)
    setCurrentPage(updated)
    setSnippetTypePrompt(null)
  }

  const handleEdit = index => {
    setEditingIndex(index)
    setFocus('editor')
  }

  const handleSaveSnippet = content => {
    if (editingIndex === null || !currentPage) return
    const snippets = [...currentPage.snippets]
    snippets[editingIndex] = { ...snippets[editingIndex], content }
    const updated = { ...currentPage, snippets }
    savePage(updated)
    setCurrentPage(updated)
    setEditingIndex(null)
    setFocus('page')
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setFocus('page')
  }

  // Global keyboard handling
  useInput(
    (ch, key) => {
      // Command palette modal
      if (showCommandPalette) {
        // Handled by CommandPalette component
        return
      }

      // Connection manager modal
      if (showConnectionManager) {
        // Handled by ConnectionManager component
        return
      }

      // Session manager modal
      if (showSessionManager) {
        // Handled by SessionManager component
        return
      }

      // Help modal
      if (showHelp) {
        if (key.escape || ch === '?') {
          setShowHelp(false)
        }
        return
      }

      // Command palette (Ctrl+P)
      if (key.ctrl && ch === 'p') {
        setShowCommandPalette(true)
        return
      }

      // Toggle help
      if (ch === '?') {
        setShowHelp(true)
        return
      }

      // Connection manager
      if (ch === 'c' && focus !== 'editor') {
        setShowConnectionManager(true)
        return
      }

      // Session manager
      if (ch === 's' && focus !== 'editor') {
        setShowSessionManager(true)
        return
      }

      // Handle snippet type selection
      if (snippetTypePrompt) {
        if (ch === 't' || ch === '1') {
          addSnippet('tcl')
        } else if (ch === 'm' || ch === '2') {
          addSnippet('markdown')
        } else if (ch === 'c' || ch === '3') {
          addSnippet('command')
        } else if (key.escape) {
          setSnippetTypePrompt(null)
        }
        return
      }

      // Tab to toggle sidebar
      if (key.tab && focus !== 'editor') {
        if (sidebarVisible && focus === 'sidebar') {
          setSidebarVisible(false)
          setFocus('page')
        } else {
          setSidebarVisible(true)
          setFocus('sidebar')
        }
        return
      }

      // Escape from sidebar to page
      if (key.escape && focus === 'sidebar') {
        setSidebarVisible(false)
        setFocus('page')
      }
    },
    {
      isActive: focus !== 'editor' && !showCommandPalette && !showConnectionManager && !showSessionManager && !showHelp,
    }
  )

  const HelpModal = () => (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">
        Keyboard Shortcuts
      </Text>
      <Text dimColor>{'─'.repeat(30)}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Page View:</Text>
        <Text> ↑/↓ Navigate snippets</Text>
        <Text> Enter Evaluate tcl snippet</Text>
        <Text> e Edit snippet</Text>
        <Text> a Add snippet</Text>
        <Text> x Delete snippet</Text>
        <Text> Shift+↑/↓ Move snippet</Text>
        <Text> Tab Open sidebar</Text>
        <Text> Ctrl+L Clear results</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Sidebar:</Text>
        <Text> ↑/↓ Navigate pages</Text>
        <Text> Enter Open page</Text>
        <Text> n New page</Text>
        <Text> d Delete page</Text>
        <Text> Esc Close sidebar</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Global:</Text>
        <Text> Ctrl+P Command palette</Text>
        <Text> s Session manager</Text>
        <Text> c Connection manager</Text>
        <Text> ? Help</Text>
        <Text> q Quit</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Editor:</Text>
        <Text> ↑/↓ Navigate lines</Text>
        <Text> Enter New line</Text>
        <Text> Backspace Delete empty line (merges up)</Text>
        <Text> Ctrl+K Delete current line</Text>
        <Text> Ctrl+S Save</Text>
        <Text> Esc Cancel</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press ? or Esc to close</Text>
      </Box>
    </Box>
  )

  const handleConnectionSelect = (conn: Connection) => {
    setShowConnectionManager(false)
    onSwitchConnection(conn)
  }

  // Command palette handlers
  const handlePaletteCommand = async (cmd: Command) => {
    // Execute the command in default session
    try {
      const script = `${cmd.content}\n${cmd.name}`
      await evalTcl(connection.url, script, 'default')
    } catch (err) {
      // Could show error
    }
  }

  const handlePalettePage = (pageId: string) => {
    handleSelectPage(pageId)
  }

  const handlePaletteConnection = (conn: Connection) => {
    onSwitchConnection(conn)
  }

  const handlePaletteAction = (actionId: string) => {
    switch (actionId) {
      case 'new-page':
        // Prompt for name would be better, for now create with default name
        handleCreatePage('New Page')
        break
      case 'toggle-sidebar':
        setSidebarVisible(v => !v)
        setFocus(sidebarVisible ? 'page' : 'sidebar')
        break
      case 'show-help':
        setShowHelp(true)
        break
      case 'clear-results':
        // This would need to be passed to PageView
        break
    }
  }

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        {sidebarVisible && (
          <Sidebar
            onSelectPage={handleSelectPage}
            onCreatePage={handleCreatePage}
            onDeletePage={handleDeletePage}
            currentPageId={currentPage?.id}
            focused={focus === 'sidebar'}
          />
        )}
        <Box flexDirection="column" flexGrow={1} width="100%">
          {showCommandPalette ? (
            <CommandPalette
              currentConnectionId={connection.id}
              onSelectCommand={handlePaletteCommand}
              onSelectPage={handlePalettePage}
              onSelectConnection={handlePaletteConnection}
              onSelectAction={handlePaletteAction}
              onClose={() => setShowCommandPalette(false)}
            />
          ) : showConnectionManager ? (
            <ConnectionManager
              currentConnection={connection}
              onSelect={handleConnectionSelect}
              onClose={() => setShowConnectionManager(false)}
            />
          ) : showSessionManager ? (
            <SessionManager
              currentSession={currentSession}
              daemonUrl={connection.url}
              onSelect={sessionId => {
                setCurrentSession(sessionId)
                setShowSessionManager(false)
              }}
              onClose={() => setShowSessionManager(false)}
            />
          ) : showHelp ? (
            <HelpModal />
          ) : snippetTypePrompt ? (
            <Box padding={1} borderStyle="round" borderColor="yellow">
              <Box flexDirection="column">
                <Text bold color="yellow">
                  Add snippet:
                </Text>
                <Box marginTop={1}>
                  <Text color="cyan">[t]</Text>
                  <Text> tcl </Text>
                  <Text color="cyan">[m]</Text>
                  <Text> markdown </Text>
                  <Text color="cyan">[c]</Text>
                  <Text> command</Text>
                </Box>
                <Box marginTop={1}>
                  <Text dimColor>Esc to cancel</Text>
                </Box>
              </Box>
            </Box>
          ) : focus === 'editor' && editingIndex !== null ? (
            <SnippetEditor
              snippet={currentPage.snippets[editingIndex]}
              onSave={handleSaveSnippet}
              onCancel={handleCancelEdit}
            />
          ) : (
            <PageView
              page={currentPage}
              daemonUrl={connection.url}
              sessionId={currentSession}
              onPageChange={handlePageChange}
              onEdit={handleEdit}
              focused={focus === 'page'}
            />
          )}
        </Box>
      </Box>
      <StatusBar
        connection={connection}
        session={currentSession}
        onDisconnect={onDisconnect}
        canQuit={focus !== 'editor'}
      />
    </Box>
  )
}

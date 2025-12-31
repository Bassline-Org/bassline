import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import Sidebar from './Sidebar.js'
import PageView from './PageView.js'
import SnippetEditor from './SnippetEditor.js'
import StatusBar from './StatusBar.js'
import CommandPalette from './CommandPalette.js'
import { useBlit, useBlitPath, useBlitContext } from '../blit-context.js'
import { randomUUID } from 'crypto'

interface Page {
  id: string
  title: string
  created: string
  modified: string
  snippets: Array<{ id: string; type: string; content: string }>
}

interface WorkspaceProps {
  onClose: () => void
}

export default function Workspace({ onClose }: WorkspaceProps) {
  const kit = useBlit()
  const blitPath = useBlitPath()
  const { checkpoint } = useBlitContext()

  const [currentPage, setCurrentPage] = useState<Page | null>(null)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [focus, setFocus] = useState<'sidebar' | 'page' | 'editor'>('sidebar')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [snippetTypePrompt, setSnippetTypePrompt] = useState<{ afterIndex: number } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Load or create initial page
  useEffect(() => {
    const init = async () => {
      // Get all store keys and filter for pages (page:uuid format)
      const result = await kit.get({ path: '/store' })
      const allKeys = (result.body as string[]) || []
      const pageKeys = allKeys.filter(k => k.startsWith('page:'))

      if (pageKeys.length === 0) {
        // Create initial scratchpad
        const scratchpad = await createPage('Scratchpad')
        setCurrentPage(scratchpad)
        setFocus('page')
        setSidebarVisible(false)
      } else {
        // Load most recent page (first in list - we'll sort later)
        const pageResult = await kit.get({ path: `/store/${pageKeys[0]}` })
        if (pageResult.body) {
          setCurrentPage(pageResult.body as Page)
          setFocus('page')
          setSidebarVisible(false)
        }
      }
    }
    init()
  }, [])

  const createPage = async (title: string): Promise<Page> => {
    const now = new Date().toISOString()
    const page: Page = {
      id: randomUUID(),
      title,
      created: now,
      modified: now,
      snippets: [{ id: randomUUID(), type: 'tcl', content: '' }],
    }
    await kit.put({ path: `/store/page:${page.id}` }, page)
    return page
  }

  const savePage = async (page: Page) => {
    page.modified = new Date().toISOString()
    await kit.put({ path: `/store/page:${page.id}` }, page)
  }

  const deletePage = async (id: string) => {
    await kit.put({ path: `/store/page:${id}` }, null)
  }

  const handleSelectPage = async (id: string) => {
    const result = await kit.get({ path: `/store/page:${id}` })
    if (result.body) {
      setCurrentPage(result.body as Page)
      setSidebarVisible(false)
      setFocus('page')
    }
  }

  const handleCreatePage = async (title: string) => {
    const page = await createPage(title)
    setCurrentPage(page)
    setSidebarVisible(false)
    setFocus('page')
  }

  const handleDeletePage = async (id: string) => {
    await deletePage(id)
    if (currentPage?.id === id) {
      // Load another page or create scratchpad
      const result = await kit.get({ path: '/store' })
      const allKeys = (result.body as string[]) || []
      const pageKeys = allKeys.filter(k => k.startsWith('page:'))
      if (pageKeys.length > 0) {
        const pageResult = await kit.get({ path: `/store/${pageKeys[0]}` })
        setCurrentPage(pageResult.body as Page)
      } else {
        const scratchpad = await createPage('Scratchpad')
        setCurrentPage(scratchpad)
      }
    }
  }

  const handlePageChange = async (action: { type: string; [key: string]: unknown }) => {
    if (!currentPage) return

    const snippets = [...currentPage.snippets]

    if (action.type === 'add') {
      setSnippetTypePrompt({ afterIndex: action.after as number })
      return
    }

    if (action.type === 'delete' && snippets.length > 1) {
      snippets.splice(action.index as number, 1)
    }

    if (action.type === 'move') {
      const [moved] = snippets.splice(action.from as number, 1)
      snippets.splice(action.to as number, 0, moved)
    }

    const updated = { ...currentPage, snippets }
    await savePage(updated)
    setCurrentPage(updated)
  }

  const addSnippet = async (type: string) => {
    if (!snippetTypePrompt || !currentPage) return
    const snippets = [...currentPage.snippets]
    snippets.splice(snippetTypePrompt.afterIndex + 1, 0, {
      id: randomUUID(),
      type,
      content: '',
    })
    const updated = { ...currentPage, snippets }
    await savePage(updated)
    setCurrentPage(updated)
    setSnippetTypePrompt(null)
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setFocus('editor')
  }

  const handleSaveSnippet = async (content: string) => {
    if (editingIndex === null || !currentPage) return
    const snippets = [...currentPage.snippets]
    snippets[editingIndex] = { ...snippets[editingIndex], content }
    const updated = { ...currentPage, snippets }
    await savePage(updated)
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

      // Checkpoint (Ctrl+S)
      if (key.ctrl && ch === 's') {
        checkpoint()
      }
    },
    {
      isActive: focus !== 'editor' && !showCommandPalette && !showHelp,
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
        <Text> Ctrl+S Save checkpoint</Text>
        <Text> ? Help</Text>
        <Text> q Quit</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        <Text bold>Editor:</Text>
        <Text> ↑/↓ Navigate lines</Text>
        <Text> Enter New line</Text>
        <Text> Backspace Delete empty line</Text>
        <Text> Ctrl+K Delete current line</Text>
        <Text> Ctrl+S Save</Text>
        <Text> Esc Cancel</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press ? or Esc to close</Text>
      </Box>
    </Box>
  )

  // Command palette handlers
  const handlePaletteCommand = async (cmd: { name: string; content: string }) => {
    // Execute the command (define proc + call it)
    try {
      const script = `${cmd.content}\n${cmd.name}`
      await kit.put({ path: '/tcl/eval' }, script)
    } catch {
      // Could show error
    }
  }

  const handlePalettePage = (pageId: string) => {
    handleSelectPage(pageId)
  }

  const handlePaletteAction = (actionId: string) => {
    switch (actionId) {
      case 'new-page':
        handleCreatePage('New Page')
        break
      case 'toggle-sidebar':
        setSidebarVisible(v => !v)
        setFocus(sidebarVisible ? 'page' : 'sidebar')
        break
      case 'show-help':
        setShowHelp(true)
        break
      case 'checkpoint':
        checkpoint()
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
              onSelectCommand={handlePaletteCommand}
              onSelectPage={handlePalettePage}
              onSelectAction={handlePaletteAction}
              onClose={() => setShowCommandPalette(false)}
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
          ) : focus === 'editor' && editingIndex !== null && currentPage ? (
            <SnippetEditor
              snippet={currentPage.snippets[editingIndex]}
              onSave={handleSaveSnippet}
              onCancel={handleCancelEdit}
            />
          ) : (
            <PageView
              page={currentPage}
              onPageChange={handlePageChange}
              onEdit={handleEdit}
              focused={focus === 'page'}
            />
          )}
        </Box>
      </Box>
      <StatusBar blitPath={blitPath} onQuit={onClose} canQuit={focus !== 'editor'} />
    </Box>
  )
}

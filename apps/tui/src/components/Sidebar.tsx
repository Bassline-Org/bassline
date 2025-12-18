import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { loadPageList } from '../pages.js'

export default function Sidebar({ onSelectPage, onCreatePage, onDeletePage, currentPageId, focused = true }) {
  const [pages, setPages] = useState([])
  const [selected, setSelected] = useState(0)
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const refresh = () => {
    const list = loadPageList()
    setPages(list)
    // Keep selection in bounds
    setSelected(s => Math.min(s, Math.max(0, list.length - 1)))
  }

  useEffect(() => {
    refresh()
  }, [currentPageId])

  useInput(
    (ch, key) => {
      if (!focused) return

      if (creating) {
        if (key.escape) {
          setCreating(false)
          setNewTitle('')
        } else if (key.return && newTitle.trim()) {
          onCreatePage(newTitle.trim())
          setCreating(false)
          setNewTitle('')
          setTimeout(refresh, 100)
        }
        return
      }

      if (confirmDelete) {
        if (ch === 'y' && pages[selected]) {
          onDeletePage(pages[selected].id)
          setConfirmDelete(false)
          setTimeout(refresh, 100)
        } else {
          setConfirmDelete(false)
        }
        return
      }

      // Navigation
      if (key.upArrow) {
        setSelected(s => Math.max(0, s - 1))
      } else if (key.downArrow) {
        setSelected(s => Math.min(pages.length - 1, s + 1))
      }

      // Select page
      else if (key.return && pages[selected]) {
        onSelectPage(pages[selected].id)
      }

      // New page
      else if (ch === 'n') {
        setCreating(true)
      }

      // Delete page
      else if (ch === 'd' && pages[selected]) {
        setConfirmDelete(true)
      }
    },
    { isActive: focused }
  )

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" width={30} paddingX={1}>
      <Text bold>Pages</Text>
      <Text dimColor>{'─'.repeat(26)}</Text>

      {creating ? (
        <Box marginTop={1}>
          <Text color="yellow">New page: </Text>
          <TextInput value={newTitle} onChange={setNewTitle} focus={true} />
        </Box>
      ) : confirmDelete ? (
        <Box marginTop={1}>
          <Text color="red">Delete "{pages[selected]?.title}"? (y/n)</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {pages.length === 0 ? (
            <Text dimColor>No pages yet</Text>
          ) : (
            pages.map((page, i) => (
              <Text key={page.id}>
                {focused && i === selected ? <Text color="cyan">{'> '}</Text> : '  '}
                <Text
                  color={page.id === currentPageId ? 'green' : focused && i === selected ? 'cyan' : undefined}
                  bold={page.id === currentPageId}
                >
                  {page.title}
                </Text>
              </Text>
            ))
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>[n] New [d] Del [Enter] Open</Text>
      </Box>
    </Box>
  )
}

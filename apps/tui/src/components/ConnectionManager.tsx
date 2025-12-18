import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { Connection, loadConnections, addConnection, deleteConnection, testConnection } from '../connections.js'

interface ConnectionManagerProps {
  currentConnection: Connection
  onSelect: (connection: Connection) => void
  onClose: () => void
}

export default function ConnectionManager({ currentConnection, onSelect, onClose }: ConnectionManagerProps) {
  const [connections, setConnections] = useState<Connection[]>([])
  const [selected, setSelected] = useState(0)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [newUrl, setNewUrl] = useState('')
  const [newName, setNewName] = useState('')
  const [addStep, setAddStep] = useState<'url' | 'name'>('url')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setConnections(loadConnections())
  }

  useEffect(() => {
    refresh()
  }, [])

  useInput((input, key) => {
    if (mode === 'add') {
      if (key.escape) {
        setMode('list')
        setNewUrl('')
        setNewName('')
        setAddStep('url')
        setError(null)
      }
      return
    }

    // List mode
    if (key.escape) {
      onClose()
      return
    }

    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1))
    } else if (key.downArrow) {
      setSelected(s => Math.min(connections.length, s + 1)) // +1 for "Add new"
    } else if (key.return) {
      if (selected === connections.length) {
        // Add new connection
        setMode('add')
        setAddStep('url')
      } else {
        // Select connection
        const conn = connections[selected]
        if (conn.id !== currentConnection.id) {
          onSelect(conn)
        }
      }
    } else if (input === 'd' && selected < connections.length) {
      // Delete connection (but not if it's the current one)
      const conn = connections[selected]
      if (conn.id !== currentConnection.id) {
        deleteConnection(conn.id)
        refresh()
        setSelected(s => Math.min(s, connections.length - 2))
      }
    }
  })

  const handleUrlSubmit = async () => {
    setTesting(true)
    setError(null)
    const url = newUrl.startsWith('http') ? newUrl : `http://${newUrl}`
    const alive = await testConnection(url)
    setTesting(false)
    if (alive) {
      setNewUrl(url)
      setAddStep('name')
      // Suggest a name based on URL
      try {
        const urlObj = new URL(url)
        setNewName(urlObj.host)
      } catch {
        setNewName(url)
      }
    } else {
      setError('Could not connect to daemon')
    }
  }

  const handleNameSubmit = () => {
    const conn = addConnection(newName || newUrl, newUrl, 'green')
    setMode('list')
    setNewUrl('')
    setNewName('')
    setAddStep('url')
    refresh()
    onSelect(conn)
  }

  if (mode === 'add') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
        <Text bold color="yellow">
          Add Connection
        </Text>
        <Box marginTop={1} flexDirection="column">
          {addStep === 'url' ? (
            <>
              <Text>Daemon URL:</Text>
              <Box marginTop={1}>
                <Text color="cyan">&gt; </Text>
                <TextInput
                  value={newUrl}
                  onChange={setNewUrl}
                  onSubmit={handleUrlSubmit}
                  placeholder="localhost:9111"
                />
              </Box>
              {testing && <Text color="yellow">Testing connection...</Text>}
              {error && <Text color="red">{error}</Text>}
            </>
          ) : (
            <>
              <Text>Connection name:</Text>
              <Box marginTop={1}>
                <Text color="cyan">&gt; </Text>
                <TextInput
                  value={newName}
                  onChange={setNewName}
                  onSubmit={handleNameSubmit}
                  placeholder="My Connection"
                />
              </Box>
            </>
          )}
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter to confirm, Esc to cancel</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
      <Text bold color="cyan">
        Connections
      </Text>
      <Box marginTop={1} flexDirection="column">
        {connections.map((conn, i) => {
          const isCurrent = conn.id === currentConnection.id
          const isSelected = i === selected
          return (
            <Text key={conn.id}>
              {isSelected ? <Text color="cyan">&gt; </Text> : '  '}
              <Text color={conn.color || 'green'}>●</Text>
              <Text color={isSelected ? 'cyan' : undefined} bold={isCurrent}>
                {' '}
                {conn.name}
              </Text>
              {isCurrent && <Text dimColor> (active)</Text>}
            </Text>
          )
        })}
        <Text>
          {selected === connections.length ? <Text color="cyan">&gt; </Text> : '  '}
          <Text color={selected === connections.length ? 'cyan' : 'gray'}>+ Add new connection</Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Enter to select, d to delete, Esc to close</Text>
      </Box>
    </Box>
  )
}

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { listSessions, deleteSession } from '../client.js'

interface Session {
  id: string
  createdAt: string
  lastUsed: string
}

interface SessionManagerProps {
  currentSession: string
  daemonUrl: string
  onSelect: (sessionId: string) => void
  onClose: () => void
}

export default function SessionManager({ currentSession, daemonUrl, onSelect, onClose }: SessionManagerProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState(0)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const result = await listSessions(daemonUrl)
      if (Array.isArray(result.body)) {
        setSessions(result.body as Session[])
      }
    } catch {
      // Ignore errors
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [daemonUrl])

  useInput((input, key) => {
    if (mode === 'add') {
      if (key.escape) {
        setMode('list')
        setNewName('')
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
      setSelected(s => Math.min(sessions.length, s + 1)) // +1 for "Add new"
    } else if (key.return) {
      if (selected === sessions.length) {
        // Add new session
        setMode('add')
      } else {
        // Select session
        const sess = sessions[selected]
        if (sess.id !== currentSession) {
          onSelect(sess.id)
        }
        onClose()
      }
    } else if (input === 'd' && selected < sessions.length) {
      // Delete session (but not if it's the current one)
      const sess = sessions[selected]
      if (sess.id !== currentSession) {
        deleteSession(daemonUrl, sess.id).then(() => {
          refresh()
          setSelected(s => Math.max(0, Math.min(s, sessions.length - 2)))
        })
      }
    }
  })

  const handleNameSubmit = () => {
    if (newName.trim()) {
      onSelect(newName.trim())
      onClose()
    }
    setMode('list')
    setNewName('')
  }

  const formatTime = (iso: string) => {
    try {
      const date = new Date(iso)
      return date.toLocaleTimeString()
    } catch {
      return iso
    }
  }

  if (mode === 'add') {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="yellow">
        <Text bold color="yellow">
          New Session
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text>Session name:</Text>
          <Box marginTop={1}>
            <Text color="cyan">&gt; </Text>
            <TextInput value={newName} onChange={setNewName} onSubmit={handleNameSubmit} placeholder="my-session" />
          </Box>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Enter to create, Esc to cancel</Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="magenta">
      <Text bold color="magenta">
        Tcl Sessions
      </Text>
      {loading ? (
        <Text dimColor>Loading...</Text>
      ) : (
        <Box marginTop={1} flexDirection="column">
          {sessions.length === 0 && <Text dimColor>No sessions yet</Text>}
          {sessions.map((sess, i) => {
            const isCurrent = sess.id === currentSession
            const isSelected = i === selected
            return (
              <Text key={sess.id}>
                {isSelected ? <Text color="magenta">&gt; </Text> : '  '}
                <Text color={isSelected ? 'magenta' : undefined} bold={isCurrent}>
                  {sess.id}
                </Text>
                {isCurrent && <Text dimColor> (active)</Text>}
                <Text dimColor> - {formatTime(sess.lastUsed)}</Text>
              </Text>
            )
          })}
          <Text>
            {selected === sessions.length ? <Text color="magenta">&gt; </Text> : '  '}
            <Text color={selected === sessions.length ? 'magenta' : 'gray'}>+ New session</Text>
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>Enter to select, d to delete, Esc to close</Text>
      </Box>
    </Box>
  )
}

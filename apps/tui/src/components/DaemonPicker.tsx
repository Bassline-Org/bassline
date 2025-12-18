import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { Spinner } from '@inkjs/ui'
import { findDaemons } from '../client.js'
import { startDaemon } from '../daemon.js'
import { Connection, loadConnections, addConnection, deleteConnection, testConnection } from '../connections.js'

const START_OPTIONS = [
  { label: 'Start naked daemon (minimal)', mode: 'naked' },
  { label: 'Start full daemon', mode: 'daemon' },
]

interface DaemonPickerProps {
  onConnect: (connection: Connection) => void
}

export default function DaemonPicker({ onConnect }: DaemonPickerProps) {
  const [allSavedConnections, setAllSavedConnections] = useState<Connection[]>([])
  const [savedConnections, setSavedConnections] = useState<Connection[]>([])
  const [runningDaemons, setRunningDaemons] = useState<{ port: number; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(0)
  const [starting, setStarting] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const saved = loadConnections()
    setAllSavedConnections(saved)

    // Validate saved connections - only show ones that are alive
    const validatedSaved = await Promise.all(
      saved.map(async c => {
        const alive = await testConnection(c.url)
        return alive ? c : null
      })
    )
    const aliveSaved = validatedSaved.filter((c): c is Connection => c !== null)
    setSavedConnections(aliveSaved)

    // Find running daemons
    const found = await findDaemons()
    // Filter out ones that are already saved (check ALL saved, not just alive)
    const savedUrls = new Set(saved.map(c => c.url))
    const unsaved = found.filter(d => !savedUrls.has(d.url))
    setRunningDaemons(unsaved)

    setLoading(false)
    setSelected(0)
  }

  useEffect(() => {
    refresh()
  }, [])

  // Build combined options list
  type Option =
    | { type: 'saved'; connection: Connection }
    | { type: 'running'; port: number; url: string }
    | { type: 'start'; label: string; mode: string }

  const options: Option[] = [
    ...savedConnections.map(c => ({ type: 'saved' as const, connection: c })),
    ...runningDaemons.map(d => ({ type: 'running' as const, ...d })),
    ...START_OPTIONS.map(s => ({ type: 'start' as const, ...s })),
  ]

  const handleSelect = async () => {
    const opt = options[selected]
    if (opt.type === 'saved') {
      // Test if still alive
      const alive = await testConnection(opt.connection.url)
      if (alive) {
        onConnect(opt.connection)
      } else {
        // Could show error, for now just refresh
        refresh()
      }
    } else if (opt.type === 'running') {
      // Check if connection already exists for this URL (check ALL saved, not just alive)
      const existing = allSavedConnections.find(c => c.url === opt.url)
      if (existing) {
        onConnect(existing)
      } else {
        const name = `localhost:${opt.port}`
        const connection = addConnection(name, opt.url, 'green')
        onConnect(connection)
      }
    } else if (opt.type === 'start') {
      setStarting(true)
      const port = startDaemon(opt.mode)
      await new Promise(r => setTimeout(r, 1500))
      const url = `http://localhost:${port}`
      // Check if connection already exists for this URL
      const existing = allSavedConnections.find(c => c.url === url)
      if (existing) {
        onConnect(existing)
      } else {
        const name = `localhost:${port}`
        const connection = addConnection(name, url, 'green')
        onConnect(connection)
      }
    }
  }

  useInput((input, key) => {
    if (loading || starting) return

    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1))
    } else if (key.downArrow) {
      setSelected(s => Math.min(options.length - 1, s + 1))
    } else if (key.return) {
      handleSelect()
    } else if (input === 'r') {
      refresh()
    } else if (input === 'd') {
      // Delete saved connection
      const opt = options[selected]
      if (opt.type === 'saved') {
        deleteConnection(opt.connection.id)
        refresh()
      }
    } else if (input === 'q') {
      process.exit(0)
    }
  })

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Scanning for daemons..." />
      </Box>
    )
  }

  if (starting) {
    return (
      <Box padding={1}>
        <Spinner label="Starting daemon..." />
      </Box>
    )
  }

  let idx = 0
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>blt - Bassline Terminal</Text>
      <Text dimColor>─────────────────────</Text>
      <Box marginY={1} flexDirection="column">
        {savedConnections.length > 0 && <Text dimColor>Saved connections:</Text>}
        {savedConnections.map(c => {
          const i = idx++
          return (
            <Text key={c.id}>
              {i === selected ? <Text color="cyan">{'> '}</Text> : '  '}
              <Text color={i === selected ? 'cyan' : c.color || undefined}>{c.name}</Text>
              <Text dimColor> {c.url}</Text>
            </Text>
          )
        })}
        {savedConnections.length > 0 && runningDaemons.length > 0 && <Text> </Text>}
        {runningDaemons.length > 0 && <Text dimColor>Running daemons (unsaved):</Text>}
        {runningDaemons.map(d => {
          const i = idx++
          return (
            <Text key={d.port}>
              {i === selected ? <Text color="cyan">{'> '}</Text> : '  '}
              <Text color={i === selected ? 'cyan' : undefined}>localhost:{d.port}</Text>
            </Text>
          )
        })}
        {(savedConnections.length > 0 || runningDaemons.length > 0) && <Text> </Text>}
        <Text dimColor>Start a new daemon:</Text>
        {START_OPTIONS.map(s => {
          const i = idx++
          return (
            <Text key={s.mode}>
              {i === selected ? <Text color="cyan">{'> '}</Text> : '  '}
              <Text color={i === selected ? 'cyan' : undefined}>{s.label}</Text>
            </Text>
          )
        })}
      </Box>
      <Text dimColor>[Enter] Select [d] Delete [r] Refresh [q] Quit</Text>
    </Box>
  )
}

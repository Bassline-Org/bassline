import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { Spinner } from '@inkjs/ui'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join, basename } from 'path'
import { loadBlit, createBlit, isValidBlit } from '../blit-loader.js'

const RECENT_FILE = join(homedir(), '.blt', 'recent.json')

interface RecentBlit {
  path: string
  name: string
  lastOpened: string
}

function loadRecent(): RecentBlit[] {
  try {
    if (existsSync(RECENT_FILE)) {
      return JSON.parse(readFileSync(RECENT_FILE, 'utf8'))
    }
  } catch {
    // Ignore errors
  }
  return []
}

function saveRecent(recent: RecentBlit[]) {
  try {
    const dir = join(homedir(), '.blt')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(RECENT_FILE, JSON.stringify(recent, null, 2))
  } catch {
    // Ignore errors
  }
}

function addToRecent(path: string, name: string) {
  const recent = loadRecent().filter(r => r.path !== path)
  recent.unshift({ path, name, lastOpened: new Date().toISOString() })
  // Keep only last 10
  saveRecent(recent.slice(0, 10))
}

interface BlitState {
  kit: {
    get: (h: { path: string }) => Promise<{ headers: Record<string, unknown>; body: unknown }>
    put: (h: { path: string }, body: unknown) => Promise<{ headers: Record<string, unknown>; body: unknown }>
  }
  path: string
  checkpoint: () => Promise<void>
  close: () => Promise<void>
}

interface BlitPickerProps {
  defaultPath?: string
  onOpen: (blit: BlitState) => void
}

type Mode = 'menu' | 'open' | 'create'

export default function BlitPicker({ defaultPath, onOpen }: BlitPickerProps) {
  const [mode, setMode] = useState<Mode>('menu')
  const [recent, setRecent] = useState<RecentBlit[]>([])
  const [selected, setSelected] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inputPath, setInputPath] = useState('')

  useEffect(() => {
    setRecent(loadRecent())

    // If defaultPath provided, try to open it
    if (defaultPath) {
      openBlit(defaultPath)
    }
  }, [defaultPath])

  const openBlit = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      const resolved = path.startsWith('~') ? path.replace('~', homedir()) : path

      if (!existsSync(resolved)) {
        throw new Error(`File not found: ${resolved}`)
      }

      if (!isValidBlit(resolved)) {
        throw new Error(`Not a valid blit file: ${resolved}`)
      }

      const blit = await loadBlit(resolved)
      const name = basename(resolved, '.blit')
      addToRecent(resolved, name)

      onOpen({
        kit: blit.kit,
        path: resolved,
        checkpoint: blit.checkpoint,
        close: blit.close,
      })
    } catch (err: unknown) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  const createNewBlit = async (path: string) => {
    setLoading(true)
    setError(null)

    try {
      const resolved = path.startsWith('~') ? path.replace('~', homedir()) : path

      // Ensure .blit extension
      const finalPath = resolved.endsWith('.blit') ? resolved : `${resolved}.blit`

      if (existsSync(finalPath)) {
        throw new Error(`File already exists: ${finalPath}`)
      }

      const blit = await createBlit(finalPath)
      const name = basename(finalPath, '.blit')
      addToRecent(finalPath, name)

      onOpen({
        kit: blit.kit,
        path: finalPath,
        checkpoint: blit.checkpoint,
        close: blit.close,
      })
    } catch (err: unknown) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  // Menu options
  type Option = { type: 'recent'; blit: RecentBlit } | { type: 'open' } | { type: 'create' }

  const options: Option[] = [
    ...recent.filter(r => existsSync(r.path)).map(blit => ({ type: 'recent' as const, blit })),
    { type: 'open' },
    { type: 'create' },
  ]

  useInput((input, key) => {
    if (loading) return

    // Handle text input modes
    if (mode === 'open' || mode === 'create') {
      if (key.escape) {
        setMode('menu')
        setInputPath('')
        setError(null)
      } else if (key.return && inputPath.trim()) {
        if (mode === 'open') {
          openBlit(inputPath.trim())
        } else {
          createNewBlit(inputPath.trim())
        }
      }
      return
    }

    // Menu mode
    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1))
    } else if (key.downArrow) {
      setSelected(s => Math.min(options.length - 1, s + 1))
    } else if (key.return) {
      const opt = options[selected]
      if (opt.type === 'recent') {
        openBlit(opt.blit.path)
      } else if (opt.type === 'open') {
        setMode('open')
        setError(null)
      } else if (opt.type === 'create') {
        setMode('create')
        setError(null)
      }
    } else if (input === 'q') {
      process.exit(0)
    }
  })

  if (loading) {
    return (
      <Box padding={1}>
        <Spinner label="Loading blit..." />
      </Box>
    )
  }

  // Open path input mode
  if (mode === 'open') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Open Blit</Text>
        <Text dimColor>Enter path to .blit file:</Text>
        <Box marginTop={1}>
          <Text color="cyan">{'> '}</Text>
          <TextInput value={inputPath} onChange={setInputPath} />
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>[Enter] Open [Esc] Cancel</Text>
        </Box>
      </Box>
    )
  }

  // Create path input mode
  if (mode === 'create') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>Create New Blit</Text>
        <Text dimColor>Enter path for new .blit file:</Text>
        <Box marginTop={1}>
          <Text color="cyan">{'> '}</Text>
          <TextInput value={inputPath} onChange={setInputPath} />
        </Box>
        {error && (
          <Box marginTop={1}>
            <Text color="red">{error}</Text>
          </Box>
        )}
        <Box marginTop={1}>
          <Text dimColor>[Enter] Create [Esc] Cancel</Text>
        </Box>
      </Box>
    )
  }

  // Menu mode
  let idx = 0
  const recentBlits = recent.filter(r => existsSync(r.path))

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>blt - Bassline Terminal</Text>
      <Text dimColor>{'─'.repeat(25)}</Text>

      {error && (
        <Box marginY={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}

      <Box marginY={1} flexDirection="column">
        {recentBlits.length > 0 && <Text dimColor>Recent blits:</Text>}
        {recentBlits.map(blit => {
          const i = idx++
          return (
            <Text key={blit.path}>
              {i === selected ? <Text color="cyan">{'> '}</Text> : '  '}
              <Text color={i === selected ? 'cyan' : undefined}>{blit.name}</Text>
              <Text dimColor> {blit.path}</Text>
            </Text>
          )
        })}

        {recentBlits.length > 0 && <Text> </Text>}

        {/* Open option */}
        <Text>
          {idx === selected ? <Text color="cyan">{'> '}</Text> : '  '}
          <Text color={idx++ === selected - (recentBlits.length > 0 ? 0 : 0) ? 'cyan' : undefined}>
            Open blit file...
          </Text>
        </Text>

        {/* Create option */}
        <Text>
          {idx === selected ? <Text color="cyan">{'> '}</Text> : '  '}
          <Text color={idx++ === selected ? 'cyan' : undefined}>Create new blit...</Text>
        </Text>
      </Box>

      <Text dimColor>[Enter] Select [q] Quit</Text>
    </Box>
  )
}

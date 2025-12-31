import React, { useState, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { sortByFuzzyScore } from '../fuzzy.js'
import { useBlit } from '../blit-context.js'

interface Command {
  name: string
  content: string
}

export type PaletteItem =
  | { type: 'command'; command: Command }
  | { type: 'page'; id: string; title: string }
  | { type: 'action'; id: string; label: string }

interface CommandPaletteProps {
  onSelectCommand: (command: Command) => void
  onSelectPage: (pageId: string) => void
  onSelectAction: (actionId: string) => void
  onClose: () => void
}

const BUILT_IN_ACTIONS = [
  { id: 'new-page', label: 'New Page' },
  { id: 'toggle-sidebar', label: 'Toggle Sidebar' },
  { id: 'show-help', label: 'Show Help' },
  { id: 'checkpoint', label: 'Save Checkpoint' },
]

export default function CommandPalette({
  onSelectCommand,
  onSelectPage,
  onSelectAction,
  onClose,
}: CommandPaletteProps) {
  const kit = useBlit()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [allItems, setAllItems] = useState<PaletteItem[]>([])

  // Load items on mount
  useEffect(() => {
    const loadItems = async () => {
      const items: PaletteItem[] = []

      // Load pages from blit store (page:uuid format)
      try {
        const result = await kit.get({ path: '/store' })
        const allKeys = (result.body as string[]) || []
        const pageKeys = allKeys.filter(k => k.startsWith('page:'))

        for (const key of pageKeys) {
          const pageResult = await kit.get({ path: `/store/${key}` })
          if (pageResult.body) {
            const page = pageResult.body as { id: string; title: string }
            items.push({ type: 'page', id: page.id, title: page.title })
          }
        }
      } catch {
        // Ignore errors loading pages
      }

      // Load procs from blit (via /fn store which contains proc sources)
      try {
        const result = await kit.get({ path: '/fn' })
        const fnKeys = (result.body as string[]) || []

        for (const name of fnKeys) {
          const fnResult = await kit.get({ path: `/fn/${name}` })
          if (fnResult.body) {
            items.push({
              type: 'command',
              command: { name, content: String(fnResult.body) },
            })
          }
        }
      } catch {
        // Ignore errors loading procs
      }

      // Built-in actions
      for (const action of BUILT_IN_ACTIONS) {
        items.push({ type: 'action', ...action })
      }

      setAllItems(items)
    }

    loadItems()
  }, [kit])

  // Filter and sort by fuzzy match
  const filteredItems = useMemo(() => {
    const getLabel = (item: PaletteItem): string => {
      switch (item.type) {
        case 'command':
          return item.command.name
        case 'page':
          return item.title
        case 'action':
          return item.label
      }
    }
    return sortByFuzzyScore(allItems, query, getLabel)
  }, [allItems, query])

  // Clamp selected index
  const clampedSelected = Math.min(selected, Math.max(0, filteredItems.length - 1))
  if (clampedSelected !== selected) {
    setSelected(clampedSelected)
  }

  const handleSelect = () => {
    const item = filteredItems[selected]
    if (!item) return

    switch (item.type) {
      case 'command':
        onSelectCommand(item.command)
        break
      case 'page':
        onSelectPage(item.id)
        break
      case 'action':
        onSelectAction(item.id)
        break
    }
    onClose()
  }

  useInput((input, key) => {
    if (key.escape) {
      onClose()
      return
    }

    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1))
    } else if (key.downArrow) {
      setSelected(s => Math.min(filteredItems.length - 1, s + 1))
    } else if (key.return) {
      handleSelect()
    }
  })

  // Group items by type for display
  const groupedItems = useMemo(() => {
    const groups: { label: string; items: Array<{ item: PaletteItem; index: number }> }[] = [
      { label: 'Commands', items: [] },
      { label: 'Pages', items: [] },
      { label: 'Actions', items: [] },
    ]

    filteredItems.forEach((item, index) => {
      switch (item.type) {
        case 'command':
          groups[0].items.push({ item, index })
          break
        case 'page':
          groups[1].items.push({ item, index })
          break
        case 'action':
          groups[2].items.push({ item, index })
          break
      }
    })

    return groups.filter(g => g.items.length > 0)
  }, [filteredItems])

  const maxVisible = 10

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1} width="100%">
      <Box marginBottom={1}>
        <Text color="magenta" bold>
          {'> '}
        </Text>
        <TextInput value={query} onChange={setQuery} placeholder="Search commands, pages..." />
      </Box>

      {filteredItems.length === 0 ? (
        <Text dimColor>No results</Text>
      ) : (
        <Box flexDirection="column">
          {groupedItems.map(group => (
            <Box key={group.label} flexDirection="column" marginBottom={1}>
              <Text dimColor bold>
                {group.label}
              </Text>
              {group.items.slice(0, maxVisible).map(({ item, index }) => {
                const isSelected = index === selected
                const label =
                  item.type === 'command' ? item.command.name : item.type === 'page' ? item.title : item.label

                return (
                  <Text key={index}>
                    {isSelected ? <Text color="magenta">{'> '}</Text> : '  '}
                    <Text color={isSelected ? 'magenta' : undefined}>{label}</Text>
                  </Text>
                )
              })}
            </Box>
          ))}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>Enter to select, Esc to close</Text>
      </Box>
    </Box>
  )
}

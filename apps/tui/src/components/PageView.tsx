import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { evalTcl } from '../client.js'
import { parseProcName } from '../commands.js'

// Simple markdown renderer for Ink
function renderMarkdown(content: string) {
  const lines = content.split('\n')
  return lines.map((line, i) => {
    // Headers
    if (line.startsWith('### ')) {
      return (
        <Text key={i} bold color="cyan">
          {line.slice(4)}
        </Text>
      )
    }
    if (line.startsWith('## ')) {
      return (
        <Text key={i} bold color="cyan">
          {line.slice(3)}
        </Text>
      )
    }
    if (line.startsWith('# ')) {
      return (
        <Text key={i} bold color="magenta">
          {line.slice(2)}
        </Text>
      )
    }
    // Code blocks (inline)
    if (line.startsWith('```') || line.startsWith('    ')) {
      return (
        <Text key={i} color="yellow">
          {line}
        </Text>
      )
    }
    // List items
    if (line.match(/^[\-\*]\s/)) {
      return (
        <Text key={i}>
          <Text color="cyan">•</Text> {line.slice(2)}
        </Text>
      )
    }
    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      return <Text key={i}>{line}</Text>
    }
    // Bold **text**
    const boldMatch = line.match(/\*\*(.+?)\*\*/g)
    if (boldMatch) {
      // Simple case - just show the text
      return <Text key={i}>{line.replace(/\*\*(.+?)\*\*/g, '$1')}</Text>
    }
    // Regular text
    return <Text key={i}>{line || ' '}</Text>
  })
}

function TclSnippet({ content, selected, result }) {
  return (
    <Box flexDirection="column" width="100%">
      <Box
        width="100%"
        borderStyle={selected ? 'round' : undefined}
        borderColor={selected ? 'cyan' : undefined}
        paddingX={selected ? 1 : 0}
      >
        <Text>
          <Text color="yellow">tcl</Text>
          <Text color="gray">{' │ '}</Text>
          <Text>{content || '(empty)'}</Text>
        </Text>
      </Box>
      {result && (
        <Box paddingLeft={2} width="100%">
          <Text color={result.type === 'error' ? 'red' : 'green'}>{result.text}</Text>
        </Box>
      )}
    </Box>
  )
}

function MarkdownSnippet({ content, selected }) {
  return (
    <Box
      flexDirection="column"
      width="100%"
      borderStyle={selected ? 'round' : undefined}
      borderColor={selected ? 'cyan' : undefined}
      paddingX={selected ? 1 : 0}
    >
      {content ? renderMarkdown(content) : <Text dimColor>(empty markdown)</Text>}
    </Box>
  )
}

function CommandSnippet({ content, selected, result }) {
  const name = parseProcName(content) || '(unnamed)'
  return (
    <Box flexDirection="column" width="100%">
      <Box>
        <Text backgroundColor={selected ? 'cyan' : 'gray'} color={selected ? 'black' : 'white'} bold>
          {` ${name} `}
        </Text>
        {selected && <Text dimColor> (Enter to run, e to edit)</Text>}
      </Box>
      {result && (
        <Box paddingLeft={2} width="100%">
          <Text color={result.type === 'error' ? 'red' : 'green'}>{result.text}</Text>
        </Box>
      )}
    </Box>
  )
}

interface PageViewProps {
  page: { id: string; title: string; snippets: Array<{ id: string; type: string; content: string }> } | null
  daemonUrl: string
  sessionId?: string
  onPageChange?: (action: { type: string; [key: string]: unknown }) => void
  onEdit?: (index: number) => void
  focused?: boolean
}

export default function PageView({
  page,
  daemonUrl,
  sessionId = 'default',
  onPageChange,
  onEdit,
  focused = true,
}: PageViewProps) {
  const [selected, setSelected] = useState(0)
  const [results, setResults] = useState({})

  const snippets = page?.snippets || []

  const evaluateSnippet = async snippet => {
    if (snippet.type !== 'tcl' && snippet.type !== 'command') return
    try {
      // For commands, we need to define the proc first, then call it
      const script =
        snippet.type === 'command' ? `${snippet.content}\n${parseProcName(snippet.content) || ''}` : snippet.content
      const result = await evalTcl(daemonUrl, script, sessionId)
      const body = result.body as Record<string, unknown>
      if (result.headers?.type === 'bl:///types/eval-result') {
        setResults(prev => ({ ...prev, [snippet.id]: { type: 'output', text: body.result as string } }))
      } else if (result.headers?.type === 'bl:///types/eval-error') {
        setResults(prev => ({ ...prev, [snippet.id]: { type: 'error', text: body.error as string } }))
      } else {
        setResults(prev => ({
          ...prev,
          [snippet.id]: { type: 'output', text: JSON.stringify(result.body, null, 2) },
        }))
      }
    } catch (err) {
      setResults(prev => ({ ...prev, [snippet.id]: { type: 'error', text: err.message } }))
    }
  }

  const evaluateAll = async () => {
    for (const snippet of snippets) {
      if (snippet.type === 'tcl') {
        await evaluateSnippet(snippet)
      }
    }
  }

  useInput(
    (ch, key) => {
      if (!focused) return

      // Navigate snippets
      if (key.upArrow && !key.shift) {
        setSelected(s => Math.max(0, s - 1))
      } else if (key.downArrow && !key.shift) {
        setSelected(s => Math.min(snippets.length - 1, s + 1))
      }

      // Evaluate
      else if (key.return && snippets[selected]) {
        evaluateSnippet(snippets[selected])
      }

      // Ctrl+Enter - evaluate all
      else if (key.ctrl && key.return) {
        evaluateAll()
      }

      // Clear results
      else if (key.ctrl && ch === 'l') {
        setResults({})
      }

      // Edit snippet
      else if (ch === 'e' && snippets[selected]) {
        onEdit?.(selected)
      }

      // Add snippet
      else if (ch === 'a') {
        onPageChange?.({ type: 'add', after: selected })
      }

      // Delete snippet
      else if (ch === 'x' && snippets[selected]) {
        onPageChange?.({ type: 'delete', index: selected })
        setSelected(s => Math.max(0, s - 1))
      }

      // Move snippet up
      else if (key.upArrow && key.shift && selected > 0) {
        onPageChange?.({ type: 'move', from: selected, to: selected - 1 })
        setSelected(s => s - 1)
      }

      // Move snippet down
      else if (key.downArrow && key.shift && selected < snippets.length - 1) {
        onPageChange?.({ type: 'move', from: selected, to: selected + 1 })
        setSelected(s => s + 1)
      }
    },
    { isActive: focused }
  )

  if (!page) {
    return (
      <Box padding={1}>
        <Text dimColor>No page selected</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1} width="100%">
      <Text bold color="cyan">
        {page.title}
      </Text>
      <Box marginTop={1} flexDirection="column" gap={1} width="100%">
        {snippets.map((snippet, i) => {
          const isSelected = focused && i === selected
          if (snippet.type === 'markdown') {
            return <MarkdownSnippet key={snippet.id} content={snippet.content} selected={isSelected} />
          } else if (snippet.type === 'command') {
            return (
              <CommandSnippet
                key={snippet.id}
                content={snippet.content}
                selected={isSelected}
                result={results[snippet.id]}
              />
            )
          } else {
            return (
              <TclSnippet
                key={snippet.id}
                content={snippet.content}
                selected={isSelected}
                result={results[snippet.id]}
              />
            )
          }
        })}
      </Box>
      {snippets.length === 0 && <Text dimColor>No snippets. Press 'a' to add one.</Text>}
    </Box>
  )
}

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { evalTcl } from '../client.js'
import { loadHistory, appendHistory } from '../history.js'

// Check if braces and brackets are balanced
function isComplete(str) {
  let braces = 0,
    brackets = 0
  let inString = false
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch === '\\' && i + 1 < str.length) {
      i++ // skip escaped char
      continue
    }
    if (ch === '"') inString = !inString
    if (inString) continue
    if (ch === '{') braces++
    else if (ch === '}') braces--
    else if (ch === '[') brackets++
    else if (ch === ']') brackets--
  }
  return braces === 0 && brackets === 0
}

interface ReplProps {
  daemonUrl: string
  sessionId?: string
}

export default function Repl({ daemonUrl, sessionId = 'repl' }: ReplProps) {
  const [history, setHistory] = useState([])
  const [input, setInput] = useState('')
  const [continuation, setContinuation] = useState([]) // lines for multi-line input
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [commandHistory, setCommandHistory] = useState(() => loadHistory())

  const handleSubmit = async value => {
    // Combine continuation lines with current input
    const fullInput = [...continuation, value].join('\n')

    // Check if complete
    if (!isComplete(fullInput)) {
      // Continue on next line
      setContinuation([...continuation, value])
      setInput('')
      return
    }

    if (!fullInput.trim()) {
      setContinuation([])
      setInput('')
      return
    }

    // Add to command history (memory + file)
    setCommandHistory(prev => [...prev, fullInput])
    appendHistory(fullInput)
    setHistoryIndex(-1)

    // Add input to display history and clear
    setHistory(prev => [...prev, { type: 'input', text: fullInput }])
    setContinuation([])
    setInput('')

    try {
      const result = await evalTcl(daemonUrl, fullInput, sessionId)
      const body = result.body as Record<string, unknown>
      if (result.headers?.type === 'bl:///types/eval-result') {
        setHistory(prev => [...prev, { type: 'output', text: body.result as string }])
      } else if (result.headers?.type === 'bl:///types/eval-error') {
        setHistory(prev => [...prev, { type: 'error', text: body.error as string }])
      } else {
        setHistory(prev => [...prev, { type: 'output', text: JSON.stringify(result.body, null, 2) }])
      }
    } catch (err) {
      setHistory(prev => [...prev, { type: 'error', text: err.message }])
    }
  }

  // Handle keyboard shortcuts and history navigation
  useInput((ch, key) => {
    // Ctrl+L - clear screen
    if (key.ctrl && ch === 'l') {
      setHistory([])
      return
    }

    // Ctrl+C - cancel current input or exit
    if (key.ctrl && ch === 'c') {
      if (input || continuation.length > 0) {
        // Cancel current input
        setInput('')
        setContinuation([])
        setHistoryIndex(-1)
      } else {
        // Exit
        process.exit(0)
      }
      return
    }

    // Don't allow history navigation during multi-line input
    if (continuation.length > 0) return

    if (key.upArrow && commandHistory.length > 0) {
      const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIndex)
      setInput(commandHistory[newIndex])
    } else if (key.downArrow) {
      if (historyIndex === -1) return
      const newIndex = historyIndex + 1
      if (newIndex >= commandHistory.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(newIndex)
        setInput(commandHistory[newIndex])
      }
    }
  })

  const prompt = continuation.length > 0 ? '  ' : '> '

  return (
    <Box flexDirection="column" paddingX={1}>
      {history.map((item, i) => (
        <Box key={i} flexDirection="column">
          {item.type === 'input' && (
            <Text>
              <Text color="cyan">{'> '}</Text>
              {item.text.split('\n').map((line, j) => (
                <Text key={j}>
                  {j > 0 && '\n  '}
                  {line}
                </Text>
              ))}
            </Text>
          )}
          {item.type === 'output' && <Text color="green">{item.text}</Text>}
          {item.type === 'error' && <Text color="red">{item.text}</Text>}
        </Box>
      ))}
      {continuation.map((line, i) => (
        <Text key={`cont-${i}`}>
          <Text color="cyan">{i === 0 ? '> ' : '  '}</Text>
          {line}
        </Text>
      ))}
      <Box>
        <Text color="cyan">{prompt}</Text>
        <TextInput value={input} onChange={setInput} onSubmit={handleSubmit} />
      </Box>
    </Box>
  )
}

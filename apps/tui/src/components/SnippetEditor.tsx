import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'

export default function SnippetEditor({ snippet, onSave, onCancel }) {
  const [lines, setLines] = useState(snippet.content.split('\n'))
  const [currentLine, setCurrentLine] = useState(0)

  const mergeWithPrevious = () => {
    if (currentLine === 0) return
    const newLines = [...lines]
    const currentContent = newLines[currentLine]
    const prevContent = newLines[currentLine - 1]
    newLines[currentLine - 1] = prevContent + currentContent
    newLines.splice(currentLine, 1)
    setLines(newLines)
    setCurrentLine(l => l - 1)
  }

  const deleteLine = () => {
    if (lines.length <= 1) return
    const newLines = [...lines]
    newLines.splice(currentLine, 1)
    setLines(newLines)
    if (currentLine >= newLines.length) {
      setCurrentLine(newLines.length - 1)
    }
  }

  useInput((ch, key) => {
    // Ctrl+S to save
    if (key.ctrl && ch === 's') {
      onSave(lines.join('\n'))
      return
    }

    // Escape to cancel
    if (key.escape) {
      onCancel()
      return
    }

    // Navigate lines
    if (key.upArrow && currentLine > 0) {
      setCurrentLine(l => l - 1)
    } else if (key.downArrow && currentLine < lines.length - 1) {
      setCurrentLine(l => l + 1)
    }

    // Enter to add new line
    if (key.return && !key.ctrl) {
      const newLines = [...lines]
      newLines.splice(currentLine + 1, 0, '')
      setLines(newLines)
      setCurrentLine(l => l + 1)
    }

    // Ctrl+K to delete current line
    if (key.ctrl && ch === 'k') {
      deleteLine()
    }

    // Backspace/Delete on empty line - merge with previous
    // Note: backspace reports as key.delete on some terminals
    if ((key.backspace || key.delete) && currentLine > 0 && lines[currentLine] === '') {
      mergeWithPrevious()
    }
  })

  const updateLine = (index, value) => {
    const newLines = [...lines]
    newLines[index] = value
    setLines(newLines)
  }

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="yellow" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="yellow">
          Editing {snippet.type} snippet
        </Text>
        <Text dimColor> (Ctrl+S save, Esc cancel)</Text>
      </Box>
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color={i === currentLine ? 'cyan' : 'gray'}>{i === currentLine ? '> ' : '  '}</Text>
          {i === currentLine ? (
            <TextInput value={line} onChange={v => updateLine(i, v)} focus={true} />
          ) : (
            <Text>{line || ' '}</Text>
          )}
        </Box>
      ))}
    </Box>
  )
}

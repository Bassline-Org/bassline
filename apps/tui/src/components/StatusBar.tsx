import React from 'react'
import { Box, Text, useInput } from 'ink'
import { basename } from 'path'

interface StatusBarProps {
  blitPath?: string
  onQuit: () => void
  canQuit?: boolean
}

export default function StatusBar({ blitPath, onQuit, canQuit = true }: StatusBarProps) {
  useInput(input => {
    if (canQuit && input === 'q') {
      onQuit()
    }
  })

  const blitName = blitPath ? basename(blitPath, '.blit') : 'untitled'

  return (
    <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text>
        <Text color="green">●</Text>
        <Text bold color="green">
          {' '}
          {blitName}
        </Text>
        <Text dimColor> │ {blitPath}</Text>
        <Text dimColor> [Ctrl+S] checkpoint [?] help [q] quit</Text>
      </Text>
    </Box>
  )
}

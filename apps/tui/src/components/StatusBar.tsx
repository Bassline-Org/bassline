import React from 'react'
import { Box, Text, useInput } from 'ink'
import { Connection } from '../connections.js'

interface StatusBarProps {
  connection: Connection
  session?: string
  onDisconnect: () => void
  canQuit?: boolean
}

export default function StatusBar({ connection, session = 'default', onDisconnect, canQuit = true }: StatusBarProps) {
  useInput(input => {
    if (canQuit && input === 'q') {
      onDisconnect()
    }
  })

  return (
    <Box borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
      <Text>
        <Text color={connection.color || 'green'}>●</Text>
        <Text bold color={connection.color || 'green'}>
          {' '}
          {connection.name}
        </Text>
        <Text dimColor> │ </Text>
        <Text color="magenta">{session}</Text>
        <Text dimColor> [s] sessions [c] connections [?] help [q] quit</Text>
      </Text>
    </Box>
  )
}

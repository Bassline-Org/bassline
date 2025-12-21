import React, { useState, useEffect } from 'react'
import BlitPicker from './components/BlitPicker.js'
import Workspace from './components/Workspace.js'
import { BlitProvider } from './blit-context.js'

interface BlitState {
  kit: {
    get: (h: { path: string }) => Promise<{ headers: Record<string, unknown>; body: unknown }>
    put: (h: { path: string }, body: unknown) => Promise<{ headers: Record<string, unknown>; body: unknown }>
  }
  path: string
  checkpoint: () => Promise<void>
  close: () => Promise<void>
}

interface AppProps {
  blitPath?: string
}

export default function App({ blitPath }: AppProps) {
  const [blit, setBlit] = useState<BlitState | null>(null)

  // Handle cleanup on exit
  useEffect(() => {
    const cleanup = async () => {
      if (blit) {
        await blit.checkpoint()
        await blit.close()
      }
    }

    // Handle SIGINT (Ctrl+C)
    const handleSigint = async () => {
      await cleanup()
      process.exit(0)
    }

    process.on('SIGINT', handleSigint)

    return () => {
      process.off('SIGINT', handleSigint)
    }
  }, [blit])

  const handleClose = async () => {
    if (blit) {
      await blit.checkpoint()
      await blit.close()
    }
    setBlit(null)
  }

  if (!blit) {
    return <BlitPicker defaultPath={blitPath} onOpen={setBlit} />
  }

  return (
    <BlitProvider value={blit}>
      <Workspace onClose={handleClose} />
    </BlitProvider>
  )
}

/**
 * BorthProvider
 *
 * Context provider for borth runtime.
 */

import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react'
// @ts-expect-error - borth.js has no type declarations
import { createRuntime } from '../lib/borth'

type Runtime = ReturnType<typeof createRuntime>

interface BorthContextValue {
  rt: Runtime
  source: string
  setSource: (src: string) => void
  run: (code?: string) => void
  reset: () => void
  output: {
    stack: unknown[]
    error: string | null
    logs: string[]
  }
}

const BorthContext = createContext<BorthContextValue | null>(null)

// Helper to create a configured runtime with db access
function createConfiguredRuntime() {
  const rt = createRuntime()
  // Expose db for raw queries (only if available in Electron context)
  if (typeof window !== 'undefined' && window.db) {
    rt.expose({ db: window.db })
    // Add query word: "SELECT * FROM x WHERE y = ?" [ param ] query
    rt.def('query', async (params: unknown[], sql: string) => {
      const result = await window.db.query(sql, params)
      if (result.error) throw new Error(result.error)
      return [result.data]
    })
  }
  return rt
}

export function BorthProvider({
  children,
  initialSource = '',
  onSourceChange,
}: {
  children: ReactNode
  initialSource?: string
  onSourceChange?: (source: string) => void
}) {
  const rtRef = useRef<Runtime>(createConfiguredRuntime())
  const [source, setSourceInternal] = useState(initialSource)

  const setSource = useCallback(
    (src: string) => {
      setSourceInternal(src)
      onSourceChange?.(src)
    },
    [onSourceChange]
  )
  const [output, setOutput] = useState<{ stack: unknown[]; error: string | null; logs: string[] }>({
    stack: [],
    error: null,
    logs: [],
  })

  const rt = rtRef.current

  // Run code (defaults to full source)
  const run = useCallback(
    async (code?: string) => {
      const toRun = code ?? source
      if (!toRun.trim()) return

      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args: unknown[]) => {
        logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
      }

      try {
        await rt.run(toRun)
        setOutput({ stack: [...rt.targets.data[0].data], error: null, logs })
      } catch (e) {
        setOutput({
          stack: [...rt.targets.data[0].data],
          error: e instanceof Error ? e.message : String(e),
          logs,
        })
      } finally {
        console.log = originalLog
      }
    },
    [rt, source]
  )

  // Reset runtime
  const reset = useCallback(() => {
    rtRef.current = createConfiguredRuntime()
    setOutput({ stack: [], error: null, logs: [] })
  }, [])

  return (
    <BorthContext.Provider value={{ rt: rtRef.current, source, setSource, run, reset, output }}>
      {children}
    </BorthContext.Provider>
  )
}

export function useBorth() {
  const ctx = useContext(BorthContext)
  if (!ctx) throw new Error('useBorth must be used inside BorthProvider')
  return ctx
}

/**
 * BorthProvider
 *
 * Context provider for borth runtime.
 * - Holds runtime instance
 * - Subscribes to runtime events
 * - Exposes hooks for components
 */

import { createContext, useContext, useRef, useState, useEffect, useCallback, type ReactNode } from 'react'
// @ts-expect-error - borth.js has no type declarations
import { createRuntime } from '../lib/borth'

type Runtime = ReturnType<typeof createRuntime>

interface Part {
  name: string
  data: string
  index: number
}

interface BorthContextValue {
  rt: Runtime
  source: string
  setSource: (src: string) => void
  run: () => void
  runPart: (name: string) => void
  reset: () => void
  parts: Part[]
  output: {
    stack: unknown[]
    error: string | null
    logs: string[]
  }
}

const BorthContext = createContext<BorthContextValue | null>(null)

export function BorthProvider({
  children,
  initialSource = '',
  onSourceChange,
}: {
  children: ReactNode
  initialSource?: string
  onSourceChange?: (src: string) => void
}) {
  const rtRef = useRef<Runtime>(createRuntime())
  const [source, setSourceState] = useState(initialSource)
  const [parts, setParts] = useState<Part[]>([])
  const [output, setOutput] = useState<{ stack: unknown[]; error: string | null; logs: string[] }>({
    stack: [],
    error: null,
    logs: [],
  })

  const rt = rtRef.current

  // Helper to get sorted parts array
  const getSortedParts = (): Part[] => {
    return (Object.values(rt.parts) as Part[]).sort((a, b) => a.index - b.index)
  }

  // Subscribe to runtime events
  useEffect(() => {
    const unsubs = [
      rt.on('part:changed', () => {
        const newSource = rt.toSource()
        setSourceState(newSource)
        onSourceChange?.(newSource)
        setParts(getSortedParts())
      }),
      rt.on('present:complete', () => {
        setParts(getSortedParts())
      }),
    ]
    return () => unsubs.forEach((fn: () => void) => fn())
  }, [rt, onSourceChange])

  // Parse source into parts (present mode only, no execution)
  const setSource = useCallback(
    (src: string) => {
      rt.present(src)
      setSourceState(src)
    },
    [rt]
  )

  // Initialize on mount
  useEffect(() => {
    if (initialSource) {
      setSource(initialSource)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Run all parts in order
  const run = useCallback(() => {
    rt.ds.data = []
    const logs: string[] = []
    const originalLog = console.log
    console.log = (...args: unknown[]) => {
      logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
    }

    try {
      for (const part of getSortedParts()) {
        rt.run(part.data)
      }
      setOutput({ stack: [...rt.ds.data], error: null, logs })
    } catch (e) {
      setOutput({
        stack: [...rt.ds.data],
        error: e instanceof Error ? e.message : String(e),
        logs,
      })
    } finally {
      console.log = originalLog
    }
  }, [rt])

  // Run a single part
  const runPart = useCallback(
    (name: string) => {
      const part = rt.parts[name]
      if (!part) return

      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args: unknown[]) => {
        logs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '))
      }

      try {
        rt.run(part.data)
        setOutput({ stack: [...rt.ds.data], error: null, logs })
      } catch (e) {
        setOutput({
          stack: [...rt.ds.data],
          error: e instanceof Error ? e.message : String(e),
          logs,
        })
      } finally {
        console.log = originalLog
      }
    },
    [rt]
  )

  // Reset runtime completely
  const reset = useCallback(() => {
    rtRef.current = createRuntime()
    setOutput({ stack: [], error: null, logs: [] })
    setParts([])
    if (source) {
      rtRef.current.present(source)
      setParts((Object.values(rtRef.current.parts) as Part[]).sort((a, b) => a.index - b.index))
    }
  }, [source])

  return (
    <BorthContext.Provider value={{ rt, source, setSource, run, runPart, reset, parts, output }}>
      {children}
    </BorthContext.Provider>
  )
}

export function useBorth() {
  const ctx = useContext(BorthContext)
  if (!ctx) throw new Error('useBorth must be used inside BorthProvider')
  return ctx
}

// Hook for subscribing to specific runtime events
export function useBorthEvent(event: string, handler: (data: unknown) => void) {
  const { rt } = useBorth()
  useEffect(() => rt.on(event, handler), [rt, event, handler])
}

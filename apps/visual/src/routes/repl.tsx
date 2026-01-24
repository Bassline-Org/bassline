import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useBorth } from '@/components/BorthProvider'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Play, Trash2, RotateCcw } from 'lucide-react'
import { timing } from '@/lib/motion'

const EXAMPLE_CODE = `using: ui ;

( Prompt for name, build greeting )
" Hello, " " What is your name?" prompt " !" 3 take "" join

( Ask if they want to continue )
" Do you want to continue?" confirm
" User said yes" " User said no" if`

export function Repl() {
  const { rt } = useBorth()
  const [code, setCode] = useState(EXAMPLE_CODE)
  const [stack, setStack] = useState<unknown[]>([])
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const handleRun = useCallback(async () => {
    setRunning(true)
    setLog(prev => [...prev, '> Running...'])
    const start = performance.now()

    // Push a fresh stack for this REPL execution
    const prevMode = (rt as any).mode
    ;(rt as any).mode = 'interp'
    ;(rt as any).pushTarget()

    try {
      await (rt as any).run(code)
      const elapsed = (performance.now() - start).toFixed(1)
      setLog(prev => [...prev, `> Complete (${elapsed}ms)`])
      // Read stack before popping
      setStack([...(rt as any).target.data])
    } catch (err) {
      console.error('REPL error:', err)
      setLog(prev => [...prev, `> Error: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      ;(rt as any).popTarget()
      ;(rt as any).mode = prevMode
      setRunning(false)
    }
  }, [code, rt])

  const handleClearStack = useCallback(() => {
    setStack([])
  }, [])

  const handleClearLog = useCallback(() => {
    setLog([])
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleRun()
    }
  }

  return (
    <motion.div
      className="h-screen flex flex-col p-6 gap-4 bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: timing.fast }}
    >
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">REPL - Borth Test Bed</h1>
        <Button variant="ghost" size="sm" onClick={handleClearLog}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Clear Log
        </Button>
      </div>

      {/* Code editor */}
      <div className="flex-1 min-h-0">
        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full font-mono text-sm resize-none"
          placeholder="Enter borth code..."
        />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        <Button onClick={handleRun} disabled={running}>
          <Play className="h-4 w-4 mr-2" />
          Run
        </Button>
        <Button variant="outline" onClick={handleClearStack}>
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Stack
        </Button>
        <span className="text-xs text-muted-foreground self-center ml-2">
          Cmd+Enter to run
        </span>
      </div>

      {/* Stack inspector */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-2">Stack ({stack.length})</h2>
        <ScrollArea className="h-32">
          {stack.length === 0 ? (
            <div className="text-muted-foreground text-sm">Empty</div>
          ) : (
            <div className="font-mono text-sm space-y-1">
              {stack.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground w-6">{i}:</span>
                  <span>{formatValue(item)}</span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Log */}
      <div className="border rounded-lg p-4">
        <h2 className="text-sm font-medium mb-2">Log</h2>
        <ScrollArea className="h-24">
          <div className="font-mono text-xs space-y-0.5">
            {log.map((line, i) => (
              <div key={i} className="text-muted-foreground">{line}</div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  )
}

function formatValue(v: unknown): string {
  if (v === null) return 'null'
  if (v === undefined) return 'undefined'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return `[${v.map(formatValue).join(', ')}]`
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    // Handle Word objects (have rt property which creates circular ref)
    if ('rt' in obj && 'attributes' in obj) {
      const name = (obj.attributes as Record<string, unknown>)?.name
      const type = (obj.attributes as Record<string, unknown>)?.type
      return name ? `<${type}:${name}>` : `<${type}>`
    }
    // Safe stringify with circular ref protection
    try {
      return JSON.stringify(v)
    } catch {
      return `<object>`
    }
  }
  return String(v)
}

export default Repl

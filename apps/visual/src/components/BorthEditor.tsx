/**
 * BorthEditor
 *
 * Simple editor for borth scripts.
 * - Textarea for code
 * - Stack display panel
 * - Run / Run Selection / Reset
 */

import { useRef, useCallback, type KeyboardEvent } from 'react'
import { useBorth } from './BorthProvider'
import { StackInspector } from './ValueInspector'
import { Button } from '@/components/ui/button'
import { Play, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BorthEditorProps {
  className?: string
}

export function BorthEditor({ className }: BorthEditorProps) {
  const { source, setSource, run, reset, output } = useBorth()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Run full source
  const runAll = useCallback(() => {
    run()
  }, [run])

  // Run selected text only
  const runSelection = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd

    if (start === end) {
      // No selection - run all
      run()
    } else {
      const selected = source.slice(start, end)
      run(selected)
    }
  }, [run, source])

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd/Ctrl+Enter = run selection (or all if nothing selected)
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        runSelection()
      }
      // Tab = insert spaces
      if (e.key === 'Tab') {
        e.preventDefault()
        const target = e.currentTarget
        const start = target.selectionStart
        const end = target.selectionEnd
        const newValue = source.slice(0, start) + '  ' + source.slice(end)
        setSource(newValue)
        requestAnimationFrame(() => {
          target.selectionStart = target.selectionEnd = start + 2
        })
      }
    },
    [source, setSource, runSelection]
  )

  return (
    <div className={cn('borth-editor flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
        <Button size="sm" onClick={runAll}>
          <Play className="h-4 w-4 mr-1" />
          Run
        </Button>
        <Button size="sm" variant="outline" onClick={runSelection}>
          <Play className="h-4 w-4 mr-1" />
          Run Selection
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to run
        </span>
      </div>

      {/* Main content: code + stack */}
      <div className="flex-1 flex min-h-0">
        {/* Code textarea */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={source}
            onChange={e => setSource(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full h-full p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            placeholder="Enter borth code..."
            spellCheck={false}
          />
        </div>

        {/* Stack panel */}
        <div className="w-72 border-l border-border bg-muted/20 flex flex-col">
          <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground flex items-center justify-between">
            <span>Stack</span>
            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
              {output.stack.length}
            </span>
          </div>
          <div className="flex-1 overflow-auto">
            <StackInspector stack={output.stack} />
          </div>
        </div>
      </div>

      {/* Output panel: error + logs */}
      <div className="border-t border-border bg-muted/30 max-h-32 overflow-auto">
        {output.error && (
          <div className="px-3 py-2 text-destructive text-sm border-b border-destructive/20 bg-destructive/10">
            {output.error}
          </div>
        )}
        {output.logs.length > 0 && (
          <div className="p-2 space-y-1">
            {output.logs.map((log, i) => (
              <div key={i} className="text-xs text-muted-foreground font-mono">
                {log}
              </div>
            ))}
          </div>
        )}
        {!output.error && output.logs.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">No output</div>
        )}
      </div>
    </div>
  )
}

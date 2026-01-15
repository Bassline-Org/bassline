/**
 * BorthEditor
 *
 * A minimal editor for borth scripts.
 * Uses BorthProvider for runtime state management.
 */

import { useState, useCallback, type KeyboardEvent } from 'react'
// @ts-expect-error - borth.js has no type declarations
import { word } from '../lib/borth'
import { useBorth } from './BorthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Play, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

// UI element types (stored in word.data)
const UI_TYPES = ['text', 'number', 'button', 'checkbox', 'select', 'display', 'label'] as const
type UIType = (typeof UI_TYPES)[number]

interface UIElementData {
  id: string
  type: UIType
  read?: () => unknown
  write?: (v: unknown) => void
}

interface DictWord {
  data?: UIElementData
  attributes?: Record<string, unknown>
  interp?: () => void
}

type Runtime = ReturnType<typeof useBorth>['rt']

function getUIElements(rt: Runtime): Array<{ name: string; data: UIElementData; attrs: Record<string, unknown> }> {
  return Object.entries(rt.dict as Record<string, DictWord>)
    .filter(([, w]) => w.data?.type && UI_TYPES.includes(w.data.type))
    .map(([name, w]) => ({
      name,
      data: w.data as UIElementData,
      attrs: w.attributes || {},
    }))
}

function UIElementRenderer({
  name,
  data,
  attrs,
  value,
  rt,
}: {
  name: string
  data: UIElementData
  attrs: Record<string, unknown>
  value: unknown
  rt: Runtime
}) {
  const label = String(attrs.label ?? name)
  const placeholder = String(attrs.placeholder ?? '')

  if (data.type === 'text') {
    return (
      <div className="ui-field flex items-center gap-2">
        <label className="text-sm text-muted-foreground min-w-24">{label}</label>
        <Input
          type="text"
          value={String(value ?? '')}
          placeholder={placeholder}
          onChange={e => data.write?.(e.target.value)}
          className="flex-1"
        />
      </div>
    )
  }

  if (data.type === 'number') {
    const min = attrs.min as number | undefined
    const max = attrs.max as number | undefined
    return (
      <div className="ui-field flex items-center gap-2">
        <label className="text-sm text-muted-foreground min-w-24">{label}</label>
        <Input
          type="number"
          value={Number(value ?? 0)}
          min={min}
          max={max}
          onChange={e => data.write?.(Number(e.target.value))}
          className="flex-1"
        />
      </div>
    )
  }

  if (data.type === 'button') {
    const handler = attrs.handler as string | undefined
    return (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          const dict = rt.dict as Record<string, DictWord>
          if (handler && dict[handler]) {
            dict[handler].interp?.()
          }
        }}
      >
        {label}
      </Button>
    )
  }

  if (data.type === 'checkbox') {
    return (
      <div className="ui-field flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => data.write?.(e.target.checked)}
          className="h-4 w-4"
        />
        <label className="text-sm">{label}</label>
      </div>
    )
  }

  if (data.type === 'display') {
    return (
      <div className="ui-field flex items-center gap-2">
        <label className="text-sm text-muted-foreground min-w-24">{label}</label>
        <span className="text-sm font-mono">{String(value ?? '')}</span>
      </div>
    )
  }

  if (data.type === 'label') {
    return (
      <div className="ui-field">
        <span className="text-sm font-medium">{label}</span>
      </div>
    )
  }

  return null
}

export interface BorthEditorProps {
  className?: string
}

export function BorthEditor({ className }: BorthEditorProps) {
  const { rt, source, setSource, run, runPart, reset, parts, output } = useBorth()

  // UI element values (local state for reactivity)
  const [values, setValues] = useState<Record<string, unknown>>({})

  // Install UI bindings on first render (idempotent)
  if (!rt.dict['text-input:']) {
    installEditorBindings(rt, {
      read: id => values[id],
      write: (id, v) => setValues(prev => ({ ...prev, [id]: v })),
    })
  }

  // Collapsed state for parts
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCollapse = useCallback((name: string) => {
    setCollapsed(prev => ({ ...prev, [name]: !prev[name] }))
  }, [])

  // Update part content
  const updatePart = useCallback(
    (name: string, data: string) => {
      rt.updatePart(name, data)
    },
    [rt]
  )

  // Handle source textarea change (when no parts)
  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSource(e.target.value)
    },
    [setSource]
  )

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        run()
      }
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
    [source, setSource, run]
  )

  // Get UI elements from dictionary
  const uiElements = getUIElements(rt)

  return (
    <div className={cn('borth-editor flex flex-col h-full', className)}>
      {/* Toolbar */}
      <div className="borth-editor__toolbar flex items-center gap-2 p-2 border-b border-border">
        <Button size="sm" onClick={run}>
          <Play className="h-4 w-4 mr-1" />
          Run
        </Button>
        <Button size="sm" variant="outline" onClick={reset}>
          <RotateCcw className="h-4 w-4 mr-1" />
          Reset
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to run
        </span>
      </div>

      {/* Source editor - shows cells if parts exist, otherwise full textarea */}
      <div className="borth-editor__source flex-1 min-h-0 overflow-y-auto">
        {parts.length > 0 ? (
          <div className="space-y-0">
            {parts.map(part => {
              const isCollapsed = collapsed[part.name]
              return (
                <div key={part.name} className="border-b border-border">
                  {/* Part header */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-muted/30 cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleCollapse(part.name)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium flex-1">{part.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={e => {
                        e.stopPropagation()
                        runPart(part.name)
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </div>
                  {/* Part content */}
                  {!isCollapsed && (
                    <textarea
                      value={part.data}
                      onChange={e => updatePart(part.name, e.target.value)}
                      className="w-full p-3 font-mono text-sm bg-background resize-none focus:outline-none min-h-[80px]"
                      placeholder={`${part.name} code...`}
                      spellCheck={false}
                      rows={Math.max(3, part.data.split('\n').length)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <textarea
            value={source}
            onChange={handleSourceChange}
            onKeyDown={handleKeyDown}
            className="w-full h-full p-3 font-mono text-sm bg-background resize-none focus:outline-none"
            placeholder="Enter borth code..."
            spellCheck={false}
          />
        )}
      </div>

      {/* UI elements from borth */}
      {uiElements.length > 0 && (
        <div className="borth-editor__ui border-t border-border p-3 space-y-2">
          {uiElements.map(({ name, data, attrs }) => (
            <UIElementRenderer key={data.id} name={name} data={data} attrs={attrs} value={values[data.id]} rt={rt} />
          ))}
        </div>
      )}

      {/* Output panel */}
      <div className="borth-editor__output border-t border-border p-3 bg-muted/30 max-h-48 overflow-auto">
        {output.error && <div className="text-destructive text-sm mb-2">Error: {output.error}</div>}
        {output.logs.length > 0 && (
          <div className="text-sm mb-2 space-y-1">
            {output.logs.map((log, i) => (
              <div key={i} className="text-muted-foreground font-mono">
                {log}
              </div>
            ))}
          </div>
        )}
        <div className="text-sm">
          <span className="text-muted-foreground">Stack:</span>{' '}
          <span className="font-mono">
            [
            {output.stack.map((v, i) => (
              <span key={i}>
                {i > 0 && ', '}
                {typeof v === 'string' ? `"${v}"` : JSON.stringify(v)}
              </span>
            ))}
            ]
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Install editor-specific bindings into the runtime.
 * UI elements are created as words in the dictionary.
 */
function installEditorBindings(rt: Runtime, ui: { read: (id: string) => unknown; write: (id: string, v: unknown) => void }) {
  let elementId = 0

  const makeUIElement = (type: UIType) => {
    const name = rt.parse(/\s/.test.bind(/\s/))
    const id = `el-${elementId++}`

    const element: UIElementData = {
      id,
      type,
      read() {
        return ui.read(id)
      },
      write(v) {
        ui.write(id, v)
      },
    }

    word.make(rt, {
      name,
      data: element,
      interp() {
        rt.ds.write(this.data)
      },
    })
  }

  word.make(rt, {
    name: 'text-input:',
    interp() {
      makeUIElement('text')
    },
  })

  word.make(rt, {
    name: 'number-input:',
    interp() {
      makeUIElement('number')
    },
  })

  word.make(rt, {
    name: 'button:',
    interp() {
      makeUIElement('button')
    },
  })

  word.make(rt, {
    name: 'checkbox:',
    interp() {
      makeUIElement('checkbox')
    },
  })

  word.make(rt, {
    name: 'display:',
    interp() {
      makeUIElement('display')
    },
  })

  word.make(rt, {
    name: 'label:',
    interp() {
      makeUIElement('label')
    },
  })
}

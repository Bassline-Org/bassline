/**
 * Resource Semantic
 *
 * Universal bridge between data objects and Bassline resources.
 * Calls a resource for each input DataObject, storing the response in `body`.
 *
 * Configuration:
 * - resource.path = resource path (e.g., "/shell")
 * - resource.auto = "true" to auto-execute on input change
 *
 * Shell-specific:
 * - shell.cmd = command template with {{attr}} interpolation
 * - shell.cwd = working directory template (optional)
 *
 * Output:
 * - Each input DataObject is decorated with a typed `body` containing the response
 * - For shell responses: body = { stdout, stderr, code }
 */

import { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import { Play, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EntityWithAttrs, DataObject, AttrValue } from '../types'
import { attrString, getAttr } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useSemanticOutput } from '../hooks/useSemanticOutput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'
import type { EditorLoaderData } from '../types'

interface ResourceSemanticProps {
  entity: EntityWithAttrs
}

type ExecutionStatus = 'idle' | 'running' | 'success' | 'error'

// Available resources
const AVAILABLE_RESOURCES = [
  { path: '/shell', name: 'Shell', description: 'Execute shell commands' },
]

// Interpolate {{attr}} placeholders in a string
function interpolate(template: string, attrs: DataObject): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, attrName) => {
    const trimmed = attrName.trim()
    return attrString(attrs[trimmed])
  })
}

// Local input that persists on blur
function LocalInput({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string
  onCommit: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const [local, setLocal] = useState(value)
  useEffect(() => setLocal(value), [value])

  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) onCommit(local)
      }}
      placeholder={placeholder}
      className={className}
    />
  )
}

export function ResourceSemantic({ entity }: ResourceSemanticProps) {
  const { project } = useLoaderData() as EditorLoaderData
  const { inputData, inputRelationships } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()

  // Execution state
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [results, setResults] = useState<Map<string, AttrValue>>(new Map())
  const [error, setError] = useState<string | null>(null)

  // Get configuration (use getAttr for string config values)
  const resourcePath = getAttr(entity.attrs, 'resource.path', '/shell')
  const autoExecute = getAttr(entity.attrs, 'resource.auto') === 'true'

  // Shell-specific config
  const shellCmd = getAttr(entity.attrs, 'shell.cmd')
  const shellCwd = getAttr(entity.attrs, 'shell.cwd')

  // Build request body based on resource type
  const buildRequestBody = useCallback(
    (attrs: DataObject) => {
      if (resourcePath === '/shell') {
        const body: { cmd: string; cwd?: string } = {
          cmd: interpolate(shellCmd, attrs),
        }
        if (shellCwd) {
          body.cwd = interpolate(shellCwd, attrs)
        }
        return body
      }
      // Generic fallback
      return {}
    },
    [resourcePath, shellCmd, shellCwd]
  )

  // Build output data with results attached
  // Output is DataObject[] - each input gets a `body` with the typed response
  const outputData = useMemo((): DataObject[] => {
    // Standalone mode: output the Resource entity's attrs with result attached
    if (inputData.length === 0 && results.has('_standalone')) {
      const result = results.get('_standalone')!
      return [{
        ...entity.attrs,
        body: result, // Typed response body - not stringified!
      }]
    }

    // Per-entity mode: attach results to each input DataObject
    return inputData.map((data) => {
      const id = typeof data.id === 'string' ? data.id : undefined
      const result = id ? results.get(id) : undefined
      if (result === undefined) return data
      return {
        ...data,
        body: result, // Typed response body - not stringified!
      }
    })
  }, [entity.attrs, inputData, results])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    data: outputData,
    relationships: inputRelationships,
  })

  // Execute resource - either per-entity or standalone
  const execute = useCallback(async () => {
    if (resourcePath === '/shell' && !shellCmd) return

    setStatus('running')
    setError(null)
    const newResults = new Map<string, AttrValue>()

    // Helper to extract result from response - returns typed value, not stringified
    const extractResult = (response: { headers: Record<string, unknown>; body: unknown }): AttrValue => {
      if (response.headers.condition === 'error') {
        throw new Error(
          typeof response.body === 'object' && response.body !== null
            ? JSON.stringify(response.body)
            : String(response.body)
        )
      }
      // Return the full response body as typed value
      // For shell: { stdout, stderr, code }
      return response.body as AttrValue
    }

    try {
      if (inputData.length === 0) {
        // Standalone execution - run once with empty attrs
        const body = buildRequestBody({})
        const response = await window.bl.put({ path: resourcePath }, body)
        const result = extractResult(response)
        newResults.set('_standalone', result)

        // Persist result to the Resource entity as typed body
        await bl.attrs.set(project.id, entity.id, 'body', result, 'json')
      } else {
        // Per-entity execution - run for each input
        for (const input of inputData) {
          const id = typeof input.id === 'string' ? input.id : `_${inputData.indexOf(input)}`
          const body = buildRequestBody(input)
          const response = await window.bl.put({ path: resourcePath }, body)
          const result = extractResult(response)
          newResults.set(id, result)
        }

        // Persist last result to the Resource entity as typed body (for display)
        if (newResults.size > 0) {
          const lastResult = Array.from(newResults.values()).pop()
          if (lastResult) {
            await bl.attrs.set(project.id, entity.id, 'body', lastResult, 'json')
          }
        }
      }

      setResults(newResults)
      setStatus('success')
      revalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [inputData, resourcePath, shellCmd, buildRequestBody, bl, project.id, entity.id, revalidate])

  // Track previous input data IDs to detect actual changes
  const prevInputKeyRef = useRef<string>('')

  // Auto-execute when inputs change (if enabled)
  // Uses structural comparison to avoid infinite loops
  useEffect(() => {
    if (!autoExecute || !shellCmd) return

    // Create stable key from input data IDs
    const inputKey = inputData
      .map(d => typeof d.id === 'string' ? d.id : '')
      .filter(Boolean)
      .sort()
      .join(',')

    // Only execute if inputs actually changed
    if (inputKey !== prevInputKeyRef.current) {
      prevInputKeyRef.current = inputKey
      if (inputData.length > 0) {
        execute()
      }
    }
  }, [autoExecute, shellCmd, inputData, execute])

  // Update configuration handlers
  const handlePathChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'resource.path', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleCmdChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'shell.cmd', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleCwdChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'shell.cwd', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  const handleAutoChange = useCallback(
    async (checked: boolean) => {
      await bl.attrs.set(project.id, entity.id, 'resource.auto', checked ? 'true' : 'false')
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Status icon
  const StatusIcon = () => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="resource-semantic">
      <div className="resource-semantic__config">
        <div className="resource-semantic__field">
          <Label className="resource-semantic__label">Resource</Label>
          <Select value={resourcePath} onValueChange={handlePathChange}>
            <SelectTrigger className="resource-semantic__select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AVAILABLE_RESOURCES.map((r) => (
                <SelectItem key={r.path} value={r.path}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {resourcePath === '/shell' && (
          <>
            <div className="resource-semantic__field">
              <Label className="resource-semantic__label">Command</Label>
              <LocalInput
                value={shellCmd}
                onCommit={handleCmdChange}
                placeholder="cat {{filepath}}"
                className="resource-semantic__cmd"
              />
              <div className="resource-semantic__hint">
                Use {'{{attr}}'} to interpolate entity attributes
              </div>
            </div>

            <div className="resource-semantic__field">
              <Label className="resource-semantic__label">Working directory (optional)</Label>
              <LocalInput
                value={shellCwd}
                onCommit={handleCwdChange}
                placeholder="{{project.path}}"
                className="resource-semantic__cwd"
              />
            </div>
          </>
        )}

        <div className="resource-semantic__row">
          <div className="resource-semantic__field resource-semantic__field--inline">
            <Label className="resource-semantic__label">Auto:</Label>
            <Switch checked={autoExecute} onCheckedChange={handleAutoChange} />
          </div>
        </div>
      </div>

      <div className="resource-semantic__actions">
        <Button
          onClick={execute}
          disabled={status === 'running' || !shellCmd}
          className="resource-semantic__run"
        >
          {status === 'running' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {inputData.length > 0 ? `Run (${inputData.length})` : 'Run'}
        </Button>
        <StatusIcon />
      </div>

      {error && <div className="resource-semantic__error">{error}</div>}

      {results.size > 0 && (
        <div className="resource-semantic__results">
          <div className="resource-semantic__results-header">
            Results ({results.size})
          </div>
          <div className="resource-semantic__results-list">
            {results.has('_standalone') ? (
              // Standalone result - display stdout from the typed body
              <div className="resource-semantic__result">
                <div className="resource-semantic__result-name">Output</div>
                <pre className="resource-semantic__result-output">
                  {(() => {
                    const result = results.get('_standalone')
                    // Extract stdout if shell response, otherwise stringify
                    const output = typeof result === 'object' && result !== null && 'stdout' in result
                      ? (result as { stdout: string }).stdout
                      : attrString(result)
                    return output.length > 200 ? output.slice(0, 200) + '...' : output
                  })()}
                </pre>
              </div>
            ) : (
              // Per-data results - display body.stdout from each output
              <>
                {outputData.slice(0, 3).map((data, i) => {
                  const id = typeof data.id === 'string' ? data.id : `_${i}`
                  const body = data.body
                  // Extract stdout if shell response
                  const output = typeof body === 'object' && body !== null && 'stdout' in body
                    ? (body as { stdout: string }).stdout
                    : attrString(body)
                  return (
                    <div key={id} className="resource-semantic__result">
                      <div className="resource-semantic__result-name">
                        {attrString(data.name) || id.slice(0, 8)}
                      </div>
                      <pre className="resource-semantic__result-output">
                        {output
                          ? output.length > 200
                            ? output.slice(0, 200) + '...'
                            : output
                          : '(empty)'}
                      </pre>
                    </div>
                  )
                })}
                {results.size > 3 && (
                  <div className="resource-semantic__more">+{results.size - 3} more</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {inputData.length === 0 && results.size === 0 && (
        <div className="resource-semantic__empty">
          Enter a command and click Run, or bind entities for per-entity execution.
        </div>
      )}
    </div>
  )
}

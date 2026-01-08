/**
 * Resource Semantic
 *
 * Universal bridge between entities and Bassline resources.
 * Calls a resource for each input entity, storing the response as an attribute.
 *
 * Configuration:
 * - resource.path = resource path (e.g., "/shell")
 * - resource.output = attr name to store response (default: "resource.result")
 * - resource.auto = "true" to auto-execute on input change
 *
 * Shell-specific:
 * - shell.cmd = command template with {{attr}} interpolation
 * - shell.cwd = working directory template (optional)
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
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
import type { EntityWithAttrs } from '../types'
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
function interpolate(template: string, attrs: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, attrName) => {
    const trimmed = attrName.trim()
    return attrs[trimmed] ?? ''
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
  const { inputEntities, inputRelationships } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()

  // Execution state
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [results, setResults] = useState<Map<string, unknown>>(new Map())
  const [error, setError] = useState<string | null>(null)

  // Get configuration
  const resourcePath = entity.attrs['resource.path'] || '/shell'
  const outputAttr = entity.attrs['resource.output'] || 'resource.result'
  const autoExecute = entity.attrs['resource.auto'] === 'true'

  // Shell-specific config
  const shellCmd = entity.attrs['shell.cmd'] || ''
  const shellCwd = entity.attrs['shell.cwd'] || ''

  // Build request body based on resource type
  const buildRequestBody = useCallback(
    (attrs: Record<string, string>) => {
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

  // Build output entities with results attached
  const outputEntities = useMemo(() => {
    // Standalone mode: output the Resource entity itself with result attached
    if (inputEntities.length === 0 && results.has('_standalone')) {
      const result = results.get('_standalone')
      return [{
        ...entity,
        attrs: {
          ...entity.attrs,
          [outputAttr]: typeof result === 'string' ? result : JSON.stringify(result),
        },
      }]
    }

    // Per-entity mode: attach results to each input entity
    return inputEntities.map((e) => {
      const result = results.get(e.id)
      if (result === undefined) return e
      return {
        ...e,
        attrs: {
          ...e.attrs,
          [outputAttr]: typeof result === 'string' ? result : JSON.stringify(result),
        },
      }
    })
  }, [entity, inputEntities, results, outputAttr])

  // Register output for downstream composition
  useSemanticOutput(entity.id, {
    entities: outputEntities,
    relationships: inputRelationships,
  })

  // Execute resource - either per-entity or standalone
  const execute = useCallback(async () => {
    if (resourcePath === '/shell' && !shellCmd) return

    setStatus('running')
    setError(null)
    const newResults = new Map<string, unknown>()

    // Helper to extract result from response
    const extractResult = (response: { headers: Record<string, unknown>; body: unknown }) => {
      if (response.headers.condition === 'error') {
        throw new Error(
          typeof response.body === 'object' && response.body !== null
            ? JSON.stringify(response.body)
            : String(response.body)
        )
      }
      // Extract stdout if it's a shell response, otherwise use full body
      return typeof response.body === 'object' &&
        response.body !== null &&
        'stdout' in response.body
        ? (response.body as { stdout: string }).stdout
        : response.body
    }

    try {
      if (inputEntities.length === 0) {
        // Standalone execution - run once with empty attrs
        const body = buildRequestBody({})
        const response = await window.bl.put({ path: resourcePath }, body)
        const result = extractResult(response)
        newResults.set('_standalone', result)
      } else {
        // Per-entity execution
        for (const inputEntity of inputEntities) {
          const body = buildRequestBody(inputEntity.attrs)
          const response = await window.bl.put({ path: resourcePath }, body)
          const result = extractResult(response)
          newResults.set(inputEntity.id, result)
        }
      }

      setResults(newResults)
      setStatus('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [inputEntities, resourcePath, shellCmd, buildRequestBody])

  // Auto-execute when inputs change (if enabled)
  useEffect(() => {
    if (autoExecute && inputEntities.length > 0 && shellCmd) {
      execute()
    }
  }, [autoExecute, inputEntities, shellCmd, execute])

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

  const handleOutputChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'resource.output', value)
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
            <Label className="resource-semantic__label">Output attr:</Label>
            <LocalInput
              value={outputAttr}
              onCommit={handleOutputChange}
              placeholder="resource.result"
              className="resource-semantic__output"
            />
          </div>

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
          {inputEntities.length > 0 ? `Run (${inputEntities.length})` : 'Run'}
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
              // Standalone result
              <div className="resource-semantic__result">
                <div className="resource-semantic__result-name">Output</div>
                <pre className="resource-semantic__result-output">
                  {(() => {
                    const result = results.get('_standalone')
                    const str = typeof result === 'string' ? result : JSON.stringify(result)
                    return str.length > 200 ? str.slice(0, 200) + '...' : str
                  })()}
                </pre>
              </div>
            ) : (
              // Per-entity results
              <>
                {outputEntities.slice(0, 3).map((e) => {
                  const result = e.attrs[outputAttr]
                  return (
                    <div key={e.id} className="resource-semantic__result">
                      <div className="resource-semantic__result-name">
                        {e.attrs.name || e.id.slice(0, 8)}
                      </div>
                      <pre className="resource-semantic__result-output">
                        {result
                          ? result.length > 200
                            ? result.slice(0, 200) + '...'
                            : result
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

      {inputEntities.length === 0 && results.size === 0 && (
        <div className="resource-semantic__empty">
          Enter a command and click Run, or bind entities for per-entity execution.
        </div>
      )}
    </div>
  )
}

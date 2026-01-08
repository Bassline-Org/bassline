/**
 * Reflect Semantic
 *
 * Materializes input entities into the project graph.
 * Takes entities from upstream semantics and creates real entities in the database.
 *
 * This is the "write" operation that complements Filter's "read" operation,
 * completing the graph transformation pattern:
 *   Filter (query) → Transform → Reflect
 *
 * Configuration:
 * - reflect.mode = "create" | "update" | "sync" (default: "create")
 * - reflect.target = entity-id | "" (parent for new entities, empty = root)
 * - reflect.matchAttr = attribute name for matching in update/sync mode (default: "name")
 *
 * Modes:
 * - create: Always create new entities from inputs
 * - update: Update existing entities if they match by matchAttr, create if not found
 * - sync: Full sync - create, update, AND delete entities not in inputs
 */

import { useMemo, useCallback, useState } from 'react'
import { RefreshCw, Loader2, CheckCircle, XCircle, Plus, Edit, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EntityWithAttrs, EditorLoaderData } from '../types'
import { useSemanticInput } from '../hooks/useSemanticInput'
import { useBl } from '../hooks/useBl'
import { useLoaderData } from 'react-router'

interface ReflectSemanticProps {
  entity: EntityWithAttrs
}

type ReflectMode = 'create' | 'update' | 'sync'
type ExecutionStatus = 'idle' | 'running' | 'success' | 'error'

export function ReflectSemantic({ entity }: ReflectSemanticProps) {
  const { project, entities: allEntities } = useLoaderData() as EditorLoaderData
  const { inputEntities } = useSemanticInput(entity)
  const { bl, revalidate } = useBl()

  // Execution state
  const [status, setStatus] = useState<ExecutionStatus>('idle')
  const [lastResult, setLastResult] = useState<{ created: number; updated: number; deleted: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Configuration
  const mode = (entity.attrs['reflect.mode'] || 'create') as ReflectMode
  const targetId = entity.attrs['reflect.target'] || ''
  const matchAttr = entity.attrs['reflect.matchAttr'] || 'name'

  // Get target entity name for display
  const targetEntity = useMemo(() => {
    if (!targetId) return null
    return allEntities.find(e => e.id === targetId)
  }, [targetId, allEntities])

  // For update/sync mode: find existing entities that could match
  const existingMatches = useMemo(() => {
    if (mode === 'create') return new Map<string, EntityWithAttrs>()

    // Find entities that are children of target (or root-level if no target)
    const candidates = allEntities.filter(e => {
      if (e.id === entity.id) return false
      if (e.attrs['semantic.type']) return false
      // TODO: Check parent relationship if targetId is set
      return true
    })

    // Map by matchAttr value
    const map = new Map<string, EntityWithAttrs>()
    for (const e of candidates) {
      const matchValue = e.attrs[matchAttr]
      if (matchValue) {
        map.set(matchValue, e)
      }
    }
    return map
  }, [mode, allEntities, entity.id, matchAttr])

  // Execute reflection
  const handleReflect = useCallback(async () => {
    if (inputEntities.length === 0) return

    setStatus('running')
    setError(null)
    let created = 0
    let updated = 0
    let deleted = 0

    try {
      const processedMatchValues = new Set<string>()

      for (const input of inputEntities) {
        const matchValue = input.attrs[matchAttr]
        if (matchValue) processedMatchValues.add(matchValue)

        // Check for existing entity to update
        const existing = matchValue ? existingMatches.get(matchValue) : undefined

        if (existing && (mode === 'update' || mode === 'sync')) {
          // Update existing entity - copy all non-system attrs
          for (const [key, value] of Object.entries(input.attrs)) {
            // Skip position and system attrs
            if (['x', 'y', 'ui.width', 'ui.height'].includes(key)) continue
            if (existing.attrs[key] !== value) {
              await bl.attrs.set(project.id, existing.id, key, value)
            }
          }
          updated++
        } else {
          // Create new entity
          const newEntity = await bl.entities.create(project.id, {})

          // Copy all attrs from input (except position)
          for (const [key, value] of Object.entries(input.attrs)) {
            if (['x', 'y', 'ui.width', 'ui.height'].includes(key)) continue
            await bl.attrs.set(project.id, newEntity.id, key, value)
          }

          // Set parent relationship if target specified
          if (targetId) {
            await bl.relationships.create(project.id, {
              from_entity: targetId,
              to_entity: newEntity.id,
              kind: 'contains',
            })
          }
          created++
        }
      }

      // Sync mode: delete entities not in inputs
      if (mode === 'sync') {
        for (const [matchValue, existing] of existingMatches) {
          if (!processedMatchValues.has(matchValue)) {
            await bl.entities.delete(project.id, existing.id)
            deleted++
          }
        }
      }

      setLastResult({ created, updated, deleted })
      setStatus('success')
      revalidate()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStatus('error')
    }
  }, [inputEntities, mode, matchAttr, existingMatches, targetId, bl, project.id, revalidate])

  // Mode change handler
  const handleModeChange = useCallback(
    async (value: string) => {
      await bl.attrs.set(project.id, entity.id, 'reflect.mode', value)
      revalidate()
    },
    [bl, project.id, entity.id, revalidate]
  )

  // Preview what will happen
  const preview = useMemo(() => {
    if (mode === 'create') {
      return { create: inputEntities.length, update: 0, delete: 0 }
    }

    let create = 0
    let update = 0
    const processedMatchValues = new Set<string>()

    for (const input of inputEntities) {
      const matchValue = input.attrs[matchAttr]
      if (matchValue) processedMatchValues.add(matchValue)

      const existing = matchValue ? existingMatches.get(matchValue) : undefined
      if (existing) {
        update++
      } else {
        create++
      }
    }

    let deleteCount = 0
    if (mode === 'sync') {
      for (const matchValue of existingMatches.keys()) {
        if (!processedMatchValues.has(matchValue)) {
          deleteCount++
        }
      }
    }

    return { create, update, delete: deleteCount }
  }, [inputEntities, mode, matchAttr, existingMatches])

  // Mode icon
  const ModeIcon = mode === 'create' ? Plus : mode === 'update' ? Edit : RefreshCw

  return (
    <div className="reflect-semantic">
      <div className="reflect-semantic__header">
        <RefreshCw className="w-4 h-4" />
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger className="reflect-semantic__mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="create">
              <div className="flex items-center gap-2">
                <Plus className="w-3 h-3" />
                Create
              </div>
            </SelectItem>
            <SelectItem value="update">
              <div className="flex items-center gap-2">
                <Edit className="w-3 h-3" />
                Update
              </div>
            </SelectItem>
            <SelectItem value="sync">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3 h-3" />
                Sync
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {inputEntities.length === 0 ? (
        <div className="reflect-semantic__empty">
          No input entities. Bind a semantic to provide entities.
        </div>
      ) : (
        <>
          <div className="reflect-semantic__preview">
            <div className="reflect-semantic__preview-header">Preview</div>
            <div className="reflect-semantic__preview-stats">
              {preview.create > 0 && (
                <span className="reflect-semantic__stat reflect-semantic__stat--create">
                  <Plus className="w-3 h-3" />
                  {preview.create} create
                </span>
              )}
              {preview.update > 0 && (
                <span className="reflect-semantic__stat reflect-semantic__stat--update">
                  <Edit className="w-3 h-3" />
                  {preview.update} update
                </span>
              )}
              {preview.delete > 0 && (
                <span className="reflect-semantic__stat reflect-semantic__stat--delete">
                  <Trash2 className="w-3 h-3" />
                  {preview.delete} delete
                </span>
              )}
              {preview.create === 0 && preview.update === 0 && preview.delete === 0 && (
                <span className="reflect-semantic__stat">No changes</span>
              )}
            </div>

            {targetEntity && (
              <div className="reflect-semantic__target">
                Parent: {targetEntity.attrs.name || targetEntity.id.slice(0, 8)}
              </div>
            )}

            <div className="reflect-semantic__inputs">
              {inputEntities.slice(0, 5).map(e => (
                <div key={e.id} className="reflect-semantic__input-item">
                  {e.attrs.name || 'Unnamed'}
                </div>
              ))}
              {inputEntities.length > 5 && (
                <div className="reflect-semantic__more">
                  +{inputEntities.length - 5} more
                </div>
              )}
            </div>
          </div>

          <div className="reflect-semantic__actions">
            <Button
              onClick={handleReflect}
              disabled={status === 'running'}
              className="reflect-semantic__run"
            >
              {status === 'running' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ModeIcon className="h-4 w-4 mr-2" />
              )}
              {mode === 'create' ? 'Create' : mode === 'update' ? 'Update' : 'Sync'}
              {inputEntities.length > 0 && ` (${inputEntities.length})`}
            </Button>

            {status === 'success' && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {status === 'error' && (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>

          {error && <div className="reflect-semantic__error">{error}</div>}

          {lastResult && status === 'success' && (
            <div className="reflect-semantic__result">
              {lastResult.created > 0 && `Created ${lastResult.created}`}
              {lastResult.updated > 0 && ` Updated ${lastResult.updated}`}
              {lastResult.deleted > 0 && ` Deleted ${lastResult.deleted}`}
            </div>
          )}
        </>
      )}
    </div>
  )
}

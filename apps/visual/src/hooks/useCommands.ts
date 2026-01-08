/**
 * useCommands Hook - Copy/Paste for entities
 */

import { useCallback, useEffect, useRef } from 'react'
import type { EntityWithAttrs, Relationship } from '../types'
import { bl } from '../lib/bl'

interface ClipboardData {
  entities: EntityWithAttrs[]
  relationships: Relationship[]
}

// Module-level clipboard (persists across component remounts)
let clipboard: ClipboardData | null = null

interface UseCommandsOptions {
  projectId: string
  entities: EntityWithAttrs[]
  relationships: Relationship[]
  selectedEntityIds: Set<string>
  onPaste?: (newEntityIds: string[]) => void
  revalidate: () => void
}

export function useCommands({
  projectId,
  entities,
  relationships,
  selectedEntityIds,
  onPaste,
  revalidate,
}: UseCommandsOptions) {
  // Use refs to avoid stale closures in event handlers
  const entitiesRef = useRef(entities)
  const relationshipsRef = useRef(relationships)
  const selectedIdsRef = useRef(selectedEntityIds)

  entitiesRef.current = entities
  relationshipsRef.current = relationships
  selectedIdsRef.current = selectedEntityIds

  const copy = useCallback(() => {
    const selectedIds = selectedIdsRef.current
    if (selectedIds.size === 0) return

    // Get selected entities
    const selectedEntities = entitiesRef.current.filter(e => selectedIds.has(e.id))

    // Get relationships between selected entities only
    const internalRelationships = relationshipsRef.current.filter(
      r => selectedIds.has(r.from_entity) && selectedIds.has(r.to_entity)
    )

    clipboard = {
      entities: selectedEntities,
      relationships: internalRelationships,
    }
  }, [])

  const paste = useCallback(async () => {
    if (!clipboard || clipboard.entities.length === 0) return

    // Calculate offset for pasted entities
    const offset = 50

    // Map old IDs to new IDs
    const idMap = new Map<string, string>()

    // Create new entities
    const newEntityIds: string[] = []
    for (const entity of clipboard.entities) {
      const x = parseFloat(entity.attrs.x || '0') + offset
      const y = parseFloat(entity.attrs.y || '0') + offset

      // Copy all attrs except position (which we offset)
      const attrs: Record<string, string> = {}
      for (const [key, value] of Object.entries(entity.attrs)) {
        if (key === 'x') {
          attrs.x = Math.round(x).toString()
        } else if (key === 'y') {
          attrs.y = Math.round(y).toString()
        } else if (key === 'name') {
          attrs.name = `${value} (copy)`
        } else {
          attrs[key] = value
        }
      }

      const newEntity = await bl.entities.create(projectId, attrs)
      idMap.set(entity.id, newEntity.id)
      newEntityIds.push(newEntity.id)
    }

    // Create relationships with remapped IDs
    for (const rel of clipboard.relationships) {
      const newFromId = idMap.get(rel.from_entity)
      const newToId = idMap.get(rel.to_entity)

      if (newFromId && newToId) {
        await bl.relationships.create(projectId, {
          from_entity: newFromId,
          to_entity: newToId,
          kind: rel.kind,
          label: rel.label,
          binding_name: rel.binding_name,
          from_port: rel.from_port,
          to_port: rel.to_port,
        })
      }
    }

    revalidate()
    onPaste?.(newEntityIds)
  }, [projectId, revalidate, onPaste])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input/textarea
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        e.preventDefault()
        copy()
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        e.preventDefault()
        paste()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [copy, paste])

  return { copy, paste, hasClipboard: clipboard !== null }
}

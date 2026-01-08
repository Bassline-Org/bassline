/**
 * useSemanticInput Hook
 *
 * Resolves the input entities for a semantic based on what binds to it.
 * If a binding source is another semantic, reads that semantic's output.
 * This enables composition: A → Filter → CodeGen
 */

import { useMemo } from 'react'
import { useLoaderData } from 'react-router'
import type { EditorLoaderData, EntityWithAttrs, Relationship } from '../types'
import { useSemanticOutputContext } from '../contexts/SemanticOutputContext'
import { isSemanticNode } from '../lib/semantics'

interface SemanticInputResult {
  /** Entities that are input to this semantic */
  inputEntities: EntityWithAttrs[]
  /** Relationships between input entities */
  inputRelationships: Relationship[]
  /** Entity IDs that directly bind to this semantic */
  boundEntityIds: string[]
}

/**
 * Get the input entities for a semantic.
 *
 * @param entity - The semantic's own entity (to find bindings)
 * @returns The resolved input entities and relationships
 */
export function useSemanticInput(entity: EntityWithAttrs): SemanticInputResult {
  const { entities, relationships } = useLoaderData() as EditorLoaderData
  const { getOutput, outputs } = useSemanticOutputContext()

  // outputs map changes trigger re-renders automatically via React state
  return useMemo(() => {
    // Find entities that bind to this semantic
    const bindings = relationships.filter(
      r => r.to_entity === entity.id && r.kind === 'binds'
    )

    const boundEntityIds = bindings.map(r => r.from_entity)

    // Resolve each binding - if it's a semantic, get its output
    const inputEntities: EntityWithAttrs[] = []
    const visitedSemantics = new Set<string>() // Prevent cycles

    function resolveBinding(entityId: string) {
      const boundEntity = entities.find(e => e.id === entityId)
      if (!boundEntity) return

      // If it's a semantic node, get its output (recursive composition)
      if (isSemanticNode(boundEntity)) {
        // Prevent infinite loops
        if (visitedSemantics.has(entityId)) return
        visitedSemantics.add(entityId)

        const output = getOutput(entityId)
        if (output) {
          // Add the semantic's output entities
          inputEntities.push(...output.entities)
        }
      } else {
        // Regular entity - include directly
        inputEntities.push(boundEntity)
      }
    }

    for (const entityId of boundEntityIds) {
      resolveBinding(entityId)
    }

    // Find relationships between input entities
    const inputEntityIds = new Set(inputEntities.map(e => e.id))
    const inputRelationships = relationships.filter(
      r => inputEntityIds.has(r.from_entity) && inputEntityIds.has(r.to_entity)
    )

    return {
      inputEntities,
      inputRelationships,
      boundEntityIds,
    }
  }, [entity.id, entities, relationships, getOutput, outputs])
}

/**
 * Utility to get direct bindings without semantic resolution.
 * Use this when you want raw bindings, not composed output.
 */
export function useDirectBindings(entity: EntityWithAttrs): EntityWithAttrs[] {
  const { entities, relationships } = useLoaderData() as EditorLoaderData

  return useMemo(() => {
    const bindings = relationships.filter(
      r => r.to_entity === entity.id && r.kind === 'binds'
    )

    return bindings
      .map(r => entities.find(e => e.id === r.from_entity))
      .filter((e): e is EntityWithAttrs => e !== undefined)
  }, [entity.id, entities, relationships])
}

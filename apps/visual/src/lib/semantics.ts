/**
 * Semantic Type Registry
 *
 * Maps semantic type IDs to React components that render inside semantic nodes.
 * Semantic components receive their entity and use hooks for everything else.
 */

import type { ComponentType } from 'react'
import type { EntityWithAttrs } from '../types'

export interface SemanticType {
  id: string
  name: string
  icon: string
  component: ComponentType<{ entity: EntityWithAttrs }>
}

// Registry of semantic types - components are lazy loaded
const semanticTypes: Record<string, SemanticType> = {}

/**
 * Register a semantic type
 */
export function registerSemantic(semantic: SemanticType) {
  semanticTypes[semantic.id] = semantic
}

/**
 * Get a semantic type by ID
 */
export function getSemantic(id: string): SemanticType | undefined {
  return semanticTypes[id]
}

/**
 * Get all registered semantic types
 */
export function getAllSemantics(): SemanticType[] {
  return Object.values(semanticTypes)
}

/**
 * Check if an entity is a semantic node
 */
export function isSemanticNode(entity: EntityWithAttrs): boolean {
  return !!entity.attrs['semantic.type']
}

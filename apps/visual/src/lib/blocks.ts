/**
 * Block System Types and Helpers
 *
 * Blocks are entities with semantic.type that render as editable inputs.
 * This module provides:
 * - Block type definitions
 * - Value assembly functions (list/object compute content from children)
 * - Helper functions for working with block entities
 */

import type { EntityWithAttrs, AttrValue, Relationship } from '../types'
import { attrNumber } from '../types'

// =============================================================================
// Block Types
// =============================================================================

/** Primitive block types - render as single value inputs */
export const PRIMITIVE_BLOCK_TYPES = ['text', 'number', 'boolean'] as const

/** Structural block types - contain children */
export const STRUCTURAL_BLOCK_TYPES = ['list', 'object'] as const

/** Document block types - for rich document editing */
export const DOCUMENT_BLOCK_TYPES = [
  'document',
  'paragraph',
  'heading',
  'code',
  'blockquote',
] as const

/** All block types */
export const BLOCK_TYPES = [
  ...PRIMITIVE_BLOCK_TYPES,
  ...STRUCTURAL_BLOCK_TYPES,
  ...DOCUMENT_BLOCK_TYPES,
] as const

export type PrimitiveBlockType = (typeof PRIMITIVE_BLOCK_TYPES)[number]
export type StructuralBlockType = (typeof STRUCTURAL_BLOCK_TYPES)[number]
export type DocumentBlockType = (typeof DOCUMENT_BLOCK_TYPES)[number]
export type BlockType = (typeof BLOCK_TYPES)[number]

/** Check if a semantic type is a block type */
export function isBlockType(type: string | undefined): type is BlockType {
  return type !== undefined && BLOCK_TYPES.includes(type as BlockType)
}

/** Check if a block type is primitive (single value) */
export function isPrimitiveBlock(type: string | undefined): type is PrimitiveBlockType {
  return type !== undefined && PRIMITIVE_BLOCK_TYPES.includes(type as PrimitiveBlockType)
}

/** Check if a block type is structural (has children) */
export function isStructuralBlock(type: string | undefined): type is StructuralBlockType {
  return type !== undefined && STRUCTURAL_BLOCK_TYPES.includes(type as StructuralBlockType)
}

// =============================================================================
// Block Entity Helpers
// =============================================================================

/** Get the block type from an entity's semantic.type attr */
export function getBlockType(entity: EntityWithAttrs): BlockType | undefined {
  const type = entity.attrs['semantic.type']
  if (typeof type === 'string' && isBlockType(type)) {
    return type
  }
  return undefined
}

/** Get the block order from an entity */
export function getBlockOrder(entity: EntityWithAttrs): number {
  return attrNumber(entity.attrs['block.order'], 0)
}

/** Get the block content from an entity */
export function getBlockContent(entity: EntityWithAttrs): AttrValue | undefined {
  return entity.attrs['content']
}

/** Get the block key (for object children) from an entity */
export function getBlockKey(entity: EntityWithAttrs): string | undefined {
  const key = entity.attrs['key']
  return typeof key === 'string' ? key : undefined
}

// =============================================================================
// Child Entity Helpers
// =============================================================================

/**
 * Get child entities for a parent (via 'contains' relationships)
 * Returns children sorted by block.order
 */
export function getChildEntities(
  parentId: string,
  entities: EntityWithAttrs[],
  relationships: Relationship[]
): EntityWithAttrs[] {
  // Find all 'contains' relationships from this parent
  const childIds = new Set(
    relationships
      .filter((r) => r.from_entity === parentId && r.kind === 'contains')
      .map((r) => r.to_entity)
  )

  // Get the child entities
  const children = entities.filter((e) => childIds.has(e.id))

  // Sort by block.order
  return children.sort((a, b) => getBlockOrder(a) - getBlockOrder(b))
}

/**
 * Get parent entity for a child (via 'contains' relationships)
 */
export function getParentEntity(
  childId: string,
  entities: EntityWithAttrs[],
  relationships: Relationship[]
): EntityWithAttrs | undefined {
  const parentRel = relationships.find(
    (r) => r.to_entity === childId && r.kind === 'contains'
  )
  if (!parentRel) return undefined
  return entities.find((e) => e.id === parentRel.from_entity)
}

/**
 * Get siblings of an entity (same parent)
 */
export function getSiblings(
  entityId: string,
  entities: EntityWithAttrs[],
  relationships: Relationship[]
): { prev: EntityWithAttrs | undefined; next: EntityWithAttrs | undefined } {
  const parent = getParentEntity(entityId, entities, relationships)
  if (!parent) return { prev: undefined, next: undefined }

  const siblings = getChildEntities(parent.id, entities, relationships)
  const index = siblings.findIndex((s) => s.id === entityId)

  return {
    prev: index > 0 ? siblings[index - 1] : undefined,
    next: index < siblings.length - 1 ? siblings[index + 1] : undefined,
  }
}

// =============================================================================
// Value Assembly
// =============================================================================

/**
 * Assemble the content value for a block from its entity and children.
 *
 * - Primitive blocks: return content attr directly
 * - List blocks: return array of child values
 * - Object blocks: return object mapping key → child value
 */
export function assembleBlockValue(
  block: EntityWithAttrs,
  entities: EntityWithAttrs[],
  relationships: Relationship[]
): AttrValue {
  const type = getBlockType(block)

  // Primitive blocks: return content directly
  if (!type || isPrimitiveBlock(type)) {
    return block.attrs['content'] ?? ''
  }

  // Get children
  const children = getChildEntities(block.id, entities, relationships)

  // List: array of child values
  if (type === 'list') {
    return children.map((child) =>
      assembleBlockValue(child, entities, relationships)
    )
  }

  // Object: map of key → child value
  if (type === 'object') {
    const result: Record<string, AttrValue> = {}
    for (const child of children) {
      const key = getBlockKey(child)
      if (key) {
        result[key] = assembleBlockValue(child, entities, relationships)
      }
    }
    return result
  }

  // Document/other blocks: return content
  return block.attrs['content'] ?? ''
}

// =============================================================================
// Type Inference
// =============================================================================

/**
 * Infer the appropriate block type for an AttrValue
 */
export function inferBlockType(value: AttrValue | undefined): BlockType {
  if (value === undefined || value === null) return 'text'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (Array.isArray(value)) return 'list'
  if (typeof value === 'object' && !(value instanceof ArrayBuffer)) return 'object'
  return 'text'
}

// =============================================================================
// Ordering Helpers
// =============================================================================

/**
 * Calculate the next order value for inserting after a given block
 */
export function getNextOrder(
  afterBlock: EntityWithAttrs | undefined,
  siblings: EntityWithAttrs[]
): number {
  if (!afterBlock) {
    // Insert at beginning
    const firstOrder = siblings.length > 0 ? getBlockOrder(siblings[0]) : 0
    return firstOrder - 1
  }

  const afterIndex = siblings.findIndex((s) => s.id === afterBlock.id)
  const afterOrder = getBlockOrder(afterBlock)

  if (afterIndex === siblings.length - 1) {
    // Insert at end
    return afterOrder + 1
  }

  // Insert between afterBlock and next sibling
  // For MVP, just use afterOrder + 1 and rely on renumbering
  return afterOrder + 1
}

/**
 * Get blocks that need renumbering after an insert at a given order
 */
export function getBlocksToRenumber(
  siblings: EntityWithAttrs[],
  insertOrder: number
): Array<{ id: string; newOrder: number }> {
  const result: Array<{ id: string; newOrder: number }> = []
  let currentOrder = insertOrder + 1

  for (const sibling of siblings) {
    const siblingOrder = getBlockOrder(sibling)
    if (siblingOrder >= insertOrder) {
      result.push({ id: sibling.id, newOrder: currentOrder })
      currentOrder++
    }
  }

  return result
}

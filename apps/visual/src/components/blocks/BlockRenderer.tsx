/**
 * BlockRenderer
 *
 * Routes block entities to their appropriate block component based on semantic.type.
 * This is the central dispatch for rendering blocks.
 *
 * Usage:
 *   <BlockRenderer entity={blockEntity} />
 *
 * For standalone use (outside DocumentProvider):
 *   <BlockRenderer entity={blockEntity} value={value} onChange={onChange} />
 */

import type { EntityWithAttrs, AttrValue } from '../../types'
import { getBlockType, type BlockType } from '../../lib/blocks'

// Import block components (will be created in Phase 2 & 3)
// For now, use placeholder that shows the block type
import { TextBlock } from './TextBlock'
import { NumberBlock } from './NumberBlock'
import { BooleanBlock } from './BooleanBlock'
import { ListBlock } from './ListBlock'
import { ObjectBlock } from './ObjectBlock'

// =============================================================================
// Types
// =============================================================================

export interface BlockRendererProps {
  entity: EntityWithAttrs

  // For standalone mode (outside DocumentProvider)
  value?: AttrValue
  onChange?: (value: AttrValue) => void

  // Optional: override the inferred block type
  blockType?: BlockType

  // Optional: additional class name
  className?: string
}

// =============================================================================
// Block Component Registry
// =============================================================================

type BlockComponent = React.ComponentType<BlockRendererProps>

const BLOCK_COMPONENTS: Record<BlockType, BlockComponent> = {
  // Primitives
  text: TextBlock,
  number: NumberBlock,
  boolean: BooleanBlock,

  // Structural
  list: ListBlock,
  object: ObjectBlock,

  // Document (use text as fallback for now)
  document: TextBlock,
  paragraph: TextBlock,
  heading: TextBlock,
  code: TextBlock,
  blockquote: TextBlock,
}

// =============================================================================
// Component
// =============================================================================

export function BlockRenderer({
  entity,
  value,
  onChange,
  blockType: overrideType,
  className,
}: BlockRendererProps) {
  // Determine block type
  const type = overrideType ?? getBlockType(entity) ?? 'text'

  // Get the component for this type
  const Component = BLOCK_COMPONENTS[type] ?? TextBlock

  return (
    <Component
      entity={entity}
      value={value}
      onChange={onChange}
      blockType={type}
      className={className}
    />
  )
}

// =============================================================================
// Placeholder components (will be replaced in Phase 2 & 3)
// =============================================================================

// These are temporary placeholders that will be replaced with real implementations

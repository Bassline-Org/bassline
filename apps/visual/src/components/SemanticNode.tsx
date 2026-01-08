/**
 * SemanticNode - Container for semantic portal components
 *
 * Renders a resizable container with a header that wraps custom semantic components.
 * The semantic component receives just its entity and uses hooks for everything else.
 *
 * NOTE: This component is intentionally NOT memoized because semantic components
 * depend on external data (relationships via useLoaderData) that changes independently
 * of the entity prop. When relationships change, semantic components need to re-render
 * to pick up new bindings via useSemanticInput.
 */

import { Suspense } from 'react'
import { NodeResizer } from '@xyflow/react'
import { cn } from '@/lib/utils'
import * as LucideIcons from 'lucide-react'
import type { EntityWithAttrs } from '../types'
import type { SemanticType } from '../lib/semantics'

interface SemanticNodeProps {
  entity: EntityWithAttrs
  semantic: SemanticType
  selected: boolean
}

// Get a Lucide icon by name
function getIcon(iconName: string): React.ComponentType<{ className?: string }> | null {
  const pascalCase = iconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<any>>
  return icons[pascalCase] || null
}

export function SemanticNode({
  entity,
  semantic,
  selected,
}: SemanticNodeProps) {
  const name = entity.attrs.name || semantic.name
  const IconComponent = getIcon(semantic.icon)
  const SemanticComponent = semantic.component

  // Get size from entity attrs
  const uiWidth = entity.attrs['ui.width']
  const uiHeight = entity.attrs['ui.height']

  const style: React.CSSProperties = {}
  if (uiWidth) style.width = `${uiWidth}px`
  if (uiHeight) style.height = `${uiHeight}px`

  return (
    <div
      className={cn(
        'semantic-node',
        selected && 'selected'
      )}
      style={style}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={150}
        handleClassName="entity-node__resize-handle"
        lineClassName="entity-node__resize-line"
      />

      <div className="semantic-node__header">
        {IconComponent && <IconComponent className="semantic-node__icon" />}
        <span className="semantic-node__name">{name}</span>
      </div>

      <div className="semantic-node__content">
        <Suspense fallback={<div className="semantic-node__loading">Loading...</div>}>
          <SemanticComponent entity={entity} />
        </Suspense>
      </div>
    </div>
  )
}

import { memo, useMemo } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import type { EntityWithAttrs } from '../types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import * as LucideIcons from 'lucide-react'

interface EntityNodeData {
  entity: EntityWithAttrs
  isContainer?: boolean
  childCount?: number
}

// Shape mapping for CSS classes
const shapeClasses: Record<string, string> = {
  rect: 'entity-node--rect',
  rounded: 'entity-node--rounded',
  circle: 'entity-node--circle',
  diamond: 'entity-node--diamond',
  hexagon: 'entity-node--hexagon',
}

// Get a Lucide icon by name
function getIcon(iconName: string | undefined): React.ComponentType<{ className?: string }> | null {
  if (!iconName) return null
  // Convert kebab-case to PascalCase (e.g., "arrow-right" -> "ArrowRight")
  const pascalCase = iconName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<any>>
  return icons[pascalCase] || null
}

// Collapsed variant - shows as a small badge with child count
function CollapsedEntityNode({ entity, childCount, selected }: { entity: EntityWithAttrs; childCount: number; selected: boolean }) {
  const name = entity.attrs.name || 'Unnamed'
  const fill = entity.attrs['visual.fill']
  const stroke = entity.attrs['visual.stroke']

  const style: React.CSSProperties = {}
  if (fill) style.backgroundColor = fill
  if (stroke) style.borderColor = stroke

  return (
    <div
      className={cn('entity-node entity-node--collapsed', selected && 'selected')}
      style={style}
    >
      <Handle type="target" position={Position.Top} id="default-target" />
      <div className="entity-node__collapsed-content">
        <span className="entity-node__collapsed-name">{name}</span>
        {childCount > 0 && (
          <Badge variant="secondary" className="entity-node__collapsed-count">
            {childCount}
          </Badge>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} id="default-source" />
    </div>
  )
}

// Compact variant - shows as just an icon
function CompactEntityNode({ entity, selected }: { entity: EntityWithAttrs; selected: boolean }) {
  const iconName = entity.attrs['visual.icon'] || 'box'
  const fill = entity.attrs['visual.fill']
  const stroke = entity.attrs['visual.stroke']
  const IconComponent = getIcon(iconName)

  const style: React.CSSProperties = {}
  if (fill) style.backgroundColor = fill
  if (stroke) style.borderColor = stroke

  return (
    <div
      className={cn('entity-node entity-node--compact', selected && 'selected')}
      style={style}
      title={entity.attrs.name || 'Unnamed'}
    >
      <Handle type="target" position={Position.Top} id="default-target" />
      {IconComponent && <IconComponent className="entity-node__compact-icon" />}
      <Handle type="source" position={Position.Bottom} id="default-source" />
    </div>
  )
}

export const EntityNode = memo(function EntityNode({ data, selected }: NodeProps) {
  const { entity, isContainer, childCount = 0 } = data as unknown as EntityNodeData

  // Collapse mode
  const collapseMode = entity.attrs['ui.collapse'] || 'expanded'

  // Render compact or collapsed variants
  if (collapseMode === 'compact') {
    return <CompactEntityNode entity={entity} selected={!!selected} />
  }
  if (collapseMode === 'collapsed') {
    return <CollapsedEntityNode entity={entity} childCount={childCount} selected={!!selected} />
  }

  // Expanded mode - full rendering
  const name = entity.attrs.name || 'Unnamed'
  const role = entity.attrs.role

  // Visual attrs
  const shape = entity.attrs['visual.shape'] || 'rounded'
  const fill = entity.attrs['visual.fill']
  const stroke = entity.attrs['visual.stroke']
  const iconName = entity.attrs['visual.icon']

  // UI attrs (size)
  const uiWidth = entity.attrs['ui.width']
  const uiHeight = entity.attrs['ui.height']

  // Get icon component
  const IconComponent = useMemo(() => getIcon(iconName), [iconName])

  // Parse enabled ports from attrs
  const ports = useMemo(() => {
    const enabledPorts: string[] = []
    for (const [key, value] of Object.entries(entity.attrs)) {
      if (key.startsWith('port.') && value === 'true') {
        enabledPorts.push(key.slice(5)) // Remove 'port.' prefix
      }
    }
    return enabledPorts.sort()
  }, [entity.attrs])

  // Build inline styles for custom colors and size
  const customStyle = useMemo(() => {
    const style: React.CSSProperties = {}
    if (fill) style.backgroundColor = fill
    if (stroke) style.borderColor = stroke
    if (uiWidth) style.width = `${uiWidth}px`
    if (uiHeight) style.height = `${uiHeight}px`
    return style
  }, [fill, stroke, uiWidth, uiHeight])

  // Build class names
  const className = cn(
    'entity-node',
    shapeClasses[shape] || shapeClasses.rounded,
    selected && 'selected',
    isContainer && 'entity-node--container',
    (uiWidth || uiHeight) && 'entity-node--resized'
  )

  return (
    <div className={className} style={customStyle}>
      {/* Node resizer - only visible when selected */}
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={50}
        handleClassName="entity-node__resize-handle"
        lineClassName="entity-node__resize-line"
      />

      {/* Default connection handles (top/bottom) */}
      <Handle type="target" position={Position.Top} id="default-target" />

      {role && (
        <Badge variant="outline" className="entity-node__role">
          {role}
        </Badge>
      )}

      {/* Port handles - positioned using React Flow's style prop */}
      {ports.map((port, index) => {
        // Calculate vertical position as percentage
        const topPercent = ((index + 1) / (ports.length + 1)) * 100
        return (
          <Handle
            key={`${port}-in`}
            type="target"
            position={Position.Left}
            id={`${port}-in`}
            style={{ top: `${topPercent}%` }}
            title={port}
          />
        )
      })}

      <div className="entity-node__content">
        {IconComponent && (
          <IconComponent className="entity-node__icon" />
        )}
        <div className="entity-node__name">{name}</div>
      </div>

      {/* Output port handles */}
      {ports.map((port, index) => {
        const topPercent = ((index + 1) / (ports.length + 1)) * 100
        return (
          <Handle
            key={`${port}-out`}
            type="source"
            position={Position.Right}
            id={`${port}-out`}
            style={{ top: `${topPercent}%` }}
            title={port}
          />
        )
      })}

      <Handle type="source" position={Position.Bottom} id="default-source" />
    </div>
  )
})

import { memo, useMemo } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import type { EntityWithAttrs } from '../types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import * as LucideIcons from 'lucide-react'
import { useVocabularyContext } from '../contexts/VocabularyContext'
import type { Vocabulary, PortDirection } from '../lib/vocabularyParser'
import { getSemantic } from '../lib/semantics'
import { SemanticNode } from './SemanticNode'

interface EntityNodeData {
  entity: EntityWithAttrs
  isContainer?: boolean
  childCount?: number
  // Used to trigger memo invalidation when bindings change
  // Semantic nodes depend on this to re-render when bindings are created/deleted
  // Using IDs (comma-separated string) instead of count ensures re-render on any binding change
  bindingKey?: string
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

// Port info with direction
interface PortInfo {
  name: string
  direction: PortDirection
}

// Parse enabled ports from entity attrs with direction support
function getPorts(entity: EntityWithAttrs, vocabulary: Vocabulary | null): PortInfo[] {
  const role = entity.attrs.role
  const roleDef = role ? vocabulary?.roles.find(r => r.value === role) : null

  const ports: PortInfo[] = []
  for (const [key, value] of Object.entries(entity.attrs)) {
    if (!key.startsWith('port.') || !value || value === 'false') continue

    const portName = key.slice(5) // Remove 'port.' prefix
    let direction: PortDirection = 'bidirectional'

    // Check if value is an explicit direction
    if (value === 'input' || value === 'output' || value === 'bidirectional') {
      direction = value
    } else if (value === 'true') {
      // Look up vocabulary default for this role's port
      const vocabPort = roleDef?.ports.find(p => p.name === portName)
      direction = vocabPort?.direction ?? 'bidirectional'
    }

    ports.push({ name: portName, direction })
  }
  return ports.sort((a, b) => a.name.localeCompare(b.name))
}

// Collapsed variant - shows as a small badge with child count
// Ports are rendered at center position for edge connectivity
function CollapsedEntityNode({ entity, childCount, selected }: { entity: EntityWithAttrs; childCount: number; selected: boolean }) {
  const vocabulary = useVocabularyContext()
  const name = entity.attrs.name || 'Unnamed'
  const fill = entity.attrs['visual.fill']
  const stroke = entity.attrs['visual.stroke']
  const ports = useMemo(() => getPorts(entity, vocabulary), [entity, vocabulary])

  // Filter by direction
  const inputPorts = ports.filter(p => p.direction !== 'output')
  const outputPorts = ports.filter(p => p.direction !== 'input')

  const style: React.CSSProperties = {}
  if (fill) style.backgroundColor = fill
  if (stroke) style.borderColor = stroke

  return (
    <div
      className={cn('entity-node entity-node--collapsed', selected && 'selected')}
      style={style}
    >
      {/* Input handles at center-left */}
      {inputPorts.map(port => (
        <Handle
          key={`${port.name}-in`}
          type="target"
          position={Position.Left}
          id={`${port.name}-in`}
          className="entity-node__handle--collapsed"
        />
      ))}

      <div className="entity-node__collapsed-content">
        <span className="entity-node__collapsed-name">{name}</span>
        {childCount > 0 && (
          <Badge variant="secondary" className="entity-node__collapsed-count">
            {childCount}
          </Badge>
        )}
      </div>

      {/* Output handles at center-right */}
      {outputPorts.map(port => (
        <Handle
          key={`${port.name}-out`}
          type="source"
          position={Position.Right}
          id={`${port.name}-out`}
          className="entity-node__handle--collapsed"
        />
      ))}
    </div>
  )
}

// Compact variant - shows as just an icon
// Ports are rendered at center position for edge connectivity
function CompactEntityNode({ entity, selected }: { entity: EntityWithAttrs; selected: boolean }) {
  const vocabulary = useVocabularyContext()
  const iconName = entity.attrs['visual.icon'] || 'box'
  const fill = entity.attrs['visual.fill']
  const stroke = entity.attrs['visual.stroke']
  const IconComponent = getIcon(iconName)
  const ports = useMemo(() => getPorts(entity, vocabulary), [entity, vocabulary])

  // Filter by direction
  const inputPorts = ports.filter(p => p.direction !== 'output')
  const outputPorts = ports.filter(p => p.direction !== 'input')

  const style: React.CSSProperties = {}
  if (fill) style.backgroundColor = fill
  if (stroke) style.borderColor = stroke

  return (
    <div
      className={cn('entity-node entity-node--compact', selected && 'selected')}
      style={style}
      title={entity.attrs.name || 'Unnamed'}
    >
      {/* Input handles at center-left */}
      {inputPorts.map(port => (
        <Handle
          key={`${port.name}-in`}
          type="target"
          position={Position.Left}
          id={`${port.name}-in`}
          className="entity-node__handle--compact"
        />
      ))}

      {IconComponent && <IconComponent className="entity-node__compact-icon" />}

      {/* Output handles at center-right */}
      {outputPorts.map(port => (
        <Handle
          key={`${port.name}-out`}
          type="source"
          position={Position.Right}
          id={`${port.name}-out`}
          className="entity-node__handle--compact"
        />
      ))}
    </div>
  )
}

export const EntityNode = memo(function EntityNode({ data, selected }: NodeProps) {
  const { entity, isContainer, childCount = 0 } = data as unknown as EntityNodeData
  const vocabulary = useVocabularyContext()

  // Check if this is a semantic node
  const semanticType = entity.attrs['semantic.type']
  if (semanticType) {
    const semantic = getSemantic(semanticType)
    if (semantic) {
      return <SemanticNode entity={entity} semantic={semantic} selected={!!selected} />
    }
  }

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

  // Parse enabled ports from attrs with direction
  const ports = useMemo(() => getPorts(entity, vocabulary), [entity, vocabulary])

  // Filter by direction for rendering
  const inputPorts = useMemo(() => ports.filter(p => p.direction !== 'output'), [ports])
  const outputPorts = useMemo(() => ports.filter(p => p.direction !== 'input'), [ports])

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

      {role && (
        <Badge variant="outline" className="entity-node__role">
          {role}
        </Badge>
      )}

      {/* Input port handles with labels */}
      {inputPorts.map((port, index) => {
        const topPercent = ((index + 1) / (inputPorts.length + 1)) * 100
        return (
          <div key={`${port.name}-in-container`} className="entity-node__port entity-node__port--left" style={{ top: `${topPercent}%` }}>
            <Handle
              type="target"
              position={Position.Left}
              id={`${port.name}-in`}
            />
            <span className="entity-node__port-label entity-node__port-label--left">{port.name}</span>
          </div>
        )
      })}

      <div className="entity-node__content">
        {IconComponent && (
          <IconComponent className="entity-node__icon" />
        )}
        <div className="entity-node__name">{name}</div>
      </div>

      {/* Output port handles with labels */}
      {outputPorts.map((port, index) => {
        const topPercent = ((index + 1) / (outputPorts.length + 1)) * 100
        return (
          <div key={`${port.name}-out-container`} className="entity-node__port entity-node__port--right" style={{ top: `${topPercent}%` }}>
            <span className="entity-node__port-label entity-node__port-label--right">{port.name}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={`${port.name}-out`}
            />
          </div>
        )
      })}
    </div>
  )
})

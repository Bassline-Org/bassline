import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  SelectionMode,
  type Node,
  type Edge,
  type OnConnect,
  type Viewport,
  type NodeChange,
  type OnSelectionChangeParams,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { EntityWithAttrs, Relationship, UIState, StampWithAttrs } from '../types'
import { attrNumber } from '../types'
import { EntityNode } from './EntityNode'
import { CanvasContextMenu } from './CanvasContextMenu'

const nodeTypes = {
  entity: EntityNode,
}

interface CanvasProps {
  entities: EntityWithAttrs[]
  relationships: Relationship[]
  stamps: StampWithAttrs[]
  selectedEntityIds: Set<string>
  uiState: UIState
  onCreateEntity: (x: number, y: number) => void
  onCreateSemantic?: (x: number, y: number, semanticType: string) => void
  onMoveEntity: (entityId: string, x: number, y: number) => void
  onResizeEntity: (entityId: string, width: number, height: number) => void
  onSelectEntities: (entityIds: Set<string>) => void
  onDeleteEntity: (entityId: string) => void
  onDeleteEntities: (entityIds: string[]) => void
  onDeleteRelationship: (relationshipId: string) => void
  onConnect: (from: string, to: string, fromPort: string | null, toPort: string | null) => void
  onContain: (parentId: string, childId: string) => void
  onUncontain: (childId: string) => void
  onBindTo: (sourceId: string, targetId: string) => void
  onViewportChange: (x: number, y: number, zoom: number) => void
  onSaveAsStamp: (entityId: string, stampName: string) => void
  onApplyStamp: (stampId: string, entityId: string) => void
  onBundle?: () => void
  onUnbundle?: () => void
}

function CanvasInner({
  entities,
  relationships,
  stamps,
  selectedEntityIds,
  uiState,
  onCreateEntity,
  onCreateSemantic,
  onMoveEntity,
  onResizeEntity,
  onSelectEntities,
  onDeleteEntity,
  onDeleteEntities,
  onDeleteRelationship,
  onConnect,
  onContain,
  onUncontain,
  onBindTo,
  onViewportChange,
  onSaveAsStamp,
  onApplyStamp,
  onBundle,
  onUnbundle,
}: CanvasProps) {
  const viewportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  // Track selected edge for deletion
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // Derived single selection for backwards compat with context menu
  const selectedEntityId = selectedEntityIds.size === 1
    ? [...selectedEntityIds][0]
    : null

  // Build parent lookup from contains relationships
  const parentLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    for (const rel of relationships) {
      if (rel.kind === 'contains') {
        lookup[rel.to_entity] = rel.from_entity
      }
    }
    return lookup
  }, [relationships])

  // Identify containers and compute child counts
  const containerIds = useMemo(() => new Set(Object.values(parentLookup)), [parentLookup])

  const childCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const parentId of Object.values(parentLookup)) {
      counts[parentId] = (counts[parentId] || 0) + 1
    }
    return counts
  }, [parentLookup])

  // Track binding relationship IDs for each entity - this triggers memo invalidation when bindings change
  // Important: Semantic nodes depend on bindings data via useSemanticInput, and without
  // these IDs in the node data, EntityNode's memo prevents re-renders when bindings change.
  // Using IDs instead of counts ensures re-render when any binding changes (add/remove/replace)
  const bindingKeys = useMemo(() => {
    const keys: Record<string, string> = {}
    for (const rel of relationships) {
      if (rel.kind === 'binds') {
        // Track actual relationship IDs for both source and target
        const fromKey = keys[rel.from_entity] || ''
        const toKey = keys[rel.to_entity] || ''
        keys[rel.from_entity] = fromKey ? `${fromKey},${rel.id}` : rel.id
        keys[rel.to_entity] = toKey ? `${toKey},${rel.id}` : rel.id
      }
    }
    return keys
  }, [relationships])

  // Get IDs of collapsed/compact nodes whose children should be hidden
  const collapsedParentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const e of entities) {
      const mode = e.attrs['ui.collapse']
      if (mode === 'collapsed' || mode === 'compact') {
        ids.add(e.id)
      }
    }
    return ids
  }, [entities])

  // Convert entities to initial nodes (filtering hidden children)
  // IMPORTANT: React Flow requires parent nodes to appear before their children
  const deriveNodes = useCallback((): Node[] => {
    // Filter visible entities
    const visibleEntities = entities.filter((e) => {
      const parentId = parentLookup[e.id]
      if (parentId && collapsedParentIds.has(parentId)) {
        return false
      }
      return true
    })

    // Sort so parents come before children (topological sort)
    const sorted: typeof visibleEntities = []
    const visited = new Set<string>()

    const visit = (entity: typeof visibleEntities[0]) => {
      if (visited.has(entity.id)) return
      visited.add(entity.id)

      // If this entity has a parent, ensure parent is added first
      const parentId = parentLookup[entity.id]
      if (parentId && !collapsedParentIds.has(parentId)) {
        const parent = visibleEntities.find((e) => e.id === parentId)
        if (parent) visit(parent)
      }

      sorted.push(entity)
    }

    for (const e of visibleEntities) {
      visit(e)
    }

    return sorted.map((e) => {
      const parentId = parentLookup[e.id]
      const isContainer = containerIds.has(e.id)
      const childCount = childCounts[e.id] || 0
      const hasParent = parentId && !collapsedParentIds.has(parentId)
      const collapseMode = e.attrs['ui.collapse'] || 'expanded'

      // Get dimensions - use explicit ui.width/ui.height or defaults
      const uiWidth = e.attrs['ui.width'] ? attrNumber(e.attrs['ui.width']) : undefined
      const uiHeight = e.attrs['ui.height'] ? attrNumber(e.attrs['ui.height']) : undefined

      // Calculate node dimensions based on collapse state
      const nodeStyle = (() => {
        // Compact mode: small square for icon only
        if (collapseMode === 'compact') {
          return { width: 40, height: 40 }
        }
        // Collapsed mode: pill shape for name badge
        if (collapseMode === 'collapsed') {
          return { width: 120, height: 32 }
        }
        // Expanded: use explicit dimensions, container defaults, or let auto-size
        if (isContainer || uiWidth || uiHeight) {
          return {
            width: uiWidth || (isContainer ? 200 : undefined),
            height: uiHeight || (isContainer ? 150 : undefined),
          }
        }
        return undefined
      })()

      return {
        id: e.id,
        type: 'entity',
        position: { x: attrNumber(e.attrs.x), y: attrNumber(e.attrs.y) },
        data: {
          entity: e,
          isContainer,
          childCount,
          // Include binding IDs to force memo invalidation when ANY binding changes
          // This ensures semantic nodes re-render and pick up new bindings
          bindingKey: bindingKeys[e.id] || '',
        },
        selected: selectedEntityIds.has(e.id),
        parentId: hasParent ? parentId : undefined,
        extent: hasParent ? 'parent' as const : undefined,
        expandParent: true,
        style: nodeStyle,
      }
    })
  }, [entities, parentLookup, containerIds, selectedEntityIds, childCounts, collapsedParentIds, bindingKeys])

  // Controlled nodes state - React Flow manages this during interactions
  const [nodes, setNodes] = useState<Node[]>(deriveNodes)

  // Sync nodes when data changes (entities, relationships) or selection changes
  // IMPORTANT: We must rebuild nodes when relationships change so semantic
  // components (which depend on binds relationships) re-render with fresh data
  const prevEntitiesRef = useRef(entities)
  const prevRelationshipsRef = useRef(relationships)
  const prevSelectionRef = useRef(selectedEntityIds)
  useEffect(() => {
    const entitiesChanged = prevEntitiesRef.current !== entities
    const relationshipsChanged = prevRelationshipsRef.current !== relationships
    const selectionChanged = prevSelectionRef.current !== selectedEntityIds

    if (entitiesChanged || relationshipsChanged || selectionChanged) {
      prevEntitiesRef.current = entities
      prevRelationshipsRef.current = relationships
      prevSelectionRef.current = selectedEntityIds

      if (entitiesChanged || relationshipsChanged) {
        // Full rebuild when data changes - this ensures semantic components
        // re-render and pick up new binds relationships via useSemanticInput
        setNodes(deriveNodes())
      } else if (selectionChanged) {
        // Just update selection state
        setNodes(prev => prev.map(n => ({
          ...n,
          selected: selectedEntityIds.has(n.id)
        })))
      }
    }
  }, [entities, relationships, selectedEntityIds, deriveNodes])

  // Handle all node changes (position, resize, etc.)
  // NOTE: Selection is handled by onSelectionChange, not here
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(prev => applyNodeChanges(changes, prev))

      // Handle resize changes only
      for (const change of changes) {
        if (change.type === 'dimensions' && change.resizing === false) {
          // Resizing finished - persist the dimensions
          const node = nodes.find(n => n.id === change.id)
          if (node && change.dimensions) {
            onResizeEntity(change.id, change.dimensions.width, change.dimensions.height)
          }
        }
      }
    },
    [onResizeEntity, nodes]
  )

  // Build entity lookup for collapse state
  const entityLookup = useMemo(() => {
    const lookup: Record<string, EntityWithAttrs> = {}
    for (const e of entities) {
      lookup[e.id] = e
    }
    return lookup
  }, [entities])

  // Derive edges from relationships
  const edges: Edge[] = useMemo(
    () =>
      relationships
        .filter((r) => r.kind === 'connects')
        .map((r) => {
          const sourceEntity = entityLookup[r.from_entity]
          const targetEntity = entityLookup[r.to_entity]
          const sourceCollapse = sourceEntity?.attrs['ui.collapse']
          const targetCollapse = targetEntity?.attrs['ui.collapse']
          const hasCollapsedEnd =
            sourceCollapse === 'collapsed' || sourceCollapse === 'compact' ||
            targetCollapse === 'collapsed' || targetCollapse === 'compact'

          return {
            id: r.id,
            source: r.from_entity,
            target: r.to_entity,
            sourceHandle: r.from_port || undefined,
            targetHandle: r.to_port || undefined,
            label: r.label || undefined,
            type: r.kind === 'binds' ? 'smoothstep' : 'default',
            style: r.kind === 'binds' ? { strokeDasharray: '5,5' } : undefined,
            selected: r.id === selectedEdgeId,
            className: hasCollapsedEnd ? 'collapsed-edge' : undefined,
          }
        }),
    [relationships, selectedEdgeId, entityLookup]
  )

  // Click on node - selection is handled by React Flow's onSelectionChange
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      setSelectedEdgeId(null) // Deselect any edge when clicking a node
    },
    []
  )

  // Click on edge to select
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id)
      onSelectEntities(new Set()) // Deselect any nodes
    },
    [onSelectEntities]
  )

  // Keyboard handler for Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedEdgeId) {
          onDeleteRelationship(selectedEdgeId)
          setSelectedEdgeId(null)
        } else if (selectedEntityIds.size > 0) {
          // Delete all selected entities
          onDeleteEntities([...selectedEntityIds])
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEdgeId, selectedEntityIds, onDeleteRelationship, onDeleteEntities])

  // Context menu handlers
  const handleAddEntity = useCallback(
    (screenX: number, screenY: number) => {
      const position = screenToFlowPosition({ x: screenX, y: screenY })
      onCreateEntity(position.x, position.y)
    },
    [screenToFlowPosition, onCreateEntity]
  )

  const handleAddSemantic = useCallback(
    (screenX: number, screenY: number, semanticType: string) => {
      if (onCreateSemantic) {
        const position = screenToFlowPosition({ x: screenX, y: screenY })
        onCreateSemantic(position.x, position.y, semanticType)
      }
    },
    [screenToFlowPosition, onCreateSemantic]
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedEntityIds.size === 1) {
      // Single delete
      onDeleteEntity([...selectedEntityIds][0])
    } else if (selectedEntityIds.size > 1) {
      // Multi-delete
      onDeleteEntities([...selectedEntityIds])
    }
  }, [selectedEntityIds, onDeleteEntity, onDeleteEntities])

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2 })
  }, [fitView])

  // Persist position only when drag ends
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onMoveEntity(node.id, node.position.x, node.position.y)
    },
    [onMoveEntity]
  )

  const handleConnect: OnConnect = useCallback(
    (params) => {
      if (params.source && params.target) {
        onConnect(
          params.source,
          params.target,
          params.sourceHandle || null,
          params.targetHandle || null
        )
      }
    },
    [onConnect]
  )

  // Click on empty space - node selection is handled by React Flow's onSelectionChange
  const handlePaneClick = useCallback(() => {
    setSelectedEdgeId(null)
  }, [])

  // React Flow's selection change handler - this is the source of truth for node selection
  const handleSelectionChange = useCallback(
    ({ nodes }: OnSelectionChangeParams) => {
      onSelectEntities(new Set(nodes.map(n => n.id)))
    },
    [onSelectEntities]
  )

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      // Debounce viewport updates
      if (viewportTimeoutRef.current) {
        clearTimeout(viewportTimeoutRef.current)
      }
      viewportTimeoutRef.current = setTimeout(() => {
        onViewportChange(viewport.x, viewport.y, viewport.zoom)
      }, 500)
    },
    [onViewportChange]
  )

  const defaultViewport: Viewport = {
    x: uiState.viewport_x,
    y: uiState.viewport_y,
    zoom: uiState.viewport_zoom,
  }

  // Get selected entity's parent id
  const selectedEntityParentId = selectedEntityId ? parentLookup[selectedEntityId] || null : null

  // Check if selected entity is a container
  const isSelectedContainer = selectedEntityId ? containerIds.has(selectedEntityId) : false

  const handleSetParent = useCallback(
    (parentId: string) => {
      if (selectedEntityId) {
        onContain(parentId, selectedEntityId)
      }
    },
    [selectedEntityId, onContain]
  )

  const handleRemoveFromParent = useCallback(() => {
    if (selectedEntityId) {
      onUncontain(selectedEntityId)
    }
  }, [selectedEntityId, onUncontain])

  const handleBindTo = useCallback(
    (targetId: string) => {
      if (selectedEntityId) {
        onBindTo(selectedEntityId, targetId)
      }
    },
    [selectedEntityId, onBindTo]
  )

  return (
    <CanvasContextMenu
      entities={entities}
      stamps={stamps}
      selectedEntityIds={selectedEntityIds}
      selectedEntityParentId={selectedEntityParentId}
      isSelectedContainer={isSelectedContainer}
      onAddEntity={handleAddEntity}
      onAddSemantic={handleAddSemantic}
      onDeleteEntity={selectedEntityIds.size > 0 ? handleDeleteSelected : undefined}
      onFitView={handleFitView}
      onSaveAsStamp={onSaveAsStamp}
      onApplyStamp={onApplyStamp}
      onSetParent={handleSetParent}
      onRemoveFromParent={handleRemoveFromParent}
      onBindTo={handleBindTo}
      onBundle={onBundle}
      onUnbundle={onUnbundle}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onEdgeClick={handleEdgeClick}
        onConnect={handleConnect}
        onPaneClick={handlePaneClick}
        onMoveEnd={handleMoveEnd}
        onSelectionChange={handleSelectionChange}
        defaultViewport={defaultViewport}
        fitView={entities.length > 0 && uiState.viewport_zoom === 1}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={false}
        snapToGrid
        snapGrid={[10, 10]}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </CanvasContextMenu>
  )
}

export function Canvas(props: CanvasProps) {
  return (
    <div className="w-full h-full">
      <ReactFlowProvider>
        <CanvasInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}

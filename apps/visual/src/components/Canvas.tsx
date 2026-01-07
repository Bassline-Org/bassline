import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  type Node,
  type Edge,
  type OnConnect,
  type Viewport,
  type NodeChange,
  applyNodeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { EntityWithAttrs, Relationship, UIState, StampWithAttrs } from '../types'
import { EntityNode } from './EntityNode'
import { CanvasContextMenu } from './CanvasContextMenu'

const nodeTypes = {
  entity: EntityNode,
}

interface CanvasProps {
  entities: EntityWithAttrs[]
  relationships: Relationship[]
  stamps: StampWithAttrs[]
  selectedEntityId: string | null
  uiState: UIState
  onCreateEntity: (x: number, y: number) => void
  onMoveEntity: (entityId: string, x: number, y: number) => void
  onResizeEntity: (entityId: string, width: number, height: number) => void
  onSelectEntity: (entityId: string | null) => void
  onDeleteEntity: (entityId: string) => void
  onDeleteRelationship: (relationshipId: string) => void
  onConnect: (from: string, to: string) => void
  onContain: (parentId: string, childId: string) => void
  onUncontain: (childId: string) => void
  onViewportChange: (x: number, y: number, zoom: number) => void
  onSaveAsStamp: (entityId: string, stampName: string) => void
  onApplyStamp: (stampId: string, entityId: string) => void
}

function CanvasInner({
  entities,
  relationships,
  stamps,
  selectedEntityId,
  uiState,
  onCreateEntity,
  onMoveEntity,
  onResizeEntity,
  onSelectEntity,
  onDeleteEntity,
  onDeleteRelationship,
  onConnect,
  onContain,
  onUncontain,
  onViewportChange,
  onSaveAsStamp,
  onApplyStamp,
}: CanvasProps) {
  const viewportTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  // Track selected edge for deletion
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

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

      // Get dimensions - use explicit ui.width/ui.height or defaults
      const uiWidth = e.attrs['ui.width'] ? parseFloat(e.attrs['ui.width']) : undefined
      const uiHeight = e.attrs['ui.height'] ? parseFloat(e.attrs['ui.height']) : undefined

      // Container nodes need explicit dimensions for extent: 'parent' to work
      const nodeStyle = isContainer || uiWidth || uiHeight ? {
        width: uiWidth || (isContainer ? 200 : undefined),
        height: uiHeight || (isContainer ? 150 : undefined),
      } : undefined

      return {
        id: e.id,
        type: 'entity',
        position: { x: parseFloat(e.attrs.x || '0'), y: parseFloat(e.attrs.y || '0') },
        data: { entity: e, isContainer, childCount },
        selected: e.id === selectedEntityId,
        parentId: hasParent ? parentId : undefined,
        extent: hasParent ? 'parent' as const : undefined,
        expandParent: true,
        style: nodeStyle,
      }
    })
  }, [entities, parentLookup, containerIds, selectedEntityId, childCounts, collapsedParentIds])

  // Controlled nodes state - React Flow manages this during interactions
  const [nodes, setNodes] = useState<Node[]>(deriveNodes)

  // Sync nodes when entities change (create/delete) or selection changes
  const prevEntitiesRef = useRef(entities)
  const prevSelectionRef = useRef(selectedEntityId)
  useEffect(() => {
    const entitiesChanged = prevEntitiesRef.current !== entities
    const selectionChanged = prevSelectionRef.current !== selectedEntityId

    if (entitiesChanged || selectionChanged) {
      prevEntitiesRef.current = entities
      prevSelectionRef.current = selectedEntityId

      if (entitiesChanged) {
        // Full rebuild when entities change
        setNodes(deriveNodes())
      } else if (selectionChanged) {
        // Just update selection state
        setNodes(prev => prev.map(n => ({
          ...n,
          selected: n.id === selectedEntityId
        })))
      }
    }
  }, [entities, selectedEntityId, deriveNodes])

  // Handle all node changes (position, selection, resize, etc.)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(prev => applyNodeChanges(changes, prev))

      // Check for selection and dimension changes
      for (const change of changes) {
        if (change.type === 'select') {
          if (change.selected) {
            onSelectEntity(change.id)
          }
        }
        // Handle resize changes
        if (change.type === 'dimensions' && change.resizing === false) {
          // Resizing finished - persist the dimensions
          const node = nodes.find(n => n.id === change.id)
          if (node && change.dimensions) {
            onResizeEntity(change.id, change.dimensions.width, change.dimensions.height)
          }
        }
      }
    },
    [onSelectEntity, onResizeEntity, nodes]
  )

  // Derive edges from relationships
  const edges: Edge[] = useMemo(
    () =>
      relationships
        .filter((r) => r.kind === 'connects')
        .map((r) => ({
          id: r.id,
          source: r.from_entity,
          target: r.to_entity,
          label: r.label || undefined,
          type: r.kind === 'binds' ? 'smoothstep' : 'default',
          style: r.kind === 'binds' ? { strokeDasharray: '5,5' } : undefined,
          selected: r.id === selectedEdgeId,
        })),
    [relationships, selectedEdgeId]
  )

  // Click on node to select
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectEntity(node.id)
      setSelectedEdgeId(null) // Deselect any edge
    },
    [onSelectEntity]
  )

  // Click on edge to select
  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id)
      onSelectEntity(null) // Deselect any node
    },
    [onSelectEntity]
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
        } else if (selectedEntityId) {
          onDeleteEntity(selectedEntityId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedEdgeId, selectedEntityId, onDeleteRelationship, onDeleteEntity])

  // Context menu handlers
  const handleAddEntity = useCallback(
    (screenX: number, screenY: number) => {
      const position = screenToFlowPosition({ x: screenX, y: screenY })
      onCreateEntity(position.x, position.y)
    },
    [screenToFlowPosition, onCreateEntity]
  )

  const handleDeleteSelected = useCallback(() => {
    if (selectedEntityId) {
      onDeleteEntity(selectedEntityId)
    }
  }, [selectedEntityId, onDeleteEntity])

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
        onConnect(params.source, params.target)
      }
    },
    [onConnect]
  )

  const handlePaneClick = useCallback(() => {
    onSelectEntity(null)
    setSelectedEdgeId(null)
  }, [onSelectEntity])

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

  return (
    <CanvasContextMenu
      entities={entities}
      stamps={stamps}
      selectedEntityId={selectedEntityId}
      selectedEntityParentId={selectedEntityParentId}
      onAddEntity={handleAddEntity}
      onDeleteEntity={selectedEntityId ? handleDeleteSelected : undefined}
      onFitView={handleFitView}
      onSaveAsStamp={onSaveAsStamp}
      onApplyStamp={onApplyStamp}
      onSetParent={handleSetParent}
      onRemoveFromParent={handleRemoveFromParent}
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
        defaultViewport={defaultViewport}
        fitView={entities.length > 0 && uiState.viewport_zoom === 1}
        connectionMode={ConnectionMode.Loose}
        connectOnClick={false}
        snapToGrid
        snapGrid={[10, 10]}
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

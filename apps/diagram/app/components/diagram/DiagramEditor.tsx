import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
  type Connection,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useFetcher, useSubmit, useNavigate } from 'react-router'
import SpineNode from './SpineNode'
import LineEdge from './LineEdge'
import type { ReactFlowEdge, ReactFlowNode } from '~/db/queries'

const nodeTypes = { spine: SpineNode }
const edgeTypes = { line: LineEdge }

type DiagramEditorProps = {
  nodes: ReactFlowNode[]
  edges: ReactFlowEdge[]
  diagramId: string
}

function DiagramEditorInner({ nodes: loaderNodes, edges: loaderEdges, diagramId }: DiagramEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(loaderNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(loaderEdges)

  const fetcher = useFetcher()
  const positionSubmit = useSubmit()
  const { screenToFlowPosition } = useReactFlow()
  const navigate = useNavigate()
  const [addMode, setAddMode] = useState(false)

  // Sync from loader after mutations. shouldRevalidate on the parent route
  // ensures this only fires when the loader actually re-ran (POST), not on
  // child route navigation (GET).
  useEffect(() => {
    setNodes(loaderNodes)
    setEdges(loaderEdges)
  }, [loaderNodes, loaderEdges, setNodes, setEdges])

  // Prevent duplicate edges between the same handles
  const isValidConnection = useCallback(
    (connection: Connection | ReactFlowEdge) => {
      const sh = connection.sourceHandle
      const th = connection.targetHandle
      if (!sh || !th) return false
      if (connection.source === connection.target) return false
      return !edges.some(
        e => (e.sourceHandle === sh && e.targetHandle === th) || (e.sourceHandle === th && e.targetHandle === sh)
      )
    },
    [edges]
  )

  // Persist ALL dragged nodes (handles multi-select drag)
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, _node, draggedNodes) => {
      for (const n of draggedNodes) {
        positionSubmit(
          {
            intent: 'update-position',
            spineId: n.id,
            x: String(n.position.x),
            y: String(n.position.y),
          },
          { method: 'post', navigate: false }
        )
      }
    },
    [positionSubmit]
  )

  const onConnect: OnConnect = useCallback(
    connection => {
      if (!connection.sourceHandle || !connection.targetHandle) return
      fetcher.submit(
        {
          intent: 'connect',
          sourceHandleId: connection.sourceHandle,
          targetHandleId: connection.targetHandle,
        },
        { method: 'post' }
      )
    },
    [fetcher]
  )

  const onNodesDelete: OnNodesDelete = useCallback(
    deleted => {
      if (deleted.length === 0) return
      fetcher.submit({ intent: 'delete-spines', spineIds: JSON.stringify(deleted.map(n => n.id)) }, { method: 'post' })
    },
    [fetcher]
  )

  const onEdgesDelete: OnEdgesDelete = useCallback(
    deleted => {
      if (deleted.length === 0) return
      fetcher.submit({ intent: 'delete-lines', lineIds: JSON.stringify(deleted.map(e => e.id)) }, { method: 'post' })
    },
    [fetcher]
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: { id: string }) => {
      navigate(`spine/${node.id}`)
    },
    [navigate]
  )

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: { id: string }) => {
      navigate(`line/${edge.id}`)
    },
    [navigate]
  )

  const onPaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (!addMode) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      fetcher.submit({ intent: 'add-spine', x: String(position.x), y: String(position.y) }, { method: 'post' })
      setAddMode(false)
    },
    [addMode, fetcher, screenToFlowPosition]
  )

  return (
    <div className="h-full w-full relative">
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <button
          onClick={() => setAddMode(!addMode)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            addMode
              ? 'bg-primary text-primary-foreground'
              : 'bg-card border border-border text-foreground hover:bg-accent'
          }`}
        >
          {addMode ? 'Click to place...' : 'Add Spine'}
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        isValidConnection={isValidConnection}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'line' }}
        fitView
        deleteKeyCode="Backspace"
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="bg-background!" />
        <Controls className="bg-card! border-border! shadow-sm!" />
      </ReactFlow>
    </div>
  )
}

export default function DiagramEditor(props: DiagramEditorProps) {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner {...props} />
    </ReactFlowProvider>
  )
}

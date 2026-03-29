import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnConnect,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useFetcher, useSubmit } from 'react-router'
import SpineNode from './SpineNode'
import LineEdge from './LineEdge'
import type { ReactFlowEdge, ReactFlowNode } from '~/db/queries'

const nodeTypes = { spine: SpineNode }
const edgeTypes = { line: LineEdge }

type DiagramEditorProps = {
  initialNodes: ReactFlowNode[]
  initialEdges: ReactFlowEdge[]
  diagramId: string
}

function DiagramEditorInner({ initialNodes, initialEdges, diagramId }: DiagramEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const fetcher = useFetcher()
  const positionSubmit = useSubmit()
  const { screenToFlowPosition } = useReactFlow()
  const [addMode, setAddMode] = useState(false)

  // Sync from loader when it revalidates
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      positionSubmit(
        {
          intent: 'update-position',
          spineId: node.id,
          x: String(node.position.x),
          y: String(node.position.y),
        },
        { method: 'post', navigate: false }
      )
    },
    [positionSubmit]
  )

  const onConnect: OnConnect = useCallback(
    connection => {
      fetcher.submit(
        {
          intent: 'connect',
          sourceSpine: connection.source!,
          sourceHandle: (connection.sourceHandle ?? 'source:default').replace(/^source:/, ''),
          targetSpine: connection.target!,
          targetHandle: (connection.targetHandle ?? 'target:default').replace(/^target:/, ''),
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
        onPaneClick={onPaneClick}
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

import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import { useState, useCallback, useRef } from 'react'
import { useConsume } from '@bassline/react'
import type { EOF } from '@bassline/core'
import type { InboundMsg, XyflowEvent, GraphViewFact, SetState } from './types'

// --- Inbound: graph messages → xyflow React state ---

export function useGraphState(recv: () => Promise<InboundMsg | typeof EOF>) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  useConsume(recv, (msg: InboundMsg) => applyGraphMsg(msg, setNodes, setEdges))
  return { nodes, setNodes, edges, setEdges }
}

function applyGraphMsg(msg: InboundMsg, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  switch (msg.type) {
    case 'assert':
      applyAssert(msg, setNodes, setEdges)
      break
    case 'retract':
      applyRetract(msg.s, msg.p, setNodes, setEdges)
      break
    case 'result':
      for (const triple of msg.triples) {
        applyAssert(triple, setNodes, setEdges)
      }
      break
  }
}

function applyAssert(msg: GraphViewFact, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  switch (msg.p) {
    case 'kind':
      if (msg.o === 'edge') {
        setEdges(eds =>
          eds.some(e => e.id === msg.s) ? eds : [...eds, { id: msg.s, source: '', target: '', data: {} }]
        )
      } else {
        setNodes(nds =>
          nds.some(n => n.id === msg.s)
            ? nds
            : [...nds, { id: msg.s, type: msg.o, position: { x: 0, y: 0 }, data: { label: msg.s } }]
        )
      }
      break
    case 'pos-x':
      setNodes(nds => nds.map(n => (n.id === msg.s ? { ...n, position: { ...n.position, x: msg.o } } : n)))
      break
    case 'pos-y':
      setNodes(nds => nds.map(n => (n.id === msg.s ? { ...n, position: { ...n.position, y: msg.o } } : n)))
      break
    case 'dim-w':
      setNodes(nds => nds.map(n => (n.id === msg.s ? { ...n, style: { ...n.style, width: msg.o } } : n)))
      break
    case 'dim-h':
      setNodes(nds => nds.map(n => (n.id === msg.s ? { ...n, style: { ...n.style, height: msg.o } } : n)))
      break
    case 'label':
      setNodes(nds => nds.map(n => (n.id === msg.s ? { ...n, data: { ...n.data, label: msg.o } } : n)))
      setEdges(eds => eds.map(e => (e.id === msg.s ? { ...e, data: { ...e.data, label: msg.o } } : e)))
      break
    case 'source':
      setEdges(eds => eds.map(e => (e.id === msg.s ? { ...e, source: msg.o } : e)))
      break
    case 'target':
      setEdges(eds => eds.map(e => (e.id === msg.s ? { ...e, target: msg.o } : e)))
      break
  }
}

function applyRetract(s: string | null, p: string | null, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  if (s == null) return
  if (p == null) {
    setNodes(nds => nds.filter(n => n.id !== s))
    setEdges(eds => eds.filter(e => e.id !== s))
    return
  }
  switch (p) {
    case 'kind':
      setNodes(nds => nds.filter(n => n.id !== s))
      setEdges(eds => eds.filter(e => e.id !== s))
      break
    case 'pos-x':
      setNodes(nds => nds.map(n => (n.id === s ? { ...n, position: { ...n.position, x: 0 } } : n)))
      break
    case 'pos-y':
      setNodes(nds => nds.map(n => (n.id === s ? { ...n, position: { ...n.position, y: 0 } } : n)))
      break
    case 'dim-w':
      setNodes(nds =>
        nds.map(n => {
          if (n.id !== s) return n
          const { width, ...rest } = n.style ?? {}
          return { ...n, style: rest }
        })
      )
      break
    case 'dim-h':
      setNodes(nds =>
        nds.map(n => {
          if (n.id !== s) return n
          const { height, ...rest } = n.style ?? {}
          return { ...n, style: rest }
        })
      )
      break
    case 'label':
      setNodes(nds => nds.map(n => (n.id === s ? { ...n, data: { ...n.data, label: s } } : n)))
      setEdges(eds => eds.map(e => (e.id === s ? { ...e, data: { ...e.data, label: undefined } } : e)))
      break
    case 'source':
      setEdges(eds => eds.map(e => (e.id === s ? { ...e, source: '' } : e)))
      break
    case 'target':
      setEdges(eds => eds.map(e => (e.id === s ? { ...e, target: '' } : e)))
      break
  }
}

// --- Outbound: xyflow events → send ---

export function useXyflowHandlers(
  onEvent: (event: XyflowEvent) => void,
  setNodes: SetState<Node[]>,
  setEdges: SetState<Edge[]>
) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds))
    onEventRef.current({ kind: 'nodesChange', changes })
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
    onEventRef.current({ kind: 'edgesChange', changes })
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    const id = `e-${crypto.randomUUID().slice(0, 8)}`
    setEdges(eds => addEdge({ ...connection, id }, eds))
    onEventRef.current({ kind: 'connect', id, connection })
  }, [])

  const onDelete = useCallback(({ nodes: dn, edges: de }: { nodes: Node[]; edges: Edge[] }) => {
    onEventRef.current({ kind: 'delete', nodes: dn, edges: de })
  }, [])

  return { onNodesChange, onEdgesChange, onConnect, onDelete }
}

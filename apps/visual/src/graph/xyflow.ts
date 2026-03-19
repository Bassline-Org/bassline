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
import { useState, useCallback } from 'react'
import { useSink } from '@bassline/react'
import { graph } from './messages'
import type { GraphMsg } from './messages'
import type { Reader, Writer } from '@bassline/core'

type SetState<T> = (fn: (prev: T) => T) => void

// --- Inbound: graph messages → xyflow React state ---

export function useGraphState(reader: Reader<GraphMsg>) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  useSink(reader, (msg: any) => applyGraphMsg(msg, setNodes, setEdges))
  return { nodes, setNodes, edges, setEdges }
}

function applyGraphMsg(msg: GraphMsg, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  switch (msg.type) {
    case 'assert':
      applyAssert(msg.s, msg.p, msg.o, setNodes, setEdges)
      break
    case 'retract':
      applyRetract(msg.s, msg.p, setNodes, setEdges)
      break
    case 'result':
      for (const { s, p, o } of msg.triples) {
        applyAssert(s, p, o, setNodes, setEdges)
      }
      break
  }
}

function applyAssert(s: string, p: string, o: any, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  switch (p) {
    case 'kind':
      if (o === 'edge') {
        setEdges(eds => (eds.some(e => e.id === s) ? eds : [...eds, { id: s, source: '', target: '', data: {} }]))
      } else {
        setNodes(nds =>
          nds.some(n => n.id === s) ? nds : [...nds, { id: s, type: o, position: { x: 0, y: 0 }, data: { label: s } }]
        )
      }
      break
    case 'position':
      setNodes(nds => nds.map(n => (n.id === s ? { ...n, position: o } : n)))
      break
    case 'label':
      setNodes(nds => nds.map(n => (n.id === s ? { ...n, data: { ...n.data, label: o } } : n)))
      setEdges(eds => eds.map(e => (e.id === s ? { ...e, data: { ...e.data, label: o } } : e)))
      break
    case 'source':
      setEdges(eds => eds.map(e => (e.id === s ? { ...e, source: o } : e)))
      break
    case 'target':
      setEdges(eds => eds.map(e => (e.id === s ? { ...e, target: o } : e)))
      break
  }
}

function applyRetract(s: string | null, _p: string | null, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  if (s == null) return
  setNodes(nds => nds.filter(n => n.id !== s))
  setEdges(eds => eds.filter(e => e.id !== s))
}

// --- Outbound: xyflow events → writer ---

export function useXyflowHandlers(writer: Writer, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds))
    for (const c of changes) {
      if (c.type === 'position' && c.position && !c.dragging) {
        writer.send({ kind: 'position', id: c.id, x: c.position.x, y: c.position.y })
      }
    }
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    const id = `e-${crypto.randomUUID().slice(0, 8)}`
    setEdges(eds => addEdge({ ...connection, id }, eds))
    writer.send({ kind: 'connect', id, source: connection.source, target: connection.target })
  }, [])

  const onDelete = useCallback(({ nodes: dn, edges: de }: { nodes: Node[]; edges: Edge[] }) => {
    for (const n of dn) writer.send({ kind: 'remove', id: n.id })
    for (const e of de) writer.send({ kind: 'remove', id: e.id })
  }, [])

  return { onNodesChange, onEdgesChange, onConnect, onDelete }
}

// --- Bridge: xyflow → graph ---

export function bridgeToGraph(target: Writer) {
  const g = graph(target)
  return (event: any) => {
    switch (event.kind) {
      case 'position':
        g.position(event.id, event.x, event.y)
        break
      case 'connect':
        g.connect(event.id, event.source, event.target)
        break
      case 'remove':
        g.remove(event.id)
        break
    }
  }
}

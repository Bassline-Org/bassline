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
import type { AssertMsg, RetractMsg } from './messages'
import type { Reader, Writer } from '@bassline/core'

// --- Inbound: graph messages → xyflow React state ---
export function useGraphState(reader: Reader<InboundMsg>) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  useSink(reader, (msg: InboundMsg) => applyGraphMsg(msg, setNodes, setEdges))
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
    case 'position':
      setNodes(nds => nds.map(n => (n.id === msg.s ? { ...n, position: msg.o } : n)))
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

function applyRetract(s: string | null, _p: string | null, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  if (s == null) return
  setNodes(nds => nds.filter(n => n.id !== s))
  setEdges(eds => eds.filter(e => e.id !== s))
}

// --- Outbound: xyflow events → writer ---
export function useXyflowHandlers(writer: Writer<XyflowEvent>, setNodes: SetState<Node[]>, setEdges: SetState<Edge[]>) {
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(nds => applyNodeChanges(changes, nds))
    writer.send({ kind: 'nodesChange', changes })
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(eds => applyEdgeChanges(changes, eds))
    writer.send({ kind: 'edgesChange', changes })
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    const id = `e-${crypto.randomUUID().slice(0, 8)}`
    setEdges(eds => addEdge({ ...connection, id }, eds))
    writer.send({ kind: 'connect', id, connection })
  }, [])

  const onDelete = useCallback(({ nodes: dn, edges: de }: { nodes: Node[]; edges: Edge[] }) => {
    writer.send({ kind: 'delete', nodes: dn, edges: de })
  }, [])

  return { onNodesChange, onEdgesChange, onConnect, onDelete }
}

// --- Bridge: xyflow → graph ---
export function bridgeToGraph(target: Writer) {
  const g = graph(target)
  return (event: XyflowEvent) => {
    switch (event.kind) {
      case 'nodesChange':
        for (const c of event.changes) {
          if (c.type === 'position' && c.position && !c.dragging) {
            g.position(c.id, c.position.x, c.position.y)
          }
        }
        break
      case 'connect':
        g.connect(event.id, event.connection.source, event.connection.target)
        break
      case 'delete':
        for (const n of event.nodes) g.remove(n.id)
        for (const e of event.edges) g.remove(e.id)
        break
    }
  }
}

type SetState<T> = (fn: (prev: T) => T) => void
type GraphKindAssert = AssertMsg<string> & { p: 'kind' }
type GraphPositionAssert = AssertMsg<{ x: number; y: number }> & { p: 'position' }
type GraphLabelAssert = AssertMsg<string> & { p: 'label' }
type GraphSourceAssert = AssertMsg<string> & { p: 'source' }
type GraphTargetAssert = AssertMsg<string> & { p: 'target' }
type GraphViewAssert = GraphKindAssert | GraphPositionAssert | GraphLabelAssert | GraphSourceAssert | GraphTargetAssert
type GraphViewTriple =
  | { s: string; p: 'kind'; o: string }
  | { s: string; p: 'position'; o: { x: number; y: number } }
  | { s: string; p: 'label'; o: string }
  | { s: string; p: 'source'; o: string }
  | { s: string; p: 'target'; o: string }
type GraphViewResult = { type: 'result'; qid: string; triples: GraphViewTriple[] }
type GraphViewFact = GraphViewAssert | GraphViewTriple
export type InboundMsg = GraphViewAssert | RetractMsg | GraphViewResult
export type XyflowEvent =
  | { kind: 'nodesChange'; changes: NodeChange[] }
  | { kind: 'edgesChange'; changes: EdgeChange[] }
  | { kind: 'connect'; id: string; connection: Connection }
  | { kind: 'delete'; nodes: Node[]; edges: Edge[] }

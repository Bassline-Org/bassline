import type { AssertMsg, RetractMsg } from '../graph/schema'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'

// --- View types: xyflow's local interpretation of graph triples ---

export type GraphKindAssert = AssertMsg & { p: 'kind'; o: string }
export type GraphPositionAssert = AssertMsg & { p: 'position'; o: { x: number; y: number } }
export type GraphDimensionsAssert = AssertMsg & { p: 'dimensions'; o: { w: number; h: number } }
export type GraphLabelAssert = AssertMsg & { p: 'label'; o: string }
export type GraphSourceAssert = AssertMsg & { p: 'source'; o: string }
export type GraphTargetAssert = AssertMsg & { p: 'target'; o: string }
export type GraphViewAssert =
  | GraphKindAssert
  | GraphPositionAssert
  | GraphDimensionsAssert
  | GraphLabelAssert
  | GraphSourceAssert
  | GraphTargetAssert

export type GraphViewTriple =
  | { s: string; p: 'kind'; o: string }
  | { s: string; p: 'position'; o: { x: number; y: number } }
  | { s: string; p: 'dimensions'; o: { w: number; h: number } }
  | { s: string; p: 'label'; o: string }
  | { s: string; p: 'source'; o: string }
  | { s: string; p: 'target'; o: string }

export type GraphViewResult = { type: 'result'; qid: string; triples: GraphViewTriple[] }
export type GraphViewFact = GraphViewAssert | GraphViewTriple

// --- Messages this ontology exchanges ---

export type InboundMsg = GraphViewAssert | RetractMsg | GraphViewResult

export type XyflowEvent =
  | { kind: 'nodesChange'; changes: NodeChange[] }
  | { kind: 'edgesChange'; changes: EdgeChange[] }
  | { kind: 'connect'; id: string; connection: Connection }
  | { kind: 'delete'; nodes: Node[]; edges: Edge[] }

// --- Utility types ---

export type SetState<T> = (fn: (prev: T) => T) => void

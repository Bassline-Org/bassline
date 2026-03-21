import type { AssertMsg, RetractMsg } from '@bassline/ontology/graph'
import type { Node, Edge, NodeChange, EdgeChange, Connection } from '@xyflow/react'

// --- View types: xyflow's local interpretation of graph triples ---

export type GraphKindAssert = AssertMsg & { p: 'kind'; o: string }
export type GraphPosXAssert = AssertMsg & { p: 'pos-x'; o: number }
export type GraphPosYAssert = AssertMsg & { p: 'pos-y'; o: number }
export type GraphDimWAssert = AssertMsg & { p: 'dim-w'; o: number }
export type GraphDimHAssert = AssertMsg & { p: 'dim-h'; o: number }
export type GraphLabelAssert = AssertMsg & { p: 'label'; o: string }
export type GraphSourceAssert = AssertMsg & { p: 'source'; o: string }
export type GraphTargetAssert = AssertMsg & { p: 'target'; o: string }
export type GraphViewAssert =
  | GraphKindAssert
  | GraphPosXAssert
  | GraphPosYAssert
  | GraphDimWAssert
  | GraphDimHAssert
  | GraphLabelAssert
  | GraphSourceAssert
  | GraphTargetAssert

export type GraphViewTriple =
  | { s: string; p: 'kind'; o: string }
  | { s: string; p: 'pos-x'; o: number }
  | { s: string; p: 'pos-y'; o: number }
  | { s: string; p: 'dim-w'; o: number }
  | { s: string; p: 'dim-h'; o: number }
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

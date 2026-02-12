import type { GraphNode } from '../../../core/views'

/** A positioned node after layout computation */
export type PositionedNode = {
  id: string
  data: GraphNode
  x: number
  y: number
  width: number
  height: number
  depth: number
  /** If this node has a subgraph, the computed inner layout */
  innerLayout?: LayoutResult
}

/** A positioned edge after layout computation */
export type PositionedEdge = {
  sourceId: string
  targetId: string
  /** True if this edge was added via edges.connect (not hierarchical) */
  explicit?: boolean
  /** True if edge is decorative only (lighter style, no arrow) */
  passive?: boolean
}

/** Result from any layout algorithm */
export type LayoutResult = {
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  width: number
  height: number
}

/** Options passed to layout algorithms */
export type LayoutOptions = {
  containerWidth: number
  containerHeight: number
  nodeWidth: number
  nodeHeight: number
  layout: 'vertical' | 'horizontal'
  padding: number
}

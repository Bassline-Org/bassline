import type { MondrianEdgeConnection, GraphNode } from '../../../core/views'
import type { PositionedNode, PositionedEdge } from './types'

/**
 * Resolve explicit edge connections against positioned nodes.
 * Matches by GraphNode.id, then by GraphNode.label, then by predicate function.
 */
export function resolveEdges(
  connections: MondrianEdgeConnection[],
  nodes: PositionedNode[],
): PositionedEdge[] {
  const edges: PositionedEdge[] = []

  for (const conn of connections) {
    const sources = matchNodes(conn.from, nodes)
    const targets = matchNodes(conn.to, nodes)

    for (const src of sources) {
      for (const tgt of targets) {
        if (src.id !== tgt.id) {
          edges.push({
            sourceId: src.id,
            targetId: tgt.id,
            explicit: true,
          })
        }
      }
    }
  }

  return edges
}

function matchNodes(
  matcher: string | ((node: GraphNode) => boolean),
  nodes: PositionedNode[],
): PositionedNode[] {
  if (typeof matcher === 'function') {
    return nodes.filter(n => matcher(n.data))
  }
  // Match by id first, then by label
  const byId = nodes.filter(n => n.data.id === matcher)
  if (byId.length > 0) return byId
  return nodes.filter(n => n.data.label === matcher)
}

import { hierarchy, tree } from 'd3-hierarchy'
import type { GraphNode } from '../../../../core/views'
import type { LayoutResult, LayoutOptions, PositionedNode, PositionedEdge } from '../types'

function buildId(path: number[]): string {
  return path.length === 0 ? 'root' : path.join('-')
}

function getPath(node: { parent: any; children?: any[] }): number[] {
  const path: number[] = []
  let cur = node
  while (cur.parent) {
    path.unshift(cur.parent.children?.indexOf(cur) ?? 0)
    cur = cur.parent
  }
  return path
}

export function computeRadialTreeLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { nodeWidth, nodeHeight, containerWidth, containerHeight } = options

  const h = hierarchy(root)
  const radius = Math.min(containerWidth, containerHeight) / 2 - Math.max(nodeWidth, nodeHeight)

  // d3 tree with size [2*PI, radius] gives polar coordinates:
  // node.x = angle in radians, node.y = distance from center
  const treeLayout = tree<GraphNode>().size([2 * Math.PI, Math.max(radius, 60)])

  const laid = treeLayout(h)

  const cx = containerWidth / 2
  const cy = containerHeight / 2

  const nodes: PositionedNode[] = []
  const edges: PositionedEdge[] = []

  laid.each(node => {
    const id = buildId(getPath(node))
    // Convert polar to cartesian. Root (depth 0) stays at center
    const angle = node.x - Math.PI / 2 // rotate so top is up
    const r = node.y
    nodes.push({
      id,
      data: node.data,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      width: nodeWidth,
      height: nodeHeight,
      depth: node.depth,
    })
  })

  for (const link of laid.links()) {
    edges.push({
      sourceId: buildId(getPath(link.source)),
      targetId: buildId(getPath(link.target)),
    })
  }

  return {
    nodes,
    edges,
    width: containerWidth,
    height: containerHeight,
  }
}

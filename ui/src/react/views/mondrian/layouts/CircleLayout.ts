import { hierarchy } from 'd3-hierarchy'
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

export function computeCircleLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { nodeWidth, nodeHeight, containerWidth, containerHeight } = options

  const h = hierarchy(root)
  const leaves = h.leaves()
  const n = leaves.length

  const cx = containerWidth / 2
  const cy = containerHeight / 2
  const maxRadius = Math.min(containerWidth, containerHeight) / 2 - Math.max(nodeWidth, nodeHeight) / 2 - 20
  const radius = Math.max(maxRadius, n * Math.max(nodeWidth, nodeHeight) / (2 * Math.PI))

  const nodes: PositionedNode[] = []
  const edges: PositionedEdge[] = []

  // Place leaves on the circle
  leaves.forEach((leaf, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2
    nodes.push({
      id: buildId(getPath(leaf)),
      data: leaf.data,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      width: nodeWidth,
      height: nodeHeight,
      depth: leaf.depth,
    })
  })

  // Place internal nodes at center (or concentric rings if deep)
  h.each(node => {
    if (node.height === 0) return // skip leaves, already placed
    const id = buildId(getPath(node))
    if (node.depth === 0) {
      nodes.push({ id, data: node.data, x: cx, y: cy, width: nodeWidth, height: nodeHeight, depth: 0 })
    } else {
      // Internal nodes at a fraction of radius
      const innerR = radius * (node.depth / (h.height || 1)) * 0.4
      const childAngles = (node.children ?? []).map(c => {
        const leafIdx = leaves.indexOf(c.leaves()[0])
        return leafIdx >= 0 ? (leafIdx / n) * 2 * Math.PI - Math.PI / 2 : 0
      })
      const avgAngle = childAngles.length > 0 ? childAngles.reduce((a, b) => a + b, 0) / childAngles.length : 0
      nodes.push({
        id,
        data: node.data,
        x: cx + innerR * Math.cos(avgAngle),
        y: cy + innerR * Math.sin(avgAngle),
        width: nodeWidth,
        height: nodeHeight,
        depth: node.depth,
      })
    }
  })

  // Add hierarchical edges
  for (const link of h.links()) {
    edges.push({
      sourceId: buildId(getPath(link.source)),
      targetId: buildId(getPath(link.target)),
    })
  }

  // Normalize bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const nd of nodes) {
    minX = Math.min(minX, nd.x - nd.width / 2)
    maxX = Math.max(maxX, nd.x + nd.width / 2)
    minY = Math.min(minY, nd.y - nd.height / 2)
    maxY = Math.max(maxY, nd.y + nd.height / 2)
  }

  const pad = 20
  for (const nd of nodes) {
    nd.x += -minX + pad
    nd.y += -minY + pad
  }

  return {
    nodes,
    edges,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

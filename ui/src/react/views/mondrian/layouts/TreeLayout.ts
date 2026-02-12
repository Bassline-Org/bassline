import { hierarchy, tree } from 'd3-hierarchy'
import type { GraphNode } from '../../../../core/views'
import type { LayoutResult, LayoutOptions, PositionedNode, PositionedEdge } from '../types'

const VERTICAL_GAP = 60

function buildId(path: number[]): string {
  return path.length === 0 ? 'root' : path.join('-')
}

export function computeTreeLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { nodeWidth, nodeHeight, layout: orientation } = options
  const isHorizontal = orientation === 'horizontal'

  const h = hierarchy(root)
  const gap = VERTICAL_GAP
  const nodeSize: [number, number] = isHorizontal
    ? [nodeHeight + gap, nodeWidth + gap]
    : [nodeWidth + 20, nodeHeight + gap]

  const treeLayout = tree<GraphNode>().nodeSize(nodeSize)
  const laid = treeLayout(h)

  const nodes: PositionedNode[] = []
  const edges: PositionedEdge[] = []

  laid.each(node => {
    const path: number[] = []
    let cur = node
    while (cur.parent) {
      const idx = cur.parent.children?.indexOf(cur) ?? 0
      path.unshift(idx)
      cur = cur.parent
    }
    const id = buildId(path)

    nodes.push({
      id,
      data: node.data,
      x: isHorizontal ? node.y + nodeWidth / 2 : node.x,
      y: isHorizontal ? node.x : node.y + nodeHeight / 2,
      width: nodeWidth,
      height: nodeHeight,
      depth: node.depth,
    })
  })

  for (const link of laid.links()) {
    const srcPath: number[] = []
    let cur = link.source
    while (cur.parent) {
      srcPath.unshift(cur.parent.children?.indexOf(cur) ?? 0)
      cur = cur.parent
    }
    const tgtPath: number[] = []
    let cur2 = link.target
    while (cur2.parent) {
      tgtPath.unshift(cur2.parent.children?.indexOf(cur2) ?? 0)
      cur2 = cur2.parent
    }
    edges.push({ sourceId: buildId(srcPath), targetId: buildId(tgtPath) })
  }

  // Compute bounding box
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2)
    maxX = Math.max(maxX, n.x + n.width / 2)
    minY = Math.min(minY, n.y - n.height / 2)
    maxY = Math.max(maxY, n.y + n.height / 2)
  }

  const pad = 20
  // Offset nodes so they start at pad,pad
  for (const n of nodes) {
    n.x += -minX + pad
    n.y += -minY + pad
  }

  return {
    nodes,
    edges,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

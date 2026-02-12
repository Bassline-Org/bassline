import { hierarchy } from 'd3-hierarchy'
import type { GraphNode } from '../../../../core/views'
import type { LayoutResult, LayoutOptions, PositionedNode } from '../types'

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

export function computeGridLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { nodeWidth, nodeHeight } = options
  const gap = 16

  const h = hierarchy(root)
  const allNodes = h.descendants()

  const n = allNodes.length
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))

  const nodes: PositionedNode[] = allNodes.map((node, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: buildId(getPath(node)),
      data: node.data,
      x: col * (nodeWidth + gap) + nodeWidth / 2 + 20,
      y: row * (nodeHeight + gap) + nodeHeight / 2 + 20,
      width: nodeWidth,
      height: nodeHeight,
      depth: node.depth,
    }
  })

  const rows = Math.ceil(n / cols)

  return {
    nodes,
    edges: [], // grid layout shows no edges
    width: cols * (nodeWidth + gap) - gap + 40,
    height: rows * (nodeHeight + gap) - gap + 40,
  }
}

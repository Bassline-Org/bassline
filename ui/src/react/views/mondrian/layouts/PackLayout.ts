import { hierarchy, pack } from 'd3-hierarchy'
import type { GraphNode } from '../../../../core/views'
import type { LayoutResult, LayoutOptions, PositionedNode } from '../types'

function buildId(path: number[]): string {
  return path.length === 0 ? 'root' : path.join('-')
}

export function computePackLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { containerWidth, containerHeight, padding } = options

  const size = Math.min(containerWidth, containerHeight)

  const h = hierarchy(root)
    .sum(d => {
      if (!d.children || d.children.length === 0) return d.value ?? 1
      return 0
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const packLayout = pack<GraphNode>()
    .size([size, size])
    .padding(padding * 2)

  const laid = packLayout(h)

  const nodes: PositionedNode[] = []

  laid.each(node => {
    const path: number[] = []
    let cur = node
    while (cur.parent) {
      path.unshift(cur.parent.children?.indexOf(cur) ?? 0)
      cur = cur.parent
    }

    nodes.push({
      id: buildId(path),
      data: node.data,
      x: node.x,
      y: node.y,
      width: node.r * 2,
      height: node.r * 2,
      depth: node.depth,
    })
  })

  return {
    nodes,
    edges: [], // pack has no edges
    width: size,
    height: size,
  }
}

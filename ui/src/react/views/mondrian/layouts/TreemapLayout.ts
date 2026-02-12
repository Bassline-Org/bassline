import { hierarchy, treemap } from 'd3-hierarchy'
import type { GraphNode } from '../../../../core/views'
import type { LayoutResult, LayoutOptions, PositionedNode } from '../types'

function buildId(path: number[]): string {
  return path.length === 0 ? 'root' : path.join('-')
}

export function computeTreemapLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { containerWidth, containerHeight, padding } = options

  const h = hierarchy(root)
    .sum(d => {
      if (!d.children || d.children.length === 0) return d.value ?? 1
      return 0
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const tmLayout = treemap<GraphNode>()
    .size([containerWidth, containerHeight])
    .paddingInner(padding)
    .paddingOuter(padding)
    .round(true)

  const laid = tmLayout(h)

  const nodes: PositionedNode[] = []

  laid.each(node => {
    const path: number[] = []
    let cur = node
    while (cur.parent) {
      path.unshift(cur.parent.children?.indexOf(cur) ?? 0)
      cur = cur.parent
    }
    const w = node.x1 - node.x0
    const h = node.y1 - node.y0
    if (w < 1 || h < 1) return

    nodes.push({
      id: buildId(path),
      data: node.data,
      x: node.x0 + w / 2,
      y: node.y0 + h / 2,
      width: w,
      height: h,
      depth: node.depth,
    })
  })

  return {
    nodes,
    edges: [], // treemap has no edges
    width: containerWidth,
    height: containerHeight,
  }
}

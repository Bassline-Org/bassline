import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide, type SimulationNodeDatum, type SimulationLinkDatum } from 'd3-force'
import { hierarchy } from 'd3-hierarchy'
import type { GraphNode } from '../../../../core/views'
import type { LayoutResult, LayoutOptions, PositionedNode, PositionedEdge } from '../types'

function buildId(path: number[]): string {
  return path.length === 0 ? 'root' : path.join('-')
}

interface ForceNode extends SimulationNodeDatum {
  nodeId: string
  data: GraphNode
  depth: number
}

export function computeForceLayout(root: GraphNode, options: LayoutOptions): LayoutResult {
  const { nodeWidth, nodeHeight, containerWidth, containerHeight } = options

  const h = hierarchy(root)
  const forceNodes: ForceNode[] = []
  const forceLinks: SimulationLinkDatum<ForceNode>[] = []
  const idMap = new Map<string, ForceNode>()

  h.each(node => {
    const path: number[] = []
    let cur = node
    while (cur.parent) {
      path.unshift(cur.parent.children?.indexOf(cur) ?? 0)
      cur = cur.parent
    }
    const id = buildId(path)
    const fn: ForceNode = { nodeId: id, data: node.data, depth: node.depth }
    forceNodes.push(fn)
    idMap.set(id, fn)
  })

  for (const link of h.links()) {
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
    const src = idMap.get(buildId(srcPath))
    const tgt = idMap.get(buildId(tgtPath))
    if (src && tgt) {
      forceLinks.push({ source: src, target: tgt })
    }
  }

  const collisionRadius = Math.max(nodeWidth, nodeHeight) / 2 + 5

  const simulation = forceSimulation<ForceNode>(forceNodes)
    .force('link', forceLink<ForceNode, SimulationLinkDatum<ForceNode>>(forceLinks).distance(80))
    .force('charge', forceManyBody().strength(-200))
    .force('center', forceCenter(containerWidth / 2, containerHeight / 2))
    .force('collide', forceCollide<ForceNode>(collisionRadius))
    .stop()

  // Run synchronously
  for (let i = 0; i < 300; i++) simulation.tick()

  const nodes: PositionedNode[] = forceNodes.map(fn => ({
    id: fn.nodeId,
    data: fn.data,
    x: fn.x ?? 0,
    y: fn.y ?? 0,
    width: nodeWidth,
    height: nodeHeight,
    depth: fn.depth,
  }))

  const edges: PositionedEdge[] = forceLinks.map(link => ({
    sourceId: (link.source as ForceNode).nodeId,
    targetId: (link.target as ForceNode).nodeId,
  }))

  // Compute bounding box and normalize
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.x - n.width / 2)
    maxX = Math.max(maxX, n.x + n.width / 2)
    minY = Math.min(minY, n.y - n.height / 2)
    maxY = Math.max(maxY, n.y + n.height / 2)
  }

  const pad = 20
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

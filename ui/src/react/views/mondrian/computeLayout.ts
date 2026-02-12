import type { GraphNode, MondrianLayoutType } from '../../../core/views'
import type { LayoutResult, LayoutOptions } from './types'
import { computeTreeLayout } from './layouts/TreeLayout'
import { computeTreemapLayout } from './layouts/TreemapLayout'
import { computeRadialTreeLayout } from './layouts/RadialTreeLayout'
import { computeForceLayout } from './layouts/ForceLayout'
import { computeCircleLayout } from './layouts/CircleLayout'
import { computeGridLayout } from './layouts/GridLayout'
import { computePackLayout } from './layouts/PackLayout'

function runLayout(
  type: MondrianLayoutType,
  root: GraphNode,
  options: LayoutOptions,
): LayoutResult {
  switch (type) {
    case 'treemap':
      return computeTreemapLayout(root, options)
    case 'radialTree':
      return computeRadialTreeLayout(root, options)
    case 'force':
      return computeForceLayout(root, options)
    case 'circle':
      return computeCircleLayout(root, options)
    case 'grid':
      return computeGridLayout(root, options)
    case 'pack':
      return computePackLayout(root, options)
    case 'tree':
    default:
      return computeTreeLayout(root, options)
  }
}

/**
 * Compute layout with support for nested subgraphs.
 *
 * Two-pass approach:
 * 1. Run outer layout normally
 * 2. For positioned nodes with subgraphs, compute inner layouts recursively
 *    and attach them + expand node bounds to fit
 */
export function computeLayout(
  type: MondrianLayoutType,
  root: GraphNode,
  options: LayoutOptions,
): LayoutResult {
  const result = runLayout(type, root, options)

  // Post-process: resolve subgraphs on positioned nodes
  const padding = 10
  for (const node of result.nodes) {
    if (!node.data.subgraph?.nodes.length) continue

    // Build a synthetic root for the subgraph children
    const subRoot: GraphNode = {
      label: node.data.label,
      children: node.data.subgraph.nodes,
    }

    const subType = node.data.subgraph.layout ?? type
    const innerResult = computeLayout(subType, subRoot, {
      ...options,
      containerWidth: Math.max(options.nodeWidth * 3, 300),
      containerHeight: Math.max(options.nodeHeight * 4, 200),
    })

    // Expand node to fit inner layout
    node.width = Math.max(node.width, innerResult.width + padding * 2)
    node.height = Math.max(node.height, innerResult.height + padding * 2)
    node.innerLayout = innerResult
  }

  return result
}

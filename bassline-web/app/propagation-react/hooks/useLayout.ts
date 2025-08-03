import { useCallback } from 'react'
import dagre from '@dagrejs/dagre'
import type { Node, Edge } from '@xyflow/react'
import { useNetworkContext } from '../contexts/NetworkContext'
import { useSound } from '~/components/SoundSystem'

// Node dimensions for different types
const NODE_DIMENSIONS = {
  contact: { width: 60, height: 48 },
  boundary: { width: 60, height: 48 },
  primitive: { width: 50, height: 50 },
  // Gadgets have variable dimensions, will be measured from DOM
} as const

export type LayoutDirection = 'TB' | 'BT' | 'LR' | 'RL'

interface LayoutOptions {
  direction?: LayoutDirection
  nodeSpacing?: number
  rankSpacing?: number
  animate?: boolean
}

export function useLayout() {
  const { nodes, edges, setNodes, syncToReactFlow, network } = useNetworkContext()
  const { play: playLayoutSound } = useSound('ui/layout')

  const getNodeDimensions = useCallback((node: Node) => {
    // Try to get actual dimensions from DOM
    const domNode = document.querySelector(`[data-id="${node.id}"]`)
    if (domNode) {
      const rect = domNode.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }

    // Fall back to default dimensions based on type
    const type = node.type as keyof typeof NODE_DIMENSIONS
    if (type in NODE_DIMENSIONS) {
      return NODE_DIMENSIONS[type]
    }

    // Default for gadget nodes
    return { width: 200, height: 150 }
  }, [])

  const getLayoutedElements = useCallback((
    nodesToLayout: Node[],
    edgesToLayout: Edge[],
    options: LayoutOptions = {}
  ) => {
    const {
      direction = 'LR',
      nodeSpacing = 50,
      rankSpacing = 100,
    } = options

    const isHorizontal = direction === 'LR' || direction === 'RL'
    
    // Create a new directed graph
    const dagreGraph = new dagre.graphlib.Graph()
    dagreGraph.setDefaultEdgeLabel(() => ({}))
    
    // Set graph configuration
    dagreGraph.setGraph({
      rankdir: direction,
      nodesep: nodeSpacing,
      ranksep: rankSpacing,
      marginx: 20,
      marginy: 20,
    })

    // Add nodes to dagre graph
    nodesToLayout.forEach((node) => {
      const dimensions = getNodeDimensions(node)
      dagreGraph.setNode(node.id, dimensions)
    })

    // Add edges to dagre graph
    edgesToLayout.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target)
    })

    // Calculate the layout
    dagre.layout(dagreGraph)

    // Apply the calculated positions
    const layoutedNodes = nodesToLayout.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id)
      const dimensions = getNodeDimensions(node)
      
      return {
        ...node,
        targetPosition: isHorizontal ? 'left' : 'top',
        sourcePosition: isHorizontal ? 'right' : 'bottom',
        // Dagre gives center position, React Flow needs top-left
        position: {
          x: nodeWithPosition.x - dimensions.width / 2,
          y: nodeWithPosition.y - dimensions.height / 2,
        },
      }
    })

    return layoutedNodes
  }, [getNodeDimensions])

  const applyLayout = useCallback((options: LayoutOptions = {}) => {
    const layoutedNodes = getLayoutedElements(nodes, edges, options)
    
    // Update positions in the core network
    layoutedNodes.forEach(node => {
      const contact = network.findContact(node.id)
      if (contact) {
        contact.position = node.position
      } else {
        const group = network.findGroup(node.id)
        if (group) {
          group.position = node.position
        }
      }
    })
    
    // Sync to React Flow to update the UI
    syncToReactFlow()
    playLayoutSound()
  }, [nodes, edges, getLayoutedElements, network, syncToReactFlow, playLayoutSound])

  const applyLayoutToSelection = useCallback((
    selectedNodeIds: Set<string>,
    options: LayoutOptions = {}
  ) => {
    // Get selected nodes and their edges
    const selectedNodes = nodes.filter(node => selectedNodeIds.has(node.id))
    const selectedEdges = edges.filter(edge => 
      selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    )
    
    if (selectedNodes.length === 0) return
    
    // Layout only selected nodes
    const layoutedSelectedNodes = getLayoutedElements(selectedNodes, selectedEdges, options)
    
    // Update positions in the core network for selected nodes
    layoutedSelectedNodes.forEach(node => {
      const contact = network.findContact(node.id)
      if (contact) {
        contact.position = node.position
      } else {
        const group = network.findGroup(node.id)
        if (group) {
          group.position = node.position
        }
      }
    })
    
    // Sync to React Flow to update the UI
    syncToReactFlow()
    playLayoutSound()
  }, [nodes, edges, getLayoutedElements, network, syncToReactFlow, playLayoutSound])

  return {
    applyLayout,
    applyLayoutToSelection,
  }
}
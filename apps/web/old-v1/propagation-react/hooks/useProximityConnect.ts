import { useState, useCallback, useEffect } from 'react'
import type { Node, Edge } from '@xyflow/react'
import type { Position } from '../../propagation-core'

const MIN_DISTANCE = 50 // Minimum distance in pixels between handles to trigger proximity connection

interface ProximityState {
  closestPair: { sourceNode: string; targetNode: string; sourceHandle?: string; targetHandle?: string } | null
  potentialEdge: Edge | null
}

// Assuming standard node dimensions and handle positions
const NODE_WIDTH = 180
const NODE_HEIGHT = 40

interface HandlePosition {
  nodeId: string
  handleId?: string
  position: Position
  type: 'source' | 'target'
}

export function useProximityConnect(nodes: Node[], edges: Edge[]) {
  const [proximityState, setProximityState] = useState<ProximityState>({
    closestPair: null,
    potentialEdge: null
  })
  
  // Get handle positions for a node
  const getHandlePositions = useCallback((node: Node): HandlePosition[] => {
    const positions: HandlePosition[] = []
    
    // For regular nodes, assume one source handle on right, one target handle on left
    if (node.type === 'contact' || node.type === 'boundary') {
      // Target handle on left
      positions.push({
        nodeId: node.id,
        position: { 
          x: node.position.x, 
          y: node.position.y + NODE_HEIGHT / 2 
        },
        type: 'target'
      })
      
      // Source handle on right
      positions.push({
        nodeId: node.id,
        position: { 
          x: node.position.x + NODE_WIDTH, 
          y: node.position.y + NODE_HEIGHT / 2 
        },
        type: 'source'
      })
    }
    
    // For group nodes, they might have multiple handles (one per boundary contact)
    // For now, we'll treat them the same as regular nodes
    // In a real implementation, we'd need to get the actual handle positions from the node data
    
    return positions
  }, [])
  
  const findClosestHandlePair = useCallback((draggedNodeId: string, draggedPosition: Position): {
    sourceNode: string
    targetNode: string 
    sourceHandle?: string
    targetHandle?: string
    distance: number
  } | null => {
    let closestPair = null
    let minDistance = MIN_DISTANCE
    
    const draggedNode = nodes.find(n => n.id === draggedNodeId)
    if (!draggedNode) return null
    
    const draggedHandles = getHandlePositions({
      ...draggedNode,
      position: draggedPosition
    })
    
    for (const otherNode of nodes) {
      if (otherNode.id === draggedNodeId) continue
      
      const otherHandles = getHandlePositions(otherNode)
      
      // Check all handle combinations
      for (const draggedHandle of draggedHandles) {
        for (const otherHandle of otherHandles) {
          // Only connect source to target
          if (draggedHandle.type === otherHandle.type) continue
          
          // Calculate distance between handles
          const dx = draggedHandle.position.x - otherHandle.position.x
          const dy = draggedHandle.position.y - otherHandle.position.y
          const distance = Math.sqrt(dx * dx + dy * dy)
          
          if (distance < minDistance) {
            // Check if edge already exists
            const sourceNode = draggedHandle.type === 'source' ? draggedNodeId : otherNode.id
            const targetNode = draggedHandle.type === 'target' ? draggedNodeId : otherNode.id
            
            const edgeExists = edges.some(edge => 
              (edge.source === sourceNode && edge.target === targetNode) ||
              (edge.source === targetNode && edge.target === sourceNode)
            )
            
            if (!edgeExists) {
              minDistance = distance
              closestPair = {
                sourceNode,
                targetNode,
                sourceHandle: draggedHandle.handleId,
                targetHandle: otherHandle.handleId,
                distance
              }
            }
          }
        }
      }
    }
    
    return closestPair
  }, [nodes, edges, getHandlePositions])
  
  const onNodeDrag = useCallback((event: any, node: Node) => {
    const closestPair = findClosestHandlePair(node.id, node.position)
    
    if (closestPair) {
      // Create temporary edge
      const potentialEdge: Edge = {
        id: `temp-${closestPair.sourceNode}-${closestPair.targetNode}`,
        source: closestPair.sourceNode,
        target: closestPair.targetNode,
        sourceHandle: closestPair.sourceHandle,
        targetHandle: closestPair.targetHandle,
        animated: true,
        style: { 
          stroke: '#4ade80', 
          strokeWidth: 3,
          opacity: Math.max(0.3, 1 - (closestPair.distance / MIN_DISTANCE))
        }
      }
      
      setProximityState({
        closestPair,
        potentialEdge
      })
    } else {
      setProximityState({
        closestPair: null,
        potentialEdge: null
      })
    }
  }, [findClosestHandlePair])
  
  const onNodeDragStop = useCallback((event: any, node: Node) => {
    const { closestPair, potentialEdge } = proximityState
    
    if (closestPair && potentialEdge) {
      // Return the connection to be made
      return {
        source: potentialEdge.source,
        target: potentialEdge.target,
        sourceHandle: potentialEdge.sourceHandle,
        targetHandle: potentialEdge.targetHandle
      }
    }
    
    // Clear proximity state
    setProximityState({
      closestPair: null,
      potentialEdge: null
    })
    
    return null
  }, [proximityState])
  
  const clearProximityState = useCallback(() => {
    setProximityState({
      closestPair: null,
      potentialEdge: null
    })
  }, [])
  
  return {
    potentialEdge: proximityState.potentialEdge,
    onNodeDrag,
    onNodeDragStop,
    clearProximityState
  }
}
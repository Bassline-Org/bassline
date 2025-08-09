/**
 * Hook to manage stable node positions and prevent unnecessary re-renders
 * Keeps node positions stable even when data updates
 */

import { useRef, useCallback, useMemo } from 'react'
import type { Node } from '@xyflow/react'

interface NodePositionCache {
  [nodeId: string]: { x: number; y: number }
}

export function useStableNodes() {
  // Cache positions to prevent jumping
  const positionCache = useRef<NodePositionCache>({})
  const nodeCache = useRef<Map<string, Node>>(new Map())
  
  // Update position cache when nodes move
  const updatePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    positionCache.current[nodeId] = position
  }, [])
  
  // Get cached position or default
  const getPosition = useCallback((nodeId: string, defaultPosition: { x: number; y: number }) => {
    return positionCache.current[nodeId] || defaultPosition
  }, [])
  
  // Create or update node with stable position
  const createStableNode = useCallback((
    nodeId: string,
    nodeType: string,
    nodeData: any,
    defaultPosition: { x: number; y: number }
  ): Node => {
    const cachedNode = nodeCache.current.get(nodeId)
    const position = getPosition(nodeId, defaultPosition)
    
    // If node exists and only data changed, update data but keep everything else
    if (cachedNode && cachedNode.type === nodeType) {
      const updatedNode = {
        ...cachedNode,
        data: nodeData,
        position // Use cached position
      }
      nodeCache.current.set(nodeId, updatedNode)
      return updatedNode
    }
    
    // Create new node
    const newNode: Node = {
      id: nodeId,
      type: nodeType,
      position,
      data: nodeData
    }
    
    nodeCache.current.set(nodeId, newNode)
    positionCache.current[nodeId] = position
    return newNode
  }, [getPosition])
  
  // Clear cache for removed nodes
  const removeNode = useCallback((nodeId: string) => {
    nodeCache.current.delete(nodeId)
    delete positionCache.current[nodeId]
  }, [])
  
  // Clear all caches
  const clearCache = useCallback(() => {
    nodeCache.current.clear()
    positionCache.current = {}
  }, [])
  
  return {
    createStableNode,
    updatePosition,
    removeNode,
    clearCache,
    getPosition
  }
}
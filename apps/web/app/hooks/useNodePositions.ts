import { useCallback, useRef } from 'react'

interface Position {
  x: number
  y: number
}

/**
 * Simple hook to manage node positions in memory
 * In the future, this could be persisted to localStorage or database
 */
export function useNodePositions(groupId: string) {
  // Store positions in a ref to avoid re-renders
  const positionsRef = useRef<Map<string, Position>>(new Map())
  
  const getPosition = useCallback((nodeId: string, defaultPosition: Position): Position => {
    const stored = positionsRef.current.get(nodeId)
    return stored || defaultPosition
  }, [])
  
  const setPosition = useCallback((nodeId: string, position: Position) => {
    positionsRef.current.set(nodeId, position)
  }, [])
  
  const clearPositions = useCallback(() => {
    positionsRef.current.clear()
  }, [])
  
  return {
    getPosition,
    setPosition,
    clearPositions
  }
}
import { useEffect, useRef, useCallback } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'

/**
 * Hook that automatically syncs to React Flow after the provided function executes
 */
export function useAutoSync<T extends (...args: any[]) => any>(fn: T): T {
  const { syncToReactFlow } = useNetworkContext()
  
  return useCallback((...args: Parameters<T>) => {
    const result = fn(...args)
    syncToReactFlow()
    return result
  }, [fn, syncToReactFlow]) as T
}

/**
 * Hook for subscribing to network events (for future use)
 */
export function useNetworkSubscription(
  eventName: string,
  handler: (...args: any[]) => void
) {
  const { network } = useNetworkContext()
  const handlerRef = useRef(handler)
  
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])
  
  useEffect(() => {
    // TODO: When we add event emitter to network, subscribe here
    // For now, this is a placeholder for future functionality
    
    return () => {
      // Cleanup subscription
    }
  }, [network, eventName])
}

/**
 * Hook that provides a stable reference to the sync function
 */
export function useSync() {
  const { syncToReactFlow } = useNetworkContext()
  return syncToReactFlow
}
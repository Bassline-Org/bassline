/**
 * React integration for proper-bassline
 * Components ARE gadgets in the propagation network
 */

import { 
  useSyncExternalStore, 
  useCallback, 
  useRef, 
  useEffect, 
  useState, 
  useContext, 
  createContext,
  useMemo,
  type ReactNode 
} from 'react'
import { Network } from './network'
import { Cell } from './cell'
import { FunctionGadget } from './function'
import type { Gadget, LatticeValue } from './types'
import { nil, ordinalValue, getMapValue } from './types'

// ============================================================================
// Network Context
// ============================================================================

interface NetworkContextValue {
  network: Network
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export function NetworkProvider({ 
  children,
  network
}: { 
  children: ReactNode
  network?: Network
}) {
  const [contextValue] = useState<NetworkContextValue>(() => ({
    network: network || new Network('main')
  }))
  
  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  )
}

// ============================================================================
// useGadget Hook
// ============================================================================

/**
 * Create a gadget that lives in the network
 * The component using this hook IS a gadget
 */
export function useGadget<T extends Gadget>(
  createGadget: () => T,
  stableId?: string
): T {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useGadget must be used within NetworkProvider')
  
  const [gadget] = useState<T>(() => {
    // Generate ID - use stable ID if provided
    const id = stableId || `component-${Date.now()}-${Math.random().toString(36).slice(2)}`
    
    // Check if gadget already exists (for stable IDs)
    if (stableId) {
      for (const g of context.network.gadgets) {
        if (g.id === stableId) {
          return g as T
        }
      }
    }
    
    // Create new gadget
    const g = createGadget()
    context.network.add(g)
    return g
  })
  
  // Cleanup on unmount (only if not using stable ID)
  useEffect(() => {
    return () => {
      if (!stableId) {
        context.network.gadgets.delete(gadget)
      }
    }
  }, [gadget, context.network, stableId])
  
  return gadget
}

// ============================================================================
// useCell Hook
// ============================================================================

/**
 * Create a React binding to a Cell
 * Provides useState-like API with automatic propagation
 */
export function useCell<T = any>(
  cell: Cell | null,
  outputName: string = 'default'
): [T | null, (value: T) => void] {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useCell must be used within NetworkProvider')
  
  const [, forceUpdate] = useState({})
  const lastValueRef = useRef<LatticeValue | null>(null)
  const ordinalRef = useRef(0)
  
  // Subscribe to changes
  const subscribe = useCallback((callback: () => void) => {
    if (!cell) return () => {}
    
    // Poll for changes
    const interval = setInterval(() => {
      const currentValue = cell.outputs.get(outputName)
      if (currentValue !== lastValueRef.current) {
        lastValueRef.current = currentValue || null
        callback()
      }
    }, 16) // 60fps
    
    return () => clearInterval(interval)
  }, [cell, outputName])
  
  // Get current value - extract from ordinal map if present
  const getSnapshot = useCallback((): LatticeValue | null => {
    if (!cell) return null
    const output = cell.outputs.get(outputName) || null
    // If it's an ordinal map, extract the value
    return getMapValue(output) || output
  }, [cell, outputName])
  
  // Server snapshot for SSR
  const getServerSnapshot = useCallback(() => null, [])
  
  // Use React's external store hook
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  
  // Setter that creates ordinal-tagged values
  const setValue = useCallback((newValue: T) => {
    if (!cell) return
    
    // Create ordinal-tagged value
    const ordinalVal = ordinalValue(++ordinalRef.current, newValue as any)
    
    // Set it directly on the cell
    cell.setOutput(outputName, ordinalVal)
    
    // Trigger computation
    cell.compute()
    
    // Propagate through the network
    context.network.propagate()
  }, [cell, outputName, context])
  
  return [value as T | null, setValue]
}

// ============================================================================
// useFunction Hook
// ============================================================================

/**
 * Get output from a Function gadget
 * Functions don't have setters - they compute from inputs
 */
export function useFunctionOutput<T = any>(
  func: FunctionGadget | null,
  outputName: string = 'default'
): T | null {
  const [, forceUpdate] = useState({})
  const lastValueRef = useRef<LatticeValue | null>(null)
  
  // Poll for changes
  useEffect(() => {
    if (!func) return
    
    const interval = setInterval(() => {
      const currentValue = func.outputs.get(outputName)
      if (currentValue !== lastValueRef.current) {
        lastValueRef.current = currentValue || null
        forceUpdate({})
      }
    }, 16) // 60fps
    
    return () => clearInterval(interval)
  }, [func, outputName])
  
  if (!func) return null
  return func.outputs.get(outputName) as T | null
}

// ============================================================================
// useWiring Hook
// ============================================================================

/**
 * Wire gadgets together declaratively
 */
export function useWiring(
  connections: Array<{
    from: Gadget | null
    to: Gadget | null
    fromOutput?: string
    toInput?: string
  }>
) {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useWiring must be used within NetworkProvider')
  
  useEffect(() => {
    const established: Array<() => void> = []
    
    for (const conn of connections) {
      if (!conn.from || !conn.to) continue
      
      const outputName = conn.fromOutput || 'default'
      
      if (conn.to instanceof Cell) {
        // Wire to a Cell (many-to-one)
        conn.to.connectFrom(conn.from, outputName)
        established.push(() => {
          // Disconnect logic would go here
          // For now, we don't have a disconnect method
        })
      } else if (conn.to instanceof FunctionGadget && conn.toInput) {
        // Wire to a Function input
        conn.to.connectFrom(conn.toInput, conn.from, outputName)
        established.push(() => {
          // Disconnect logic
        })
      }
    }
    
    // Trigger propagation after wiring
    context.network.propagate()
    
    return () => {
      // Cleanup connections
      for (const cleanup of established) {
        cleanup()
      }
    }
  }, [connections, context])
}

// ============================================================================
// useNetwork Hook
// ============================================================================

/**
 * Get the current network from context
 * Networks are gadgets too!
 */
export function useNetwork(): Network {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useNetwork must be used within NetworkProvider')
  return context.network
}

// ============================================================================
// usePropagate Hook
// ============================================================================

/**
 * Get a propagate function for manual triggering
 */
export function usePropagate(): () => void {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('usePropagate must be used within NetworkProvider')
  
  return useCallback(() => {
    context.network.propagate()
  }, [context])
}
/**
 * React integration for proper-bassline
 * Provides hooks and components for using the new Cell/Function model in React
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
import { nil } from './types'

// ============================================================================
// Network Context
// ============================================================================

interface NetworkContextValue {
  network: Network
  subscriptions: Map<string, Set<() => void>>
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
    network: network || new Network('main'),
    subscriptions: new Map()
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
 * Create and manage a gadget's lifecycle in React
 */
export function useGadget<T extends Gadget>(
  createGadget: () => T,
  deps: React.DependencyList = []
): T {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useGadget must be used within NetworkProvider')
  
  const [gadget] = useState<T>(() => {
    const g = createGadget()
    context.network.add(g)
    return g
  })
  
  // Re-create if deps change
  useEffect(() => {
    if (deps.length > 0) {
      // Remove old gadget
      context.network.gadgets.delete(gadget)
      
      // Create and add new one
      const newGadget = createGadget()
      context.network.add(newGadget)
      
      // Note: This would need state update to work properly
      // For now, deps should be empty for stable gadgets
    }
  }, deps)
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      context.network.gadgets.delete(gadget)
    }
  }, [gadget, context.network])
  
  return gadget
}

// ============================================================================
// useGadgetOutput Hook
// ============================================================================

/**
 * Subscribe to a gadget's output and re-render on changes
 */
export function useGadgetOutput<T = LatticeValue>(
  gadget: Gadget | null,
  outputName: string = 'default'
): T | null {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useGadgetOutput must be used within NetworkProvider')
  
  const [, forceUpdate] = useState({})
  
  // Subscribe to changes
  useEffect(() => {
    if (!gadget) return
    
    const gadgetId = gadget.id
    const subscription = () => forceUpdate({})
    
    // Add to subscription map
    if (!context.subscriptions.has(gadgetId)) {
      context.subscriptions.set(gadgetId, new Set())
    }
    context.subscriptions.get(gadgetId)!.add(subscription)
    
    // Poll for changes (simple approach for now)
    const interval = setInterval(() => {
      // Check if output changed
      subscription()
    }, 16) // 60fps
    
    return () => {
      clearInterval(interval)
      context.subscriptions.get(gadgetId)?.delete(subscription)
    }
  }, [gadget, outputName, context])
  
  if (!gadget) return null
  
  const output = gadget.outputs.get(outputName)
  return output as T
}

// ============================================================================
// useGadgetInput Hook
// ============================================================================

/**
 * Set input on a gadget and trigger propagation
 */
export function useGadgetInput(
  gadget: Gadget | null,
  inputName?: string
): (value: LatticeValue) => void {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useGadgetInput must be used within NetworkProvider')
  
  return useCallback((value: LatticeValue) => {
    if (!gadget) return
    
    if (gadget instanceof Cell) {
      // For cells, we need to create a temporary source
      // This is a bit hacky - in real use you'd wire from another gadget
      console.warn('Setting input directly on Cell - consider wiring from another gadget')
    } else if (gadget instanceof FunctionGadget && inputName) {
      // For functions, we can set named inputs
      // But really they should be wired too
      console.warn('Setting input directly on Function - consider wiring from another gadget')
    }
    
    // Set the output (which will be read by connected gadgets)
    gadget.setOutput(inputName || 'default', value)
    
    // Trigger propagation
    context.network.propagate()
  }, [gadget, inputName, context])
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
// useCellBuilder Hook
// ============================================================================

/**
 * Build cells with chainable API in React
 */
export function useCellBuilder<T extends Cell>(
  CellClass: new (id: string) => T,
  sources: Gadget[] = []
): T {
  const gadget = useGadget(() => {
    const cell = new CellClass(`cell-${Date.now()}`)
    if (sources.length > 0) {
      cell.from(...sources)
    }
    return cell
  }, []) // Empty deps for now
  
  return gadget
}

// ============================================================================
// useFunctionBuilder Hook
// ============================================================================

/**
 * Build functions with connection object API in React
 */
export function useFunctionBuilder<T extends FunctionGadget>(
  FunctionClass: new (id: string) => T,
  inputs: Record<string, Gadget> = {}
): T {
  const gadget = useGadget(() => {
    const func = new FunctionClass(`func-${Date.now()}`)
    if (Object.keys(inputs).length > 0) {
      func.connect(inputs)
    }
    return func
  }, []) // Empty deps for now
  
  return gadget
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
/**
 * React integration for proper-bassline
 * Gadgets as state management layer
 */

import { 
  useCallback, 
  useRef, 
  useEffect, 
  useState, 
  useContext, 
  createContext,
  type ReactNode 
} from 'react'
import { Network } from '../../proper-bassline/src/network'
import { Cell } from '../../proper-bassline/src/cell'
import { OrdinalCell } from '../../proper-bassline/src/cells/basic'
import { FunctionGadget } from '../../proper-bassline/src/function'
import type { Gadget } from '../../proper-bassline/src/gadget'
import type { LatticeValue } from '../../proper-bassline/src/types'
import { getMapValue } from '../../proper-bassline/src/types'

// ============================================================================
// Network Context
// ============================================================================

interface NetworkContextValue {
  network: Network
}

const NetworkContext = createContext<NetworkContextValue | null>(null)

export { NetworkContext }

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
// useNetwork Hook
// ============================================================================

/**
 * Get the current network from context
 */
export function useNetwork(): Network {
  const context = useContext(NetworkContext)
  if (!context) throw new Error('useNetwork must be used within NetworkProvider')
  return context.network
}

// ============================================================================
// useCell Hook - Primary state management hook
// ============================================================================

/**
 * React binding to a Cell - like useState but backed by a gadget
 * Uses the accept/emit protocol for updates
 */
export function useCell<T = any>(
  cell: Cell | null
): [T | null, (value: T) => void] {
  const [, forceUpdate] = useState({})
  const mountedRef = useRef(true)
  
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  
  // Subscribe to changes via the propagation protocol
  useEffect(() => {
    if (!cell) return
    
    // Create a temporary gadget to receive updates
    const receiver = {
      id: `react-receiver-${Math.random()}`,
      accept: () => {
        if (mountedRef.current) {
          forceUpdate({})
        }
      }
    } as any
    
    // Register as downstream
    cell.addDownstream(receiver)
    
    return () => {
      cell.removeDownstream(receiver)
    }
  }, [cell])
  
  // Get current value
  const value = cell ? cell.getOutput() : null
  
  // For OrdinalCell, extract the value from the ordinal map
  const extracted = value ? (getMapValue(value) ?? value) : null
  
  // Get the actual JS value from the LatticeValue wrapper
  // Special handling for sets - keep them as sets
  const extractedValue = extracted ? 
    (extracted.type === 'set' ? extracted.value : (extracted as any).value) : 
    null
  
  // Setter function
  const setValue = useCallback((newValue: T) => {
    if (!cell) return
    
    // Special handling for OrdinalCell
    if (cell instanceof OrdinalCell) {
      // Use the userInput method for OrdinalCell
      cell.userInput(newValue as any)
    } else {
      // For other cells, use accept
      cell.accept(newValue as any, cell)
    }
  }, [cell])
  
  return [extractedValue as T | null, setValue]
}

// ============================================================================
// useGadget Hook - Create gadgets that live in the network
// ============================================================================

/**
 * Create a gadget that lives in the network
 * Optionally provide a stable ID for persistence across re-renders
 */
export function useGadget<T extends Gadget>(
  createGadget: () => T,
  stableId?: string
): T {
  const network = useNetwork()
  
  const [gadget] = useState<T>(() => {
    // Check if gadget already exists (for stable IDs)
    if (stableId) {
      const existing = network.getByPath(stableId)
      if (existing) return existing as T
    }
    
    // Create new gadget
    const g = createGadget()
    network.add(g)
    return g
  })
  
  // Cleanup on unmount (only if not using stable ID)
  useEffect(() => {
    return () => {
      if (!stableId) {
        network.gadgets.delete(gadget)
      }
    }
  }, [gadget, network, stableId])
  
  return gadget
}

// ============================================================================
// useFunction Hook - Get output from a function gadget
// ============================================================================

/**
 * Subscribe to a function gadget's output
 */
export function useFunctionOutput<T = any>(
  func: FunctionGadget | null
): T | null {
  const [, forceUpdate] = useState({})
  const mountedRef = useRef(true)
  
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  
  // Subscribe to changes
  useEffect(() => {
    if (!func) return
    
    // Create a temporary gadget to receive updates
    const receiver = {
      id: `react-function-receiver-${Math.random()}`,
      accept: () => {
        if (mountedRef.current) {
          forceUpdate({})
        }
      }
    } as any
    
    // Register as downstream
    func.addDownstream(receiver)
    
    return () => {
      func.removeDownstream(receiver)
    }
  }, [func])
  
  if (!func) return null
  const value = func.getOutput()
  
  // Extract from ordinal map if needed
  const extracted = getMapValue(value) ?? value
  
  // Get the actual JS value from the LatticeValue wrapper
  return extracted ? (extracted as any).value : null
}

// ============================================================================
// useWiring Hook - Declarative wiring
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
  useEffect(() => {
    const established: Array<() => void> = []
    
    for (const conn of connections) {
      if (!conn.from || !conn.to) continue
      
      const outputName = conn.fromOutput || 'default'
      
      if (conn.to instanceof Cell) {
        // Wire to a Cell (many-to-one)
        conn.to.connectFrom(conn.from, outputName)
        established.push(() => {
          // TODO: Add disconnect method to Cell
        })
      } else if (conn.to instanceof FunctionGadget && conn.toInput) {
        // Wire to a Function input
        conn.to.connectFrom(conn.toInput, conn.from, outputName)
        established.push(() => {
          // TODO: Add disconnect method to FunctionGadget
        })
      }
    }
    
    return () => {
      // Cleanup connections
      for (const cleanup of established) {
        cleanup()
      }
    }
  }, [connections])
}

// ============================================================================
// useImport Hook - Import gadgets with aliasing
// ============================================================================

/**
 * Import an external gadget into the current network with a local name
 */
export function useImport<T extends Gadget>(
  localName: string,
  externalGadget: T
): Cell {
  const network = useNetwork()
  
  const [local] = useState(() => {
    // Check if already imported
    const existing = network.getByPath(localName)
    if (existing instanceof Cell) return existing
    
    // Create import (alias via wiring)
    return network.import(localName, externalGadget)
  })
  
  return local
}
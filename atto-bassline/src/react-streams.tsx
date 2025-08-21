/**
 * React hooks for connecting to atto-bassline streams
 * Uses useSyncExternalStore for correct React 18+ concurrent mode behavior
 */

import { useSyncExternalStore, useCallback, useRef, useEffect, useReducer, useState, useContext, createContext } from 'react'
import { createReader, createBiStream, type Reader, type Writer, type BiStream, type BufferedReader } from './streams'
import { signal, wire, unwire, type Signal, type Contact, type Gadget, createSignal } from './types'
import { propagate, withTransaction, beginTransaction, commitTransaction, rollbackTransaction } from './propagation'
import { toUnits, fromUnits } from './strength'

// Network context for accessing gadgets
interface NetworkContext {
  gadgets: Map<string, Gadget>
}

const NetworkContext = createContext<NetworkContext | null>(null)

export function NetworkProvider({ children, network }: { children: React.ReactNode, network: NetworkContext }) {
  return <NetworkContext.Provider value={network}>{children}</NetworkContext.Provider>
}

/**
 * Hook to find a gadget by ID in the network
 */
export function useGadget(gadgetId: string): Gadget | null {
  const network = useContext(NetworkContext)
  if (!network) {
    return null
  }
  return network.gadgets.get(gadgetId) || null
}

/**
 * Hook to tap into a contact with a useState-like API
 * Directly monitors and writes to gadget contacts
 */
export function useContact<T = any>(gadget: Gadget | null, contactName: string): [T | null, (value: T) => void] {
  // Track strength for monotonic writes
  const strengthRef = useRef(10000)
  
  // Subscribe to contact changes by listening to propagation events
  const subscribe = useCallback((callback: () => void) => {
    if (!gadget) return () => {}
    
    const contact = gadget.contacts.get(contactName)
    if (!contact) return () => {}
    
    // Create a simple change detector - check value and strength, not object reference
    let lastValue = contact.signal.value
    let lastStrength = contact.signal.strength
    
    console.log(`[useContact] Starting subscription for ${gadget.id}:${contactName} with initial value:`, lastValue)
    
    const checkForChanges = () => {
      const currentSignal = contact.signal
      if (currentSignal.value !== lastValue || currentSignal.strength !== lastStrength) {
        console.log(`[useContact] Change detected for ${gadget.id}:${contactName}: ${lastValue} -> ${currentSignal.value}`)
        lastValue = currentSignal.value
        lastStrength = currentSignal.strength
        callback()
      }
    }
    
    // Poll for changes (temporary - ideally we'd hook into propagation events)
    const interval = setInterval(checkForChanges, 16) // ~60fps
    
    return () => clearInterval(interval)
  }, [gadget, contactName])
  
  // Get current value from the gadget contact
  const getSnapshot = useCallback((): T | null => {
    if (!gadget) return null
    const contact = gadget.contacts.get(contactName)
    return contact?.signal.value as T
  }, [gadget, contactName])
  
  // Get server snapshot (for SSR)
  const getServerSnapshot = useCallback((): T | null => null, [])
  
  // Use React 18's external store hook
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  
  // Write function with automatic strength management
  const setValue = useCallback((newValue: T) => {
    if (!gadget) return
    
    const contact = gadget.contacts.get(contactName)
    if (!contact) return
    
    // Always increment strength for monotonic updates
    strengthRef.current += 1
    
    console.log(`[useContact] Writing ${newValue} to ${gadget.id}:${contactName} with strength ${strengthRef.current}`)
    
    // Write directly to the contact
    propagate(contact, createSignal(newValue, strengthRef.current))
    
    // Debug: check if the contact was actually updated
    console.log(`[useContact] After write, contact value is:`, contact.signal.value, 'strength:', contact.signal.strength)
  }, [gadget, contactName])
  
  return [value, setValue]
}

/**
 * Hook to read a signal value from a Reader gadget
 * Returns [value, strength] tuple that updates when the signal changes
 */
export function useContactValue<T = any>(reader: Reader): [T | null, number] {
  const subscribe = useCallback((callback: () => void) => {
    reader.emitter.on('signal', callback)
    return () => reader.emitter.off('signal', callback)
  }, [reader])
  
  const getSnapshot = useCallback((): Signal => {
    // Get current value from the reader's input contact
    const contact = reader.contacts.get('input')
    return contact?.signal || { value: null, strength: 0 }
  }, [reader])
  
  const getServerSnapshot = useCallback((): Signal => {
    // Server rendering always returns null/0
    return { value: null, strength: 0 }
  }, [])
  
  const signal = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  
  // Convert strength from units to decimal
  return [signal.value as T, fromUnits(signal.strength)]
}

/**
 * Hook to get a writer function for a Writer gadget
 * Returns a stable callback that writes values into the network
 */
export function useContactWriter(writer: Writer) {
  return useCallback((value: any, strength: number = 1.0) => {
    writer.write(value, toUnits(strength))
  }, [writer])
}

/**
 * Combined hook for bidirectional binding
 * Returns object with value, strength, and write function
 * @deprecated Use the useState-like useContact(gadget, contactName) instead
 */
export function useContactBinding<T = any>(reader: Reader, writer: Writer): {
  value: T | null
  strength: number
  write: (value: any, strength?: number) => void
} {
  const [value, strength] = useContactValue<T>(reader)
  const write = useContactWriter(writer)
  
  return { value, strength, write }
}

/**
 * Hook to observe a contact and write to it
 * Creates a reader to observe changes and provides a write function
 */
export function useContactStream<T = any>(
  contact: Contact,
  network?: any
): {
  value: T | null
  strength: number
  write: (value: any, strength?: number) => void
} {
  // Create a reader to observe this contact
  const [reader] = useState(() => createReader(`reader-${contact.id}`))
  
  // Wire the contact to the reader on mount
  useEffect(() => {
    // Wire contact to reader input
    wire(contact, reader.contacts.get('input')!)
    
    // Cleanup on unmount
    return () => {
      unwire(contact, reader.contacts.get('input')!)
    }
  }, [contact, reader])
  
  // Use the reader hook to get values
  const [value, strength] = useContactValue<T>(reader)
  
  // Write directly to the contact
  const write = useCallback((val: any, str: number = 1.0) => {
    propagate(contact, signal(val, toUnits(str)))
  }, [contact])
  
  return { value, strength, write }
}

/**
 * Hook for BiStream gadgets (combined reader/writer)
 * Uses the stream's built-in emitter for efficiency
 */
export function useBiStream<T = any>(stream: BiStream): {
  value: T | null
  strength: number
  write: (value: any, strength?: number) => void
} {
  // Subscribe directly to the stream's emitter
  const subscribe = useCallback((callback: () => void) => {
    stream.emitter.on('signal', callback)
    return () => stream.emitter.off('signal', callback)
  }, [stream])
  
  // Get current value from the output contact
  const getSnapshot = useCallback((): Signal => {
    const output = stream.contacts.get('output')
    return output?.signal || { value: null, strength: 0 }
  }, [stream])
  
  const getServerSnapshot = useCallback((): Signal => {
    return { value: null, strength: 0 }
  }, [])
  
  const signal = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  
  // Use the stream's write method directly
  const write = useCallback((val: any, str: number = 1.0) => {
    stream.write(val, toUnits(str))
  }, [stream])
  
  return { 
    value: signal.value as T, 
    strength: fromUnits(signal.strength), 
    write 
  }
}

/**
 * Hook for buffered readers - receives batches of signals
 * Useful for high-frequency updates like audio visualizations
 */
export function useBufferedSignals<T = any>(reader: BufferedReader): T[][] {
  const [batches, setBatches] = useSignalBatches<T>(reader)
  
  // Auto-flush on unmount
  useEffect(() => {
    return () => reader.flush()
  }, [reader])
  
  return batches
}

// Internal hook for batch handling
function useSignalBatches<T>(reader: BufferedReader): [T[][], (batches: T[][]) => void] {
  const batchesRef = useRef<T[][]>([])
  
  const subscribe = useCallback((callback: () => void) => {
    const handleBatch = (signals: Signal[]) => {
      batchesRef.current = [...batchesRef.current, signals.map(s => s.value as T)]
      // Keep only last 100 batches
      if (batchesRef.current.length > 100) {
        batchesRef.current = batchesRef.current.slice(-100)
      }
      callback()
    }
    
    reader.emitter.on('batch', handleBatch)
    return () => reader.emitter.off('batch', handleBatch)
  }, [reader])
  
  const getSnapshot = useCallback(() => batchesRef.current, [])
  const getServerSnapshot = useCallback(() => [], [])
  
  const batches = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  
  const setBatches = useCallback((newBatches: T[][]) => {
    batchesRef.current = newBatches
  }, [])
  
  return [batches, setBatches]
}

/**
 * Hook that auto-wires a reader/writer pair to contacts
 * Handles the wiring on mount and cleanup on unmount
 */
export function useAutoWire(
  reader: Reader | null,
  writer: Writer | null,
  sourceContactId: string | null,
  targetContactId: string | null,
  network: any // TODO: proper Network type
) {
  useEffect(() => {
    const wires: any[] = []
    
    if (reader && sourceContactId) {
      const sourceContact = network.gadgets.get(sourceContactId)
      if (sourceContact) {
        // Wire source to reader input
        // TODO: Implement wiring
      }
    }
    
    if (writer && targetContactId) {
      const targetContact = network.gadgets.get(targetContactId)
      if (targetContact) {
        // Wire writer output to target
        // TODO: Implement wiring  
      }
    }
    
    return () => {
      // Cleanup wires on unmount
      wires.forEach(wire => {
        // TODO: Implement unwiring
      })
    }
  }, [reader, writer, sourceContactId, targetContactId, network])
}

/**
 * Higher-level hook that creates and manages stream gadgets
 * Useful for temporary UI bindings that should clean up when component unmounts
 */
export function useManagedStream<T = any>(id: string, network: any): {
  value: T | null
  strength: number
  write: (value: any, strength?: number) => void
  reader: Reader
  writer: Writer
} {
  // These would normally be created and added to the network
  // For now, returning a placeholder
  // TODO: Implement actual gadget creation and network integration
  
  return {
    value: null,
    strength: 0,
    write: () => {},
    reader: null as any,
    writer: null as any
  }
}

/**
 * Hook for batching multiple network updates into a single transaction
 * Useful for preventing expensive computations during rapid UI updates
 */
export function useTransaction() {
  const isTransactionActive = useRef(false)
  
  const begin = useCallback(() => {
    if (!isTransactionActive.current) {
      beginTransaction()
      isTransactionActive.current = true
    }
  }, [])
  
  const commit = useCallback(() => {
    if (isTransactionActive.current) {
      commitTransaction()
      isTransactionActive.current = false
    }
  }, [])
  
  const rollback = useCallback(() => {
    if (isTransactionActive.current) {
      rollbackTransaction()
      isTransactionActive.current = false
    }
  }, [])
  
  const withTx = useCallback(<T,>(fn: () => T): T => {
    return withTransaction(fn)
  }, [])
  
  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTransactionActive.current) {
        rollback()
      }
    }
  }, [rollback])
  
  return { begin, commit, rollback, withTx }
}

/**
 * Hook for debounced transactions - automatically batches rapid updates
 * and commits them after a delay
 */
export function useDebouncedTransaction(delay: number = 100) {
  const { begin, commit, rollback } = useTransaction()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isActiveRef = useRef(false)
  
  const debouncedCommit = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    if (!isActiveRef.current) {
      begin()
      isActiveRef.current = true
    }
    
    timeoutRef.current = setTimeout(() => {
      commit()
      isActiveRef.current = false
      timeoutRef.current = null
    }, delay)
  }, [begin, commit, delay])
  
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (isActiveRef.current) {
      rollback()
      isActiveRef.current = false
    }
  }, [rollback])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])
  
  return { debouncedCommit, cancel }
}
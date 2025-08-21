/**
 * React integration for pure data templates
 * Components ARE gadgets participating in the propagation network
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
import { instantiate, type Template } from './templates-v2'
import { signal, wire, type Gadget, type Contact } from './types'
import { propagate } from './propagation'

// ============================================================================
// Network Context
// ============================================================================

interface NetworkContextValue {
  gadgets: Map<string, Gadget>
  templates: Map<string, Template>
  connections: Array<{ from: string, to: string }>
  gadgetRegistry: Map<string, Gadget> // Persistent registry of gadgets by ID
}

const NetworkContext = createContext<NetworkContextValue>({
  gadgets: new Map(),
  templates: new Map(),
  connections: [],
  gadgetRegistry: new Map()
})

export function NetworkProvider({ 
  children,
  initialTemplates = new Map()
}: { 
  children: ReactNode
  initialTemplates?: Map<string, Template>
}) {
  const [network] = useState<NetworkContextValue>({
    gadgets: new Map(),
    templates: initialTemplates,
    connections: [],
    gadgetRegistry: new Map()
  })
  
  return (
    <NetworkContext.Provider value={network}>
      {children}
    </NetworkContext.Provider>
  )
}

// ============================================================================
// useTemplate Hook
// ============================================================================

/**
 * Instantiate a template and manage its lifecycle
 * The component becomes a gadget in the network
 */
export function useTemplate<T extends Template>(
  template: T,
  params?: Record<string, any>,
  stableId?: string // Optional stable ID for persistence
): {
  gadget: Gadget
  inputs: Map<string, Contact>
  outputs: Map<string, Contact>
} {
  const network = useContext(NetworkContext)
  const paramsRef = useRef(params)
  const hasInitialized = useRef(false)
  
  const [gadget] = useState(() => {
    // If we have a stable ID, check if gadget already exists in registry
    if (stableId && network.gadgetRegistry.has(stableId)) {
      const existing = network.gadgetRegistry.get(stableId)!
      network.gadgets.set(existing.id, existing)
      return existing
    }
    
    // Create ID - use stable ID if provided, otherwise generate unique one
    const id = stableId || `component-${Date.now()}-${Math.random().toString(36).slice(2)}`
    
    // Instantiate the template
    const instance = instantiate(template, id)
    
    // Set initial parameter values if provided
    if (paramsRef.current) {
      for (const [contactName, value] of Object.entries(paramsRef.current)) {
        const contact = instance.contacts.get(contactName)
        if (contact) {
          propagate(contact, signal(value, 0.1)) // Low strength for initial values
        }
      }
    }
    
    // Register with network
    network.gadgets.set(id, instance)
    
    // If stable ID provided, also register in persistent registry
    if (stableId) {
      network.gadgetRegistry.set(stableId, instance)
    }
    
    return instance
  })
  
  // Params are only used for initial values, not updates
  // If you need to update values, use the useContact hook directly
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      network.gadgets.delete(gadget.id)
      // Don't remove from registry if it has a stable ID (for persistence)
      // The registry keeps gadgets alive across component unmounts
      // TODO: Unwire connections
    }
  }, [gadget.id, network])
  
  // Memoize inputs and outputs to avoid recreating on every render
  const { inputs, outputs } = useMemo(() => {
    const inputs = new Map<string, Contact>()
    const outputs = new Map<string, Contact>()
    
    gadget.contacts.forEach((contact, name) => {
      if (contact.direction === 'input') {
        inputs.set(name, contact)
      } else {
        outputs.set(name, contact)
      }
    })
    
    return { inputs, outputs }
  }, [gadget])
  
  return { gadget, inputs, outputs }
}

// ============================================================================
// useContact Hook
// ============================================================================

/**
 * Create a React binding to a gadget contact
 * Provides useState-like API with automatic propagation
 */
interface UseContactOptions {
  optimistic?: boolean // Update UI immediately, propagate async
  debounce?: number // Debounce delay in ms (0 = no debounce)
  pollInterval?: number // How often to poll for changes
}

export function useContact<T = any>(
  gadget: Gadget | null,
  contactName: string,
  options: UseContactOptions = {}
): [T | null, (value: T) => void, number] {
  const { 
    optimistic = true, 
    debounce = 0,  // No debounce by default
    pollInterval = 16  // 60fps by default for responsive UI
  } = options
  
  const strengthRef = useRef(10000) // Start with base strength
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const optimisticValueRef = useRef<T | null>(null)
  const hasOptimisticUpdate = useRef(false)
  
  // Subscribe to contact changes
  const subscribe = useCallback((callback: () => void) => {
    if (!gadget) return () => {}
    
    const contact = gadget.contacts.get(contactName)
    if (!contact) return () => {}
    
    // Track last values for change detection
    let lastValue = contact.signal.value
    let lastStrength = contact.signal.strength
    
    const checkForChanges = () => {
      const currentSignal = contact.signal
      if (currentSignal.value !== lastValue || currentSignal.strength !== lastStrength) {
        lastValue = currentSignal.value
        lastStrength = currentSignal.strength
        callback()
      }
    }
    
    // Poll for changes at configured interval
    const interval = setInterval(checkForChanges, pollInterval)
    
    return () => clearInterval(interval)
  }, [gadget, contactName, pollInterval])
  
  // Cache for snapshot to avoid infinite loops
  const snapshotCache = useRef<{ value: T | null, strength: number }>({ value: null, strength: 0 })
  
  // Get current value
  const getSnapshot = useCallback((): { value: T | null, strength: number } => {
    if (!gadget) return snapshotCache.current
    const contact = gadget.contacts.get(contactName)
    
    // If we have an optimistic update, use that value
    const currentValue = (optimistic && hasOptimisticUpdate.current) 
      ? optimisticValueRef.current
      : (contact?.signal.value as T || null)
    
    const currentStrength = contact?.signal.strength || 0
    
    // Check if we need to update the cache
    if (snapshotCache.current.value !== currentValue || 
        snapshotCache.current.strength !== currentStrength) {
      // Create new object only when values change
      snapshotCache.current = {
        value: currentValue,
        strength: currentStrength
      }
      // Clear optimistic update when real value catches up
      if (hasOptimisticUpdate.current && contact?.signal.value === optimisticValueRef.current) {
        hasOptimisticUpdate.current = false
      }
    }
    
    // Always return the same cached object reference unless values changed
    return snapshotCache.current
  }, [gadget, contactName, optimistic])
  
  // Server snapshot for SSR
  const getServerSnapshot = useCallback(() => ({ value: null, strength: 0 }), [])
  
  // Use React's external store hook
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  
  // Setter with monotonic strength and optional debouncing
  const setValue = useCallback((newValue: T) => {
    if (!gadget) return
    
    const contact = gadget.contacts.get(contactName)
    if (!contact) return
    
    // Don't propagate if value hasn't changed
    if (contact.signal.value === newValue && !hasOptimisticUpdate.current) return
    
    // Apply optimistic update immediately
    if (optimistic) {
      optimisticValueRef.current = newValue
      hasOptimisticUpdate.current = true
      // Don't modify cache directly - let getSnapshot handle it
    }
    
    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    const doPropagation = () => {
      // Increment strength for each write
      strengthRef.current += 1
      
      // Propagate the new value
      console.log('Propagating to contact:', contactName, 'with value:', newValue, 'on gadget:', gadget.id)
      propagate(contact, signal(newValue as any, strengthRef.current))
      debounceTimerRef.current = null
    }
    
    // If no debounce, propagate immediately
    if (debounce === 0) {
      doPropagation()
    } else {
      // Debounce the actual propagation
      debounceTimerRef.current = setTimeout(doPropagation, debounce)
    }
  }, [gadget, contactName, optimistic, debounce])
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])
  
  return [snapshot.value, setValue, snapshot.strength]
}

// ============================================================================
// useWiring Hook
// ============================================================================

/**
 * Declaratively wire gadgets together
 * Connections are maintained for component lifecycle
 */
export function useWiring(connections: Array<{
  from: { gadget: Gadget | null, contact: string }
  to: { gadget: Gadget | null, contact: string }
}>) {
  useEffect(() => {
    const established: Array<{ from: Contact, to: Contact }> = []
    
    // Establish all connections
    for (const conn of connections) {
      if (!conn.from.gadget || !conn.to.gadget) continue
      
      const fromContact = conn.from.gadget.contacts.get(conn.from.contact)
      const toContact = conn.to.gadget.contacts.get(conn.to.contact)
      
      if (fromContact && toContact) {
        wire(fromContact, toContact)
        established.push({ from: fromContact, to: toContact })
      }
    }
    
    // Cleanup on unmount or change
    return () => {
      for (const conn of established) {
        // TODO: Implement unwire
        // unwire(conn.from, conn.to)
      }
    }
  }, [connections])
}

// ============================================================================
// useGadgetValue Hook
// ============================================================================

/**
 * Simple hook to read a contact value without setting
 * Useful for display-only components
 */
export function useGadgetValue<T = any>(
  gadget: Gadget | null,
  contactName: string
): T | null {
  const [value] = useContact<T>(gadget, contactName)
  return value
}

// ============================================================================
// useGadgetState Hook
// ============================================================================

/**
 * Get all contact values from a gadget as an object
 * Useful for debugging or displaying full gadget state
 */
export function useGadgetState(gadget: Gadget | null): Record<string, any> {
  const [, forceUpdate] = useState({})
  
  useEffect(() => {
    if (!gadget) return
    
    const interval = setInterval(() => {
      forceUpdate({})
    }, 100) // Update 10 times per second
    
    return () => clearInterval(interval)
  }, [gadget])
  
  if (!gadget) return {}
  
  const state: Record<string, any> = {}
  gadget.contacts.forEach((contact, name) => {
    state[name] = contact.signal.value
  })
  
  return state
}

// ============================================================================
// useLiveTemplate Hook
// ============================================================================

/**
 * Create a template that can be modified at runtime
 * Useful for dynamic UI composition
 */
export function useLiveTemplate(
  initialTemplate: Template
): [Template, (updates: Partial<Template>) => void] {
  const [template, setTemplate] = useState(initialTemplate)
  
  const updateTemplate = useCallback((updates: Partial<Template>) => {
    setTemplate(current => ({
      ...current,
      ...updates,
      components: updates.components || current.components,
      connections: updates.connections || current.connections,
      expose: updates.expose || current.expose
    }))
  }, [])
  
  return [template, updateTemplate]
}

// ============================================================================
// useTemplateBuilder Hook
// ============================================================================

/**
 * Build templates incrementally in React
 * Useful for user-constructed gadgets
 */
export function useTemplateBuilder() {
  const [components, setComponents] = useState<Template['components']>([])
  const [connections, setConnections] = useState<Template['connections']>([])
  const [expose, setExpose] = useState<Template['expose']>({})
  
  const addComponent = useCallback((id: string, template: Template) => {
    setComponents(current => [...(current || []), { id, template }])
  }, [])
  
  const addConnection = useCallback((from: string, to: string) => {
    setConnections(current => [...(current || []), { from, to }])
  }, [])
  
  const exposeInput = useCallback((external: string, internal: string) => {
    setExpose(current => ({
      ...current,
      inputs: { ...current?.inputs, [external]: internal }
    }))
  }, [])
  
  const exposeOutput = useCallback((external: string, internal: string) => {
    setExpose(current => ({
      ...current,
      outputs: { ...current?.outputs, [external]: internal }
    }))
  }, [])
  
  const build = useCallback((): Template => {
    return { components, connections, expose }
  }, [components, connections, expose])
  
  const reset = useCallback(() => {
    setComponents([])
    setConnections([])
    setExpose({})
  }, [])
  
  return {
    addComponent,
    addConnection,
    exposeInput,
    exposeOutput,
    build,
    reset,
    template: { components, connections, expose } as Template
  }
}
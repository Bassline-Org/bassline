/**
 * React hook for managing dynamic connections between gadgets
 */

import { useContext, useEffect, useCallback, useRef } from 'react'
import { useTemplate, useContact } from './react-templates'
import { ConnectionManagerTemplate, applyConnection, removeConnection, type Connection } from './connection-manager'
import type { Gadget } from './types'

export interface ConnectionManagerAPI {
  // State
  connectionMode: boolean
  connectionStatus: string
  activeConnections: Connection[]
  pendingConnection: { gadgetId: string; contactName: string } | null
  lastError: string
  
  // Actions
  setConnectionMode: (enabled: boolean) => void
  startConnection: (gadget: Gadget, contactName: string) => void
  completeConnection: (gadget: Gadget, contactName: string) => void
  cancelConnection: () => void
  deleteConnection: (connectionId: string) => void
  
  // Debug
  gadget: Gadget
}

/**
 * Hook to manage dynamic connections between gadgets
 */
export function useConnectionManager(): ConnectionManagerAPI {
  const manager = useTemplate(ConnectionManagerTemplate, {}, 'global-connection-manager')
  
  // Get contacts for reading state
  const [connectionMode, setConnectionMode] = useContact<boolean>(manager.gadget, 'connectionMode')
  const [, setSourceGadgetId] = useContact<string>(manager.gadget, 'sourceGadgetId')
  const [, setSourceContactName] = useContact<string>(manager.gadget, 'sourceContactName')
  const [, setTargetGadgetId] = useContact<string>(manager.gadget, 'targetGadgetId')
  const [, setTargetContactName] = useContact<string>(manager.gadget, 'targetContactName')
  const [, setCreateConnection] = useContact<boolean>(manager.gadget, 'createConnection')
  const [, setDeleteConnectionId] = useContact<string>(manager.gadget, 'deleteConnectionId')
  const [, setClearPending] = useContact<boolean>(manager.gadget, 'clearPending')
  
  // Get outputs
  const [activeConnections] = useContact<Connection[]>(manager.gadget, 'activeConnections')
  const [pendingConnection] = useContact<any>(manager.gadget, 'pendingConnection')
  const [connectionStatus] = useContact<string>(manager.gadget, 'connectionStatus')
  const [lastError] = useContact<string>(manager.gadget, 'lastError')
  
  // Keep track of applied connections to handle wiring
  const appliedConnections = useRef<Set<string>>(new Set())
  
  // Get gadget registry from network context
  const getRegistry = useCallback(() => {
    // Access the global registry through the manager gadget's parent network
    // This is a bit of a hack but works for now
    const win = window as any
    if (!win.__gadgetRegistry) {
      win.__gadgetRegistry = new Map<string, Gadget>()
    }
    return win.__gadgetRegistry as Map<string, Gadget>
  }, [])
  
  // Apply/remove actual wires when connections change
  useEffect(() => {
    if (!activeConnections) return
    
    const registry = getRegistry()
    const currentIds = new Set(activeConnections.map(c => c.id))
    
    // Apply new connections
    for (const connection of activeConnections) {
      if (!appliedConnections.current.has(connection.id)) {
        if (applyConnection(connection, registry)) {
          appliedConnections.current.add(connection.id)
        }
      }
    }
    
    // Remove deleted connections
    for (const connectionId of appliedConnections.current) {
      if (!currentIds.has(connectionId)) {
        // Find the connection in our previous state to remove it
        // This is a bit inefficient but works for now
        const connection = activeConnections.find(c => c.id === connectionId)
        if (connection) {
          removeConnection(connection, registry)
        }
        appliedConnections.current.delete(connectionId)
      }
    }
  }, [activeConnections, getRegistry])
  
  // Start a connection from a gadget/contact
  const startConnection = useCallback((gadget: Gadget, contactName: string) => {
    // Register gadget if not already registered
    const registry = getRegistry()
    if (!registry.has(gadget.id)) {
      registry.set(gadget.id, gadget)
    }
    
    setConnectionMode(true)
    setSourceGadgetId(gadget.id)
    setSourceContactName(contactName)
    setCreateConnection(false)
  }, [setConnectionMode, setSourceGadgetId, setSourceContactName, setCreateConnection, getRegistry])
  
  // Complete a connection to a gadget/contact
  const completeConnection = useCallback((gadget: Gadget, contactName: string) => {
    // Register gadget if not already registered
    const registry = getRegistry()
    if (!registry.has(gadget.id)) {
      registry.set(gadget.id, gadget)
    }
    
    setTargetGadgetId(gadget.id)
    setTargetContactName(contactName)
    setCreateConnection(true)
    
    // Reset after a frame to allow the connection to be created
    requestAnimationFrame(() => {
      setCreateConnection(false)
      setConnectionMode(false)
      setSourceGadgetId('')
      setSourceContactName('')
      setTargetGadgetId('')
      setTargetContactName('')
    })
  }, [setTargetGadgetId, setTargetContactName, setCreateConnection, setConnectionMode, 
      setSourceGadgetId, setSourceContactName, getRegistry])
  
  // Cancel the current connection
  const cancelConnection = useCallback(() => {
    setConnectionMode(false)
    setClearPending(true)
    requestAnimationFrame(() => {
      setClearPending(false)
      setSourceGadgetId('')
      setSourceContactName('')
      setTargetGadgetId('')
      setTargetContactName('')
    })
  }, [setConnectionMode, setClearPending, setSourceGadgetId, setSourceContactName,
      setTargetGadgetId, setTargetContactName])
  
  // Delete a connection by ID
  const deleteConnectionFunc = useCallback((connectionId: string) => {
    setDeleteConnectionId(connectionId)
    requestAnimationFrame(() => {
      setDeleteConnectionId('')
    })
  }, [setDeleteConnectionId])
  
  return {
    // State
    connectionMode: connectionMode || false,
    connectionStatus: connectionStatus || 'idle',
    activeConnections: activeConnections || [],
    pendingConnection,
    lastError: lastError || '',
    
    // Actions
    setConnectionMode,
    startConnection,
    completeConnection,
    cancelConnection,
    deleteConnection: deleteConnectionFunc,
    
    // Debug
    gadget: manager.gadget
  }
}

/**
 * Helper hook to register a gadget with the global registry
 */
export function useRegisterGadget(gadget: Gadget | null) {
  useEffect(() => {
    if (!gadget) return
    
    const win = window as any
    if (!win.__gadgetRegistry) {
      win.__gadgetRegistry = new Map<string, Gadget>()
    }
    
    win.__gadgetRegistry.set(gadget.id, gadget)
    
    return () => {
      // Don't remove from registry on unmount - we want persistence
    }
  }, [gadget])
}
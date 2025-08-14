/**
 * useNetworkBridge Hook
 * Connects React components to the micro-bassline worker
 * Provides single-session architecture with group navigation
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

export interface NetworkStructure {
  contacts: Map<string, any>
  groups: Map<string, any>
  wires: Map<string, any>
}

export interface NetworkBridgeOptions {
  currentGroupId?: string
  autoSave?: boolean
  autoSaveInterval?: number
}

// Singleton worker instance shared across all hook instances
let sharedWorker: Worker | null = null
let sharedWorkerRefCount = 0

export function useNetworkBridge(options: NetworkBridgeOptions = {}) {
  const { 
    currentGroupId = 'root',
    autoSave = true,
    autoSaveInterval = 5000
  } = options
  
  const [structure, setStructure] = useState<NetworkStructure | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [dynamics, setDynamics] = useState<any[]>([])
  const [navigationPath, setNavigationPath] = useState<string[]>(['root'])
  const workerRef = useRef<Worker | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    // Use singleton worker pattern for single session
    if (!sharedWorker) {
      console.log('[NetworkBridge] Creating singleton worker')
      // Use Vite's recommended pattern for loading workers
      sharedWorker = new Worker(
        new URL('../worker/micro-bassline-worker.ts', import.meta.url),
        { type: 'module' }
      )
      
      // Try to restore from localStorage on first creation
      const saved = localStorage.getItem('bassline-network-state')
      if (saved && autoSave) {
        try {
          const state = JSON.parse(saved)
          console.log('[NetworkBridge] Restoring network state from localStorage')
          // Send restore action to worker once it's ready
          setTimeout(() => {
            sharedWorker?.postMessage({
              type: 'restore',
              state
            })
          }, 100)
        } catch (e) {
          console.error('[NetworkBridge] Failed to restore state:', e)
        }
      }
    }
    
    sharedWorkerRefCount++
    workerRef.current = sharedWorker
    
    // Handle messages from worker
    const messageHandler = (e: MessageEvent) => {
      const { type, value, event } = e.data
      
      switch (type) {
        case 'ready':
          console.log('[NetworkBridge] Worker ready')
          setIsReady(true)
          break
          
        case 'structure':
          console.log('[NetworkBridge] Structure update')
          setStructure(value)
          
          // Auto-save to localStorage
          if (autoSave) {
            localStorage.setItem('bassline-network-state', JSON.stringify(value))
          }
          break
          
        case 'dynamics':
          console.log('[NetworkBridge] Dynamics event:', event)
          setDynamics(prev => [...prev, event])
          break
          
        case 'pong':
          console.log('[NetworkBridge] Health check OK')
          break
          
        case 'error':
          console.error('[NetworkBridge] Worker error:', e.data.error)
          break
          
        default:
          console.warn('[NetworkBridge] Unknown message:', type)
      }
    }
    
    sharedWorker.addEventListener('message', messageHandler)
    
    // Handle worker errors
    const errorHandler = (error: ErrorEvent) => {
      console.error('[NetworkBridge] Worker error:', error)
      console.error('[NetworkBridge] Error message:', error.message)
      console.error('[NetworkBridge] Error filename:', error.filename)
      console.error('[NetworkBridge] Error lineno:', error.lineno)
      console.error('[NetworkBridge] Error colno:', error.colno)
    }
    sharedWorker.addEventListener('error', errorHandler)
    
    // Cleanup on unmount
    return () => {
      sharedWorkerRefCount--
      sharedWorker?.removeEventListener('message', messageHandler)
      sharedWorker?.removeEventListener('error', errorHandler)
      
      // Only terminate if this was the last reference
      if (sharedWorkerRefCount === 0 && sharedWorker) {
        console.log('[NetworkBridge] Terminating singleton worker')
        sharedWorker.terminate()
        sharedWorker = null
      }
      
      workerRef.current = null
      
      // Clear auto-save timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [autoSave])
  
  // Send action to network - scoped to current group by default
  const sendAction = useCallback((action: any) => {
    if (!workerRef.current) {
      console.warn('[NetworkBridge] Worker not initialized')
      return
    }
    
    // If action is for a contact/wire and doesn't have a full path, scope to current group
    if (Array.isArray(action)) {
      const [actionType, ...args] = action
      
      // Auto-scope contact/wire operations to current group
      if (actionType === 'createContact' || actionType === 'setValue') {
        const [contactId, ...rest] = args
        // If contactId doesn't contain ':', add current group prefix
        if (!contactId.includes(':')) {
          action = [actionType, `${currentGroupId}:${contactId}`, ...rest]
        }
      } else if (actionType === 'createWire') {
        const [wireId, fromId, toId, ...rest] = args
        // Auto-prefix contact IDs if needed
        const scopedFromId = fromId.includes(':') ? fromId : `${currentGroupId}:${fromId}`
        const scopedToId = toId.includes(':') ? toId : `${currentGroupId}:${toId}`
        action = [actionType, wireId, scopedFromId, scopedToId, ...rest]
      } else if (actionType === 'createGroup' && args.length >= 1) {
        const [groupId, ...rest] = args
        // Default parent to current group if not specified
        if (rest.length === 0 || rest[0] === undefined) {
          action = [actionType, groupId, undefined, {}, currentGroupId]
        }
      }
    }
    
    console.log('[NetworkBridge] Sending action:', action)
    workerRef.current.postMessage({
      type: 'action',
      action: action
    })
  }, [currentGroupId])
  
  // Navigation functions
  const enterGroup = useCallback((groupId: string) => {
    setNavigationPath(prev => [...prev, groupId])
  }, [])
  
  const exitGroup = useCallback(() => {
    setNavigationPath(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])
  
  const navigateToGroup = useCallback((path: string[]) => {
    setNavigationPath(path.length > 0 ? path : ['root'])
  }, [])
  
  // Get current group from navigation path
  const currentGroup = useMemo(() => {
    return navigationPath[navigationPath.length - 1] || 'root'
  }, [navigationPath])
  
  // Filter structure to show only current group's contents
  const filteredStructure = useMemo(() => {
    if (!structure) return null
    
    const filtered: NetworkStructure = {
      contacts: new Map(),
      groups: new Map(),
      wires: new Map()
    }
    
    // Filter contacts that belong to current group
    structure.contacts.forEach((contact, id) => {
      if (id.startsWith(`${currentGroupId}:`)) {
        filtered.contacts.set(id, contact)
      }
    })
    
    // Filter subgroups of current group
    structure.groups.forEach((group, id) => {
      if (group.parentId === currentGroupId) {
        filtered.groups.set(id, group)
      }
    })
    
    // Filter wires that connect contacts in current group
    structure.wires.forEach((wire, id) => {
      const fromGroup = wire.fromId.split(':')[0]
      const toGroup = wire.toId.split(':')[0]
      if (fromGroup === currentGroupId || toGroup === currentGroupId) {
        filtered.wires.set(id, wire)
      }
    })
    
    return filtered
  }, [structure, currentGroupId])
  
  // Create a project (subgroup of root)
  const createProject = useCallback((name: string) => {
    sendAction(['createGroup', name, undefined, { name }, 'root'])
  }, [sendAction])
  
  // Delete a project
  const deleteProject = useCallback((projectId: string) => {
    sendAction(['deleteGroup', projectId])
  }, [sendAction])
  
  // List all projects (root's subgroups)
  const projects = useMemo(() => {
    if (!structure) return []
    
    const projectList: Array<{ id: string; name: string }> = []
    structure.groups.forEach((group, id) => {
      if (group.parentId === 'root') {
        projectList.push({
          id,
          name: group.properties?.name || id
        })
      }
    })
    
    return projectList
  }, [structure])
  
  // Health check
  const ping = useCallback(() => {
    if (!workerRef.current) {
      console.warn('[NetworkBridge] Worker not initialized')
      return
    }
    
    workerRef.current.postMessage({ type: 'ping' })
  }, [])
  
  // Clear all data and reset
  const reset = useCallback(() => {
    localStorage.removeItem('bassline-network-state')
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'reset' })
    }
    setStructure(null)
    setDynamics([])
    setNavigationPath(['root'])
  }, [])
  
  return {
    // Core data
    structure: filteredStructure,
    fullStructure: structure,
    dynamics,
    isReady,
    
    // Actions
    sendAction,
    ping,
    reset,
    
    // Navigation
    currentGroup,
    currentGroupId,
    navigationPath,
    enterGroup,
    exitGroup,
    navigateToGroup,
    
    // Projects
    projects,
    createProject,
    deleteProject
  }
}
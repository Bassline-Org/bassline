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
    currentGroupId = 'project-default',  // Default to project, not root
    autoSave = true,
    autoSaveInterval = 5000
  } = options
  
  const [structure, setStructure] = useState<NetworkStructure | null>(null)
  const [contactValues, setContactValues] = useState<Map<string, any>>(new Map())
  const [activeProjectId, setActiveProjectId] = useState<string>('project-default')
  const [currentViewGroupId, setCurrentViewGroupId] = useState<string>('project-default')
  const [isReady, setIsReady] = useState(false)
  const [dynamics, setDynamics] = useState<any[]>([])
  const [navigationPath, setNavigationPath] = useState<string[]>(['project-default'])
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
          console.log('[NetworkBridge] Structure update:', value)
          // Convert arrays back to Maps with proper typing
          const reconstructed: NetworkStructure | null = value ? {
            contacts: new Map<string, any>(value.contacts || []),
            groups: new Map<string, any>(value.groups || []),
            wires: new Map<string, any>(value.wires || [])
          } : null
          console.log('[NetworkBridge] Reconstructed structure:', reconstructed)
          setStructure(reconstructed)
          
          // Auto-save to localStorage
          if (autoSave && value) {
            localStorage.setItem('bassline-network-state', JSON.stringify(value))
          }
          break
          
        case 'dynamics':
          console.log('[NetworkBridge] Dynamics event:', event)
          setDynamics(prev => [...prev, event])
          
          // Extract values from valueChanged events
          if (Array.isArray(event) && event[0] === 'valueChanged') {
            const [, contactId, oldValue, newValue] = event
            setContactValues(prev => {
              const updated = new Map(prev)
              updated.set(contactId, newValue)
              return updated
            })
          }
          break
          
        case 'activeProjectChanged':
          console.log('[NetworkBridge] Active project changed:', e.data.projectId)
          setActiveProjectId(e.data.projectId)
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
  
  // Send action to network - actions are handled by worker which routes to active project
  const sendAction = useCallback((action: any) => {
    if (!workerRef.current) {
      console.warn('[NetworkBridge] Worker not initialized')
      return
    }
    
    // Worker will handle routing to the active project
    console.log('[NetworkBridge] Sending action:', action)
    workerRef.current.postMessage({
      type: 'action',
      action: action
    })
  }, [])
  
  // Navigation functions
  const enterGroup = useCallback((groupId: string) => {
    setCurrentViewGroupId(groupId)
    setNavigationPath(prev => [...prev, groupId])
  }, [])
  
  const exitGroup = useCallback(() => {
    setNavigationPath(prev => {
      const newPath = prev.length > 1 ? prev.slice(0, -1) : prev
      setCurrentViewGroupId(newPath[newPath.length - 1])
      return newPath
    })
  }, [])
  
  const navigateToGroup = useCallback((path: string[]) => {
    const newPath = path.length > 0 ? path : [activeProjectId]
    setNavigationPath(newPath)
    setCurrentViewGroupId(newPath[newPath.length - 1])
  }, [activeProjectId])
  
  // Get current group from navigation path
  const currentGroup = useMemo(() => {
    return navigationPath[navigationPath.length - 1] || activeProjectId
  }, [navigationPath, activeProjectId])
  
  // Filter structure to show only active project's contents
  const filteredStructure = useMemo(() => {
    if (!structure) return null
    
    const filtered: NetworkStructure = {
      contacts: new Map(),
      groups: new Map(),
      wires: new Map()
    }
    
    // Filter contacts that belong to active project
    structure.contacts.forEach((contact, id) => {
      if (id.startsWith(`${activeProjectId}:`)) {
        // Merge structure with values from dynamics
        const enrichedContact = {
          ...contact,
          content: contactValues.get(id)
        }
        filtered.contacts.set(id, enrichedContact)
      }
    })
    
    // Filter subgroups of active project
    structure.groups.forEach((group, id) => {
      if (group.parentId === activeProjectId) {
        filtered.groups.set(id, group)
      }
    })
    
    // Filter wires that connect contacts in active project
    structure.wires.forEach((wire, id) => {
      const fromGroup = wire.fromId.split(':')[0]
      const toGroup = wire.toId.split(':')[0]
      if (fromGroup === activeProjectId || toGroup === activeProjectId) {
        filtered.wires.set(id, wire)
      }
    })
    
    return filtered
  }, [structure, activeProjectId, contactValues])
  
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
  
  // Switch active project
  const switchProject = useCallback((projectId: string) => {
    if (!workerRef.current) return
    workerRef.current.postMessage({
      type: 'setActiveProject',
      projectId
    })
    setActiveProjectId(projectId)
    setNavigationPath([projectId])
  }, [])
  
  return {
    // Core data
    structure: filteredStructure,
    fullStructure: structure,
    contactValues,
    dynamics,
    isReady,
    
    // Actions
    sendAction,
    ping,
    reset,
    
    // Navigation
    currentGroup,
    currentGroupId: activeProjectId,
    activeProjectId,
    navigationPath,
    enterGroup,
    exitGroup,
    navigateToGroup,
    
    // Projects
    projects,
    createProject,
    deleteProject,
    switchProject
  }
}
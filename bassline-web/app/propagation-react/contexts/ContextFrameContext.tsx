import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ContextFrame, SelectionState, ViewState, Tool, ToolActivation } from '~/propagation-react/types/context-frame'
import { useNetworkContext } from './NetworkContext'

interface ContextFrameContextValue {
  // Context stack management
  contextStack: ContextFrame[]
  currentContext: ContextFrame | null
  pushContext: (groupId: string) => void
  popContext: () => void
  
  // Selection management
  selection: SelectionState
  setSelection: (contactIds: string[], groupIds: string[]) => void
  addToSelection: (contactIds: string[], groupIds: string[]) => void
  removeFromSelection: (contactIds: string[], groupIds: string[]) => void
  clearSelection: () => void
  
  // Tool management
  activeTool: ToolActivation | null
  activeToolInstance: Tool | null
  activateTool: (tool: Tool) => void
  deactivateTool: () => void
  
  // View state
  updateViewState: (viewState: Partial<ViewState>) => void
}

const ContextFrameContext = createContext<ContextFrameContextValue | undefined>(undefined)

interface ContextFrameProviderProps {
  children: ReactNode
}

export function ContextFrameProvider({ children }: ContextFrameProviderProps) {
  const { network } = useNetworkContext()
  
  // Initialize with root context
  const createContext = useCallback((groupId: string, parentId?: string): ContextFrame => {
    return {
      id: `context-${Date.now()}`,
      groupId,
      selection: {
        contactIds: new Set(),
        groupIds: new Set(),
        lastModified: Date.now()
      },
      viewState: {
        zoom: 1,
        center: { x: 0, y: 0 }
      },
      parentContextId: parentId,
      timestamp: Date.now()
    }
  }, [])
  
  const [contextStack, setContextStack] = useState<ContextFrame[]>(() => [
    createContext(network.rootGroup.id)
  ])
  
  const [activeTool, setActiveTool] = useState<ToolActivation | null>(null)
  
  const currentContext = contextStack[contextStack.length - 1] || null
  
  // Push a new context when navigating into a group
  const pushContext = useCallback((groupId: string) => {
    const newContext = createContext(groupId, currentContext?.id)
    setContextStack(prev => [...prev, newContext])
  }, [currentContext, createContext])
  
  // Pop context when navigating back
  const popContext = useCallback(() => {
    if (contextStack.length > 1) {
      setContextStack(prev => prev.slice(0, -1))
      
      // Deactivate tool if active
      if (activeTool) {
        deactivateTool()
      }
    }
  }, [contextStack.length, activeTool])
  
  // Selection management
  const setSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    if (!currentContext) return
    
    setContextStack(prev => {
      const newStack = [...prev]
      const ctx = newStack[newStack.length - 1]
      
      // Check if selection actually changed
      const contactsChanged = contactIds.length !== ctx.selection.contactIds.size ||
        !contactIds.every(id => ctx.selection.contactIds.has(id))
      const groupsChanged = groupIds.length !== ctx.selection.groupIds.size ||
        !groupIds.every(id => ctx.selection.groupIds.has(id))
      
      if (contactsChanged || groupsChanged) {
        ctx.selection = {
          contactIds: new Set(contactIds),
          groupIds: new Set(groupIds),
          lastModified: Date.now()
        }
      }
      
      return newStack
    })
  }, [currentContext])
  
  const addToSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    if (!currentContext) return
    
    setContextStack(prev => {
      const newStack = [...prev]
      const ctx = newStack[newStack.length - 1]
      const newContactIds = new Set(ctx.selection.contactIds)
      const newGroupIds = new Set(ctx.selection.groupIds)
      
      contactIds.forEach(id => newContactIds.add(id))
      groupIds.forEach(id => newGroupIds.add(id))
      
      ctx.selection = {
        contactIds: newContactIds,
        groupIds: newGroupIds,
        lastModified: Date.now()
      }
      return newStack
    })
  }, [currentContext])
  
  const removeFromSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    if (!currentContext) return
    
    setContextStack(prev => {
      const newStack = [...prev]
      const ctx = newStack[newStack.length - 1]
      const newContactIds = new Set(ctx.selection.contactIds)
      const newGroupIds = new Set(ctx.selection.groupIds)
      
      contactIds.forEach(id => newContactIds.delete(id))
      groupIds.forEach(id => newGroupIds.delete(id))
      
      ctx.selection = {
        contactIds: newContactIds,
        groupIds: newGroupIds,
        lastModified: Date.now()
      }
      return newStack
    })
  }, [currentContext])
  
  const clearSelection = useCallback(() => {
    setSelection([], [])
  }, [setSelection])
  
  // Keep track of active tool instance
  const [activeToolInstance, setActiveToolInstance] = useState<Tool | null>(null)
  
  // Tool management
  const activateTool = useCallback((tool: Tool) => {
    if (!currentContext) return
    
    // Deactivate current tool if any
    if (activeToolInstance) {
      activeToolInstance.onDeactivate()
      setActiveToolInstance(null)
    }
    
    // Activate new tool
    tool.onActivate(currentContext)
    setActiveToolInstance(tool)
    setActiveTool({
      toolId: tool.id,
      activatedAt: Date.now(),
      context: currentContext
    })
  }, [currentContext, activeToolInstance])
  
  const deactivateTool = useCallback(() => {
    if (activeToolInstance) {
      activeToolInstance.onDeactivate()
      setActiveToolInstance(null)
      setActiveTool(null)
    }
  }, [activeToolInstance])
  
  // View state updates
  const updateViewState = useCallback((viewState: Partial<ViewState>) => {
    if (!currentContext) return
    
    setContextStack(prev => {
      const newStack = [...prev]
      const ctx = newStack[newStack.length - 1]
      ctx.viewState = {
        ...ctx.viewState,
        ...viewState
      }
      return newStack
    })
  }, [currentContext])
  
  // Sync with network navigation
  useEffect(() => {
    const currentGroupId = network.currentGroup.id
    const contextGroupId = currentContext?.groupId
    
    if (currentGroupId !== contextGroupId) {
      // Network navigation happened outside our control
      // Update our context stack to match
      if (currentGroupId === network.rootGroup.id) {
        // Navigated to root
        setContextStack([createContext(network.rootGroup.id)])
      } else if (contextStack.some(ctx => ctx.groupId === currentGroupId)) {
        // Navigated to a group in our stack
        const index = contextStack.findIndex(ctx => ctx.groupId === currentGroupId)
        setContextStack(contextStack.slice(0, index + 1))
      } else {
        // Navigated to a new group
        pushContext(currentGroupId)
      }
    }
  }, [network.currentGroup.id, currentContext, contextStack, createContext, pushContext])
  
  const value: ContextFrameContextValue = useMemo(() => ({
    contextStack,
    currentContext,
    pushContext,
    popContext,
    selection: currentContext?.selection || { contactIds: new Set(), groupIds: new Set(), lastModified: 0 },
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection,
    activeTool,
    activeToolInstance,
    activateTool,
    deactivateTool,
    updateViewState
  }), [
    contextStack,
    currentContext,
    pushContext,
    popContext,
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection,
    activeTool,
    activeToolInstance,
    activateTool,
    deactivateTool,
    updateViewState
  ])
  
  return (
    <ContextFrameContext.Provider value={value}>
      {children}
    </ContextFrameContext.Provider>
  )
}

export function useContextFrame() {
  const context = useContext(ContextFrameContext)
  if (!context) {
    throw new Error('useContextFrame must be used within ContextFrameProvider')
  }
  return context
}
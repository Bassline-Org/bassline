import React, { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

// Stack layer types
export type UIStackLayerType = 
  | 'base'           // Normal editing mode
  | 'selection'      // Items selected, shows actions
  | 'propertyFocus'  // Editing properties with focus
  | 'valenceMode'    // Connecting compatible items
  | 'gadgetMenu'     // Browsing/selecting gadgets
  | 'configuration'  // Settings panel
  | 'quickAdd'       // Edge drop menu
  | 'search'         // Global search (future)

// Stack item interface
export interface UIStackItem {
  id: string
  type: UIStackLayerType
  data?: any
  onEscape?: () => boolean | void  // Return true to prevent default pop
  onEnter?: () => void
  onExit?: () => void
}

// Context value interface
interface UIStackContextValue {
  stack: UIStackItem[]
  push: (item: Omit<UIStackItem, 'id'>) => string
  pop: () => UIStackItem | undefined
  popTo: (id: string) => void
  popToType: (type: UIStackLayerType) => void
  peek: () => UIStackItem | undefined
  clear: () => void
  depth: number
  currentLayer: UIStackItem | undefined
  isInMode: (type: UIStackLayerType) => boolean
}

// Create context
const UIStackContext = createContext<UIStackContextValue | undefined>(undefined)

// Provider props
interface UIStackProviderProps {
  children: ReactNode
}

// Provider component
export function UIStackProvider({ children }: UIStackProviderProps) {
  // Base layer is always at the bottom of the stack
  const baseLayer: UIStackItem = {
    id: 'base',
    type: 'base',
  }
  
  const [stack, setStack] = useState<UIStackItem[]>([baseLayer])
  
  // Push a new layer onto the stack
  const push = useCallback((item: Omit<UIStackItem, 'id'>) => {
    const id = `${item.type}-${Date.now()}`
    const newItem: UIStackItem = { ...item, id }
    
    setStack(prev => {
      // Call onExit for current top
      const currentTop = prev[prev.length - 1]
      if (currentTop?.onExit) {
        currentTop.onExit()
      }
      
      // Call onEnter for new item
      if (newItem.onEnter) {
        newItem.onEnter()
      }
      
      return [...prev, newItem]
    })
    
    return id
  }, [])
  
  // Pop the top layer
  const pop = useCallback(() => {
    let poppedItem: UIStackItem | undefined
    
    setStack(prev => {
      if (prev.length <= 1) return prev // Can't pop base layer
      
      const newStack = [...prev]
      poppedItem = newStack.pop()
      
      // Call onExit for popped item
      if (poppedItem?.onExit) {
        poppedItem.onExit()
      }
      
      // Call onEnter for new top
      const newTop = newStack[newStack.length - 1]
      if (newTop?.onEnter) {
        newTop.onEnter()
      }
      
      return newStack
    })
    
    return poppedItem
  }, [])
  
  // Pop to a specific layer by ID
  const popTo = useCallback((id: string) => {
    setStack(prev => {
      const index = prev.findIndex(item => item.id === id)
      if (index === -1 || index === prev.length - 1) return prev
      
      // Call onExit for all popped layers
      const poppedLayers = prev.slice(index + 1)
      poppedLayers.forEach(layer => {
        if (layer.onExit) layer.onExit()
      })
      
      const newStack = prev.slice(0, index + 1)
      
      // Call onEnter for new top
      const newTop = newStack[newStack.length - 1]
      if (newTop?.onEnter) {
        newTop.onEnter()
      }
      
      return newStack
    })
  }, [])
  
  // Pop to a specific layer type
  const popToType = useCallback((type: UIStackLayerType) => {
    setStack(prev => {
      const index = prev.findIndex(item => item.type === type)
      if (index === -1 || index === prev.length - 1) return prev
      
      // Call onExit for all popped layers
      const poppedLayers = prev.slice(index + 1)
      poppedLayers.forEach(layer => {
        if (layer.onExit) layer.onExit()
      })
      
      const newStack = prev.slice(0, index + 1)
      
      // Call onEnter for new top
      const newTop = newStack[newStack.length - 1]
      if (newTop?.onEnter) {
        newTop.onEnter()
      }
      
      return newStack
    })
  }, [])
  
  // Peek at the top layer
  const peek = useCallback(() => {
    return stack[stack.length - 1]
  }, [stack])
  
  // Clear the stack (except base)
  const clear = useCallback(() => {
    setStack(prev => {
      // Call onExit for all layers except base
      prev.slice(1).forEach(layer => {
        if (layer.onExit) layer.onExit()
      })
      
      return [baseLayer]
    })
  }, [])
  
  // Check if a specific layer type is in the stack
  const isInMode = useCallback((type: UIStackLayerType) => {
    return stack.some(item => item.type === type)
  }, [stack])
  
  const value: UIStackContextValue = {
    stack,
    push,
    pop,
    popTo,
    popToType,
    peek,
    clear,
    depth: stack.length - 1, // Don't count base layer
    currentLayer: stack[stack.length - 1],
    isInMode,
  }
  
  return (
    <UIStackContext.Provider value={value}>
      {children}
    </UIStackContext.Provider>
  )
}

// Hook to use the UI stack
export function useUIStack() {
  const context = useContext(UIStackContext)
  if (!context) {
    throw new Error('useUIStack must be used within UIStackProvider')
  }
  return context
}
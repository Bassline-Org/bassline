import React, { createContext, useContext, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { useContextFrameStack } from './ContextFrameStackContext'
import type { UIStackItem, UIStackLayerType } from './UIStackContext'

// Adapter to provide UIStack-compatible interface using the new frame stack
interface UIStackAdapterValue {
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

const UIStackAdapterContext = createContext<UIStackAdapterValue | undefined>(undefined)

// Map frame types to UI stack types
const frameTypeToUIType: Record<string, UIStackLayerType> = {
  navigation: 'base',
  property: 'propertyFocus',
  valence: 'valenceMode',
  gadgetMenu: 'gadgetMenu',
  tool: 'base', // Tools don't have a direct UI stack equivalent
}

// Map UI stack types to frame operations
const uiTypeToFrameOp = {
  propertyFocus: 'pushPropertyMode',
  valenceMode: 'pushValenceMode',
  gadgetMenu: 'pushGadgetMenu',
} as const

export function UIStackAdapter({ children }: { children: ReactNode }) {
  const frameStack = useContextFrameStack()
  
  // Convert frame stack to UI stack format
  const stack = useMemo<UIStackItem[]>(() => {
    return frameStack.stack.map(frame => ({
      id: frame.id,
      type: frameTypeToUIType[frame.type] || 'base',
      data: frame.metadata,
      onEscape: frame.onEscape,
      onEnter: frame.onEnter,
      onExit: frame.onExit,
    }))
  }, [frameStack.stack])
  
  // Push adapter
  const push = useCallback((item: Omit<UIStackItem, 'id'>) => {
    const frameId = `ui-adapter-${Date.now()}`
    
    // Map UI stack push to appropriate frame stack operation
    switch (item.type) {
      case 'propertyFocus':
        frameStack.pushPropertyMode(item.data?.nodeId, item.data?.focusInput)
        break
      case 'valenceMode':
        // For valence mode, we need to calculate the source selection
        // This is a simplified version - real implementation would need the actual selection
        frameStack.pushValenceMode({
          contactIds: [],
          groupIds: [],
          totalOutputCount: 0
        })
        break
      case 'gadgetMenu':
        frameStack.pushGadgetMenu(item.data?.selectedCategory)
        break
      default:
        // For other types, we can't directly map them
        console.warn(`UIStackAdapter: Unmapped UI stack type "${item.type}"`)
    }
    
    return frameId
  }, [frameStack])
  
  // Pop adapter
  const pop = useCallback(() => {
    const popped = frameStack.pop()
    if (!popped) return undefined
    
    return {
      id: popped.id,
      type: frameTypeToUIType[popped.type] || 'base',
      data: popped.metadata,
      onEscape: popped.onEscape,
      onEnter: popped.onEnter,
      onExit: popped.onExit,
    }
  }, [frameStack])
  
  // Other operations are direct pass-through
  const popTo = frameStack.popTo
  const popToType = useCallback((type: UIStackLayerType) => {
    // Map UI type to frame type
    const frameTypes: Record<UIStackLayerType, string> = {
      base: 'navigation',
      selection: 'navigation', // No direct equivalent
      propertyFocus: 'property',
      valenceMode: 'valence',
      gadgetMenu: 'gadgetMenu',
      configuration: 'gadgetMenu', // Map to closest equivalent
      quickAdd: 'property', // Map to closest equivalent
      search: 'search',
    }
    
    const frameType = frameTypes[type]
    if (frameType) {
      frameStack.popToType(frameType)
    }
  }, [frameStack])
  
  const peek = useCallback(() => {
    const current = frameStack.currentFrame
    if (!current) return undefined
    
    return {
      id: current.id,
      type: frameTypeToUIType[current.type] || 'base',
      data: current.metadata,
      onEscape: current.onEscape,
      onEnter: current.onEnter,
      onExit: current.onExit,
    }
  }, [frameStack.currentFrame])
  
  const clear = frameStack.clear
  
  const isInMode = useCallback((type: UIStackLayerType) => {
    const frameTypes: Record<UIStackLayerType, string> = {
      base: 'navigation',
      selection: 'navigation',
      propertyFocus: 'property',
      valenceMode: 'valence',
      gadgetMenu: 'gadgetMenu',
      configuration: 'gadgetMenu',
      quickAdd: 'property',
      search: 'search',
    }
    
    const frameType = frameTypes[type]
    return frameType ? frameStack.isInMode(frameType) : false
  }, [frameStack])
  
  const value: UIStackAdapterValue = {
    stack,
    push,
    pop,
    popTo,
    popToType,
    peek,
    clear,
    depth: Math.max(0, frameStack.stack.length - 1), // Don't count root navigation
    currentLayer: peek(),
    isInMode,
  }
  
  return (
    <UIStackAdapterContext.Provider value={value}>
      {children}
    </UIStackAdapterContext.Provider>
  )
}

// Hook that provides UIStack interface using frame stack
export function useUIStackAdapter() {
  const context = useContext(UIStackAdapterContext)
  if (!context) {
    // If adapter not available, try to use frame stack directly
    // This allows gradual migration
    const frameStack = useContextFrameStack()
    
    // Return a minimal adapter implementation
    return {
      stack: [],
      push: () => '',
      pop: () => undefined,
      popTo: () => {},
      popToType: () => {},
      peek: () => undefined,
      clear: () => {},
      depth: 0,
      currentLayer: undefined,
      isInMode: () => false,
    }
  }
  return context
}

// Re-export with original name for drop-in replacement
export { useUIStackAdapter as useUIStack }
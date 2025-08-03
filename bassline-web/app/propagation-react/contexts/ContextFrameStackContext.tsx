import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import type { 
  ContextFrame, 
  NavigationFrame, 
  PropertyFrame, 
  ValenceFrame,
  GadgetMenuFrame,
  ToolFrame,
  SelectionState, 
  ViewState,
  StackState,
  Tool 
} from '~/propagation-react/types/context-frame-v2'
import { useNetworkContext } from './NetworkContext'

interface ContextFrameStackContextValue {
  // Stack state
  stack: ContextFrame[]
  currentFrame: ContextFrame | null
  
  // Navigation operations
  pushNavigation: (groupId: string) => void
  popNavigation: () => boolean
  
  // UI mode operations
  pushPropertyMode: (focusedNodeId?: string, focusInput?: boolean) => void
  pushValenceMode: (sourceSelection: { contactIds: string[], groupIds: string[], totalOutputCount: number }) => void
  pushGadgetMenu: (selectedCategory?: string) => void
  pushToolFrame: (tool: Tool) => void
  
  // Generic stack operations
  pop: () => ContextFrame | undefined
  popTo: (frameId: string) => void
  popToType: (frameType: string) => void
  clear: () => void
  
  // Frame state updates
  updateSelection: (selection: Partial<SelectionState>) => void
  updateViewState: (viewState: Partial<ViewState>) => void
  
  // Stack introspection
  getStackState: () => StackState
  isInMode: (frameType: string) => boolean
  findFrame: (predicate: (frame: ContextFrame) => boolean) => ContextFrame | undefined
  
  // Tool management
  activeTool: Tool | null
}

const ContextFrameStackContext = createContext<ContextFrameStackContextValue | undefined>(undefined)

interface ContextFrameStackProviderProps {
  children: ReactNode
}

export function ContextFrameStackProvider({ children }: ContextFrameStackProviderProps) {
  const { network, currentGroupId, setCurrentGroupId } = useNetworkContext()
  const [stack, setStack] = useState<ContextFrame[]>([])
  const [activeTool, setActiveTool] = useState<Tool | null>(null)
  const frameIdCounter = useRef(0)
  
  // Generate unique frame ID
  const generateFrameId = useCallback(() => {
    return `frame-${++frameIdCounter.current}-${Date.now()}`
  }, [])
  
  // Initialize with root navigation frame
  useEffect(() => {
    if (stack.length === 0 && network) {
      const rootFrame: NavigationFrame = {
        id: generateFrameId(),
        type: 'navigation',
        groupId: network.rootGroup.id,
        previousGroupId: network.rootGroup.id,
        selection: {
          contactIds: new Set(),
          groupIds: new Set(),
          lastModified: Date.now()
        },
        viewState: {
          zoom: 1,
          center: { x: 0, y: 0 }
        },
        timestamp: Date.now()
      }
      setStack([rootFrame])
    }
  }, [network, stack.length, generateFrameId])
  
  const currentFrame = stack[stack.length - 1] || null
  
  // Sync network navigation with current frame
  useEffect(() => {
    if (currentFrame && currentFrame.groupId !== currentGroupId) {
      setCurrentGroupId(currentFrame.groupId)
    }
  }, [currentFrame, currentGroupId, setCurrentGroupId])
  
  // Push navigation frame
  const pushNavigation = useCallback((groupId: string) => {
    const newFrame: NavigationFrame = {
      id: generateFrameId(),
      type: 'navigation',
      groupId,
      previousGroupId: currentFrame?.groupId || network.rootGroup.id,
      selection: {
        contactIds: new Set(),
        groupIds: new Set(),
        lastModified: Date.now()
      },
      viewState: {
        zoom: 1,
        center: { x: 0, y: 0 }
      },
      parentFrameId: currentFrame?.id,
      timestamp: Date.now()
    }
    
    setStack(prev => {
      const current = prev[prev.length - 1]
      if (current?.onExit) current.onExit()
      if (newFrame.onEnter) newFrame.onEnter()
      return [...prev, newFrame]
    })
  }, [currentFrame, network, generateFrameId])
  
  // Pop navigation (special handling to ensure we don't pop the last navigation frame)
  const popNavigation = useCallback(() => {
    // Count navigation frames in stack
    const navigationFrames = stack.filter(f => f.type === 'navigation')
    if (navigationFrames.length <= 1) {
      return false // Can't pop the last navigation frame
    }
    
    // Find the last navigation frame index
    let lastNavIndex = -1
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].type === 'navigation') {
        lastNavIndex = i
        break
      }
    }
    
    if (lastNavIndex > 0) {
      // Pop everything above and including this navigation frame
      setStack(prev => {
        const newStack = prev.slice(0, lastNavIndex)
        // Call exit handlers
        prev.slice(lastNavIndex).forEach(frame => {
          if (frame.onExit) frame.onExit()
        })
        // Call enter handler for new top
        const newTop = newStack[newStack.length - 1]
        if (newTop?.onEnter) newTop.onEnter()
        return newStack
      })
      return true
    }
    
    return false
  }, [stack])
  
  // Push property mode
  const pushPropertyMode = useCallback((focusedNodeId?: string, focusInput = false) => {
    const newFrame: PropertyFrame = {
      id: generateFrameId(),
      type: 'property',
      groupId: currentFrame?.groupId || network.rootGroup.id,
      focusedNodeId,
      focusInput,
      selection: currentFrame?.selection || {
        contactIds: new Set(),
        groupIds: new Set(),
        lastModified: Date.now()
      },
      viewState: currentFrame?.viewState || {
        zoom: 1,
        center: { x: 0, y: 0 }
      },
      parentFrameId: currentFrame?.id,
      timestamp: Date.now()
    }
    
    setStack(prev => {
      const current = prev[prev.length - 1]
      if (current?.onExit) current.onExit()
      if (newFrame.onEnter) newFrame.onEnter()
      return [...prev, newFrame]
    })
  }, [currentFrame, network, generateFrameId])
  
  // Push valence mode
  const pushValenceMode = useCallback((sourceSelection: { contactIds: string[], groupIds: string[], totalOutputCount: number }) => {
    const newFrame: ValenceFrame = {
      id: generateFrameId(),
      type: 'valence',
      groupId: currentFrame?.groupId || network.rootGroup.id,
      sourceSelection,
      selection: currentFrame?.selection || {
        contactIds: new Set(),
        groupIds: new Set(),
        lastModified: Date.now()
      },
      viewState: currentFrame?.viewState || {
        zoom: 1,
        center: { x: 0, y: 0 }
      },
      parentFrameId: currentFrame?.id,
      timestamp: Date.now()
    }
    
    setStack(prev => {
      const current = prev[prev.length - 1]
      if (current?.onExit) current.onExit()
      if (newFrame.onEnter) newFrame.onEnter()
      return [...prev, newFrame]
    })
  }, [currentFrame, network, generateFrameId])
  
  // Push gadget menu
  const pushGadgetMenu = useCallback((selectedCategory?: string) => {
    const newFrame: GadgetMenuFrame = {
      id: generateFrameId(),
      type: 'gadgetMenu',
      groupId: currentFrame?.groupId || network.rootGroup.id,
      selectedCategory,
      selection: currentFrame?.selection || {
        contactIds: new Set(),
        groupIds: new Set(),
        lastModified: Date.now()
      },
      viewState: currentFrame?.viewState || {
        zoom: 1,
        center: { x: 0, y: 0 }
      },
      parentFrameId: currentFrame?.id,
      timestamp: Date.now()
    }
    
    setStack(prev => {
      const current = prev[prev.length - 1]
      if (current?.onExit) current.onExit()
      if (newFrame.onEnter) newFrame.onEnter()
      return [...prev, newFrame]
    })
  }, [currentFrame, network, generateFrameId])
  
  // Push tool frame
  const pushToolFrame = useCallback((tool: Tool) => {
    const baseFrame = {
      groupId: currentFrame?.groupId || network.rootGroup.id,
      selection: currentFrame?.selection || {
        contactIds: new Set(),
        groupIds: new Set(),
        lastModified: Date.now()
      },
      viewState: currentFrame?.viewState || {
        zoom: 1,
        center: { x: 0, y: 0 }
      },
      parentFrameId: currentFrame?.id,
    }
    
    // Let tool create its own frame if it wants
    const newFrame: ToolFrame = tool.createFrame 
      ? tool.createFrame(currentFrame!)
      : {
          ...baseFrame,
          id: generateFrameId(),
          type: 'tool',
          toolId: tool.id,
          timestamp: Date.now()
        }
    
    // Activate tool
    if (tool.onActivate) {
      tool.onActivate(newFrame)
    }
    setActiveTool(tool)
    
    setStack(prev => {
      const current = prev[prev.length - 1]
      if (current?.onExit) current.onExit()
      if (newFrame.onEnter) newFrame.onEnter()
      return [...prev, newFrame]
    })
  }, [currentFrame, network, generateFrameId])
  
  // Generic pop
  const pop = useCallback(() => {
    let poppedFrame: ContextFrame | undefined
    
    setStack(prev => {
      if (prev.length <= 1) return prev // Keep at least one frame
      
      const newStack = [...prev]
      poppedFrame = newStack.pop()
      
      // Handle tool deactivation
      if (poppedFrame?.type === 'tool' && activeTool) {
        if (activeTool.onDeactivate) {
          activeTool.onDeactivate()
        }
        setActiveTool(null)
      }
      
      // Call exit handler
      if (poppedFrame?.onExit) {
        poppedFrame.onExit()
      }
      
      // Call enter handler for new top
      const newTop = newStack[newStack.length - 1]
      if (newTop?.onEnter) {
        newTop.onEnter()
      }
      
      return newStack
    })
    
    return poppedFrame
  }, [activeTool])
  
  // Pop to specific frame
  const popTo = useCallback((frameId: string) => {
    setStack(prev => {
      const index = prev.findIndex(f => f.id === frameId)
      if (index === -1 || index === prev.length - 1) return prev
      
      // Handle tool deactivation
      const poppedFrames = prev.slice(index + 1)
      poppedFrames.forEach(frame => {
        if (frame.type === 'tool' && activeTool) {
          if (activeTool.onDeactivate) {
            activeTool.onDeactivate()
          }
          setActiveTool(null)
        }
        if (frame.onExit) frame.onExit()
      })
      
      const newStack = prev.slice(0, index + 1)
      const newTop = newStack[newStack.length - 1]
      if (newTop?.onEnter) {
        newTop.onEnter()
      }
      
      return newStack
    })
  }, [activeTool])
  
  // Pop to frame type
  const popToType = useCallback((frameType: string) => {
    const frame = stack.find(f => f.type === frameType)
    if (frame) {
      popTo(frame.id)
    }
  }, [stack, popTo])
  
  // Clear stack (keep root navigation)
  const clear = useCallback(() => {
    setStack(prev => {
      // Call exit handlers
      prev.slice(1).forEach(frame => {
        if (frame.type === 'tool' && activeTool) {
          if (activeTool.onDeactivate) {
            activeTool.onDeactivate()
          }
          setActiveTool(null)
        }
        if (frame.onExit) frame.onExit()
      })
      
      return prev.slice(0, 1) // Keep root frame
    })
  }, [activeTool])
  
  // Update selection in current frame
  const updateSelection = useCallback((selection: Partial<SelectionState>) => {
    if (!currentFrame) return
    
    setStack(prev => {
      const newStack = [...prev]
      const frame = newStack[newStack.length - 1]
      frame.selection = {
        ...frame.selection,
        ...selection,
        lastModified: Date.now()
      }
      return newStack
    })
  }, [currentFrame])
  
  // Update view state in current frame
  const updateViewState = useCallback((viewState: Partial<ViewState>) => {
    if (!currentFrame) return
    
    setStack(prev => {
      const newStack = [...prev]
      const frame = newStack[newStack.length - 1]
      frame.viewState = {
        ...frame.viewState,
        ...viewState
      }
      return newStack
    })
  }, [currentFrame])
  
  // Get stack state
  const getStackState = useCallback((): StackState => {
    const navigationFrameCount = stack.filter(f => f.type === 'navigation').length
    return {
      frames: stack,
      currentFrame,
      depth: stack.length,
      canPop: stack.length > 1,
      canPush: true
    }
  }, [stack, currentFrame])
  
  // Check if in mode
  const isInMode = useCallback((frameType: string) => {
    return stack.some(f => f.type === frameType)
  }, [stack])
  
  // Find frame
  const findFrame = useCallback((predicate: (frame: ContextFrame) => boolean) => {
    return stack.find(predicate)
  }, [stack])
  
  const value: ContextFrameStackContextValue = useMemo(() => ({
    stack,
    currentFrame,
    pushNavigation,
    popNavigation,
    pushPropertyMode,
    pushValenceMode,
    pushGadgetMenu,
    pushToolFrame,
    pop,
    popTo,
    popToType,
    clear,
    updateSelection,
    updateViewState,
    getStackState,
    isInMode,
    findFrame,
    activeTool
  }), [
    stack,
    currentFrame,
    pushNavigation,
    popNavigation,
    pushPropertyMode,
    pushValenceMode,
    pushGadgetMenu,
    pushToolFrame,
    pop,
    popTo,
    popToType,
    clear,
    updateSelection,
    updateViewState,
    getStackState,
    isInMode,
    findFrame,
    activeTool
  ])
  
  return (
    <ContextFrameStackContext.Provider value={value}>
      {children}
    </ContextFrameStackContext.Provider>
  )
}

export function useContextFrameStack() {
  const context = useContext(ContextFrameStackContext)
  if (!context) {
    throw new Error('useContextFrameStack must be used within ContextFrameStackProvider')
  }
  return context
}
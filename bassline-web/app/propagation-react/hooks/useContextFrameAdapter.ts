import { useCallback, useMemo } from 'react'
import { useContextFrameStack } from '~/propagation-react/contexts/ContextFrameStackContext'
import { useFrameSelection } from './useFrameSelection'
import type { Tool } from '~/propagation-react/types/context-frame-v2'

// Adapter hook that provides the old useContextFrame interface
export function useContextFrameAdapter() {
  const frameStack = useContextFrameStack()
  const selection = useFrameSelection()
  
  // Map old context stack to navigation frames only
  const contextStack = useMemo(() => {
    return frameStack.stack.filter(f => f.type === 'navigation')
  }, [frameStack.stack])
  
  // Current context is the current navigation frame
  const currentContext = useMemo(() => {
    // Find the most recent navigation frame
    for (let i = frameStack.stack.length - 1; i >= 0; i--) {
      if (frameStack.stack[i].type === 'navigation') {
        return frameStack.stack[i]
      }
    }
    return null
  }, [frameStack.stack])
  
  // Push context (navigation)
  const pushContext = useCallback((groupId: string) => {
    frameStack.pushNavigation(groupId)
  }, [frameStack])
  
  // Pop context (navigation)
  const popContext = useCallback(() => {
    return frameStack.popNavigation()
  }, [frameStack])
  
  // Selection operations delegate to frame selection
  const setSelection = useCallback((contactIds: string[], groupIds: string[]) => {
    selection.setSelection(contactIds, groupIds)
  }, [selection])
  
  const addToSelection = selection.addToSelection
  const removeFromSelection = selection.removeFromSelection
  const clearSelection = selection.clearSelection
  
  // Tool management
  const activateTool = useCallback((tool: Tool) => {
    frameStack.pushToolFrame(tool)
  }, [frameStack])
  
  const deactivateTool = useCallback(() => {
    // Pop until we remove the tool frame
    const toolFrame = frameStack.findFrame(f => f.type === 'tool')
    if (toolFrame) {
      frameStack.popTo(toolFrame.id)
      frameStack.pop() // Remove the tool frame itself
    }
  }, [frameStack])
  
  // View state updates
  const updateViewState = frameStack.updateViewState
  
  // Build return value matching old interface
  return {
    // Context stack management
    contextStack,
    currentContext,
    pushContext,
    popContext,
    
    // Selection management
    selection: currentContext?.selection || { 
      contactIds: new Set(), 
      groupIds: new Set(), 
      lastModified: 0 
    },
    setSelection,
    addToSelection,
    removeFromSelection,
    clearSelection,
    
    // Tool management
    activeTool: frameStack.activeTool ? {
      toolId: frameStack.activeTool.id,
      activatedAt: Date.now(),
      context: currentContext!
    } : null,
    activeToolInstance: frameStack.activeTool,
    activateTool,
    deactivateTool,
    
    // View state
    updateViewState
  }
}

// Re-export with original name for drop-in replacement
export { useContextFrameAdapter as useContextFrame }
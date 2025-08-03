/**
 * Example showing how to migrate editor.tsx to use the new context frame stack system
 * This file demonstrates the changes needed - don't import it directly
 */

import React, { useCallback } from 'react'
import { useContextFrameStack } from '~/propagation-react/contexts/ContextFrameStackContext'
import { useFrameSelection } from '~/propagation-react/hooks/useFrameSelection'

// OPTION 1: Minimal changes using adapters
// This allows existing code to work with minimal modifications
export function EditorWithAdapters() {
  // These imports provide backward compatibility
  import { useUIStack } from '~/propagation-react/contexts/FrameStackAdapter' // Adapter
  import { useContextFrame } from '~/propagation-react/hooks/useContextFrameAdapter' // Adapter
  import { useContextSelection } from '~/propagation-react/hooks/useContextSelectionAdapter' // Adapter
  
  // Existing code continues to work
  const uiStack = useUIStack()
  const { activeTool, activateTool } = useContextFrame()
  const { selectedContacts } = useContextSelection()
  
  // Continue using existing patterns
  const handlePropertyEdit = () => {
    uiStack.push({
      type: 'propertyFocus',
      onEscape: () => {
        // Handle escape
      }
    })
  }
  
  return <div>Editor with adapters</div>
}

// OPTION 2: Full migration to new system
// This is the recommended approach for new code
export function EditorFullyMigrated() {
  const frameStack = useContextFrameStack()
  const selection = useFrameSelection()
  
  // Property editing with new stack
  const handlePropertyEdit = useCallback((nodeId: string, focusInput = false) => {
    frameStack.pushPropertyMode(nodeId, focusInput)
  }, [frameStack])
  
  // Valence mode with new stack
  const handleValenceMode = useCallback(() => {
    if (!selection.hasSelection) return
    
    const totalOutputCount = calculateTotalOutputs(
      selection.selectedContacts,
      selection.selectedGroups
    )
    
    frameStack.pushValenceMode({
      contactIds: Array.from(selection.selectedContactIds),
      groupIds: Array.from(selection.selectedGroupIds),
      totalOutputCount
    })
  }, [frameStack, selection])
  
  // Navigation with new stack
  const handleNavigateIntoGroup = useCallback((groupId: string) => {
    frameStack.pushNavigation(groupId)
  }, [frameStack])
  
  // Unified escape handling
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      
      const { currentFrame, pop } = frameStack
      
      // Let frame handle escape if it wants to
      if (currentFrame?.onEscape) {
        const preventPop = currentFrame.onEscape()
        if (preventPop) return
      }
      
      // Default: pop the stack
      pop()
    }
    
    // Other keyboard shortcuts...
  }, [frameStack])
  
  // Visual feedback based on stack state
  const getBackgroundClass = () => {
    const { currentFrame, isInMode } = frameStack
    
    if (isInMode('property')) return 'bg-gray-800'
    if (isInMode('valence')) return 'bg-gray-700'
    if (frameStack.stack.length > 1) return 'bg-gray-700'
    
    return 'bg-gray-600'
  }
  
  // Tool activation
  const handleToolActivation = useCallback((tool: Tool) => {
    frameStack.pushToolFrame(tool)
  }, [frameStack])
  
  return (
    <div className={getBackgroundClass()}>
      {/* Valence mode indicator */}
      {frameStack.isInMode('valence') && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <div className="absolute inset-4 border-4 border-green-500/50 rounded-lg" />
        </div>
      )}
      
      {/* Property focus indicator */}
      {frameStack.isInMode('property') && (
        <div className="property-panel-focused-indicator">
          {/* Your property panel UI */}
        </div>
      )}
      
      {/* Debug visualization (remove in production) */}
      <FrameStackDebugger />
      
      {/* Rest of editor UI */}
    </div>
  )
}

// Helper function example
function calculateTotalOutputs(contacts: Contact[], groups: ContactGroup[]): number {
  let total = contacts.length
  
  for (const group of groups) {
    const { outputs } = group.getBoundaryContacts()
    total += outputs.length
  }
  
  return total
}

// Example: Migrating specific UI patterns

// OLD: Property panel with UI stack
function OldPropertyPanel() {
  const uiStack = useUIStack()
  const { selection } = useContextFrame()
  
  const showPanel = () => {
    uiStack.push({
      type: 'propertyFocus',
      data: { nodeId: selection.contactIds.values().next().value },
      onEscape: () => {
        // Custom escape handling
        return true // Prevent pop
      }
    })
  }
  
  return <div>Old property panel</div>
}

// NEW: Property panel with frame stack
function NewPropertyPanel() {
  const frameStack = useContextFrameStack()
  const { selectedContacts } = useFrameSelection()
  
  const showPanel = () => {
    const nodeId = selectedContacts[0]?.id
    if (nodeId) {
      frameStack.pushPropertyMode(nodeId, true)
    }
  }
  
  return <div>New property panel</div>
}

// Example: Custom tool integration
class MyCustomTool implements Tool {
  id = 'my-tool'
  name = 'My Tool'
  
  onActivate(frame: ContextFrame) {
    console.log('Tool activated in group:', frame.groupId)
  }
  
  onDeactivate() {
    console.log('Tool deactivated')
  }
  
  handleNodeClick(nodeId: string, frame: ContextFrame) {
    console.log('Node clicked:', nodeId)
  }
  
  handleKeyPress(event: KeyboardEvent, frame: ContextFrame): boolean {
    if (event.key === 'Enter') {
      // Handle enter key
      return true // Handled
    }
    return false
  }
}

// Using the custom tool
function ToolExample() {
  const frameStack = useContextFrameStack()
  
  const activateMyTool = () => {
    const tool = new MyCustomTool()
    frameStack.pushToolFrame(tool)
  }
  
  return <button onClick={activateMyTool}>Activate Tool</button>
}
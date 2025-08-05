/**
 * ReadMode - Read-only inspection mode
 * No editing allowed, click to inspect values and propagation paths
 */

import { MajorModeBase } from '../MajorModeBase'
import type {
  ModeContext,
  ClickTarget,
  DragTarget,
  DragEvent
} from '../types'

export class ReadMode extends MajorModeBase {
  id = 'read'
  name = 'Read'
  icon = '👁️'
  description = 'Read-only inspection mode'
  
  private inspectingNodeId: string | null = null
  
  onActivate(context: ModeContext): void {
    // Clear selection and annotations
    context.commands.clearSelection()
    context.annotations.clearAll()
  }
  
  onDeactivate(context: ModeContext): void {
    context.annotations.clearAll()
  }
  
  handleClick(target: ClickTarget, context: ModeContext): boolean {
    if (target.type === 'node' && target.id) {
      // Click to inspect - just set focus
      this.inspectingNodeId = target.id
      context.commands.setFocus(target.id)
      
      // Could highlight propagation paths from this node
      this.highlightPropagationPaths(target.id, context)
      
      return true
    }
    
    if (target.type === 'canvas') {
      // Clear focus and highlights
      this.inspectingNodeId = null
      context.commands.setFocus(null)
      context.annotations.clearAll()
      return true
    }
    
    return false
  }
  
  handleDoubleClick(target: ClickTarget, context: ModeContext): boolean {
    if (target.type === 'node' && target.id) {
      // In read mode, double-click navigates into groups but doesn't edit
      const group = context.network.currentGroup.subgroups.get(target.id)
      if (group && !group.isPrimitive) {
        context.commands.navigateToGroup(target.id)
        return true
      }
    }
    return false
  }
  
  // Prevent all drag operations
  handleDragStart(_target: DragTarget, _context: ModeContext): boolean {
    return true // Return true to consume event but do nothing
  }
  
  handleDrag(_event: DragEvent, _context: ModeContext): boolean {
    return true // Consume but do nothing
  }
  
  handleDragEnd(_event: DragEvent, _context: ModeContext): boolean {
    return true // Consume but do nothing
  }
  
  handleKeyPress(event: KeyboardEvent, context: ModeContext): boolean {
    // Only navigation keys work in read mode
    if (event.key === 'Escape') {
      context.commands.setFocus(null)
      context.annotations.clearAll()
      return true
    }
    
    // Prevent deletion
    if (event.key === 'Delete' || event.key === 'Backspace') {
      return true // Consume but do nothing
    }
    
    return false
  }
  
  // Helper to highlight propagation paths
  private highlightPropagationPaths(nodeId: string, context: ModeContext): void {
    context.annotations.clearAll()
    
    // Highlight the focused node
    context.annotations.highlight([nodeId], 'ring-4 ring-blue-500')
    
    // Find and highlight connected nodes
    const connectedNodes: string[] = []
    
    // Check outgoing connections
    const contact = context.network.currentGroup.contacts.get(nodeId)
    if (contact) {
      const outgoing = context.network.currentGroup.getOutgoingConnections(nodeId)
      outgoing.forEach(({ targetId }) => {
        connectedNodes.push(targetId)
      })
      
      const incoming = context.network.currentGroup.getIncomingConnections(nodeId)
      incoming.forEach(({ sourceId }) => {
        connectedNodes.push(sourceId)
      })
    }
    
    // Highlight connected nodes differently
    if (connectedNodes.length > 0) {
      context.annotations.highlight(connectedNodes, 'ring-2 ring-green-500 opacity-75')
    }
    
    // Show value in badge
    if (contact && contact.content !== undefined) {
      const valueStr = typeof contact.content === 'object' 
        ? JSON.stringify(contact.content).substring(0, 20) + '...'
        : String(contact.content)
      context.annotations.badge(nodeId, valueStr, 'top')
    }
  }
  
  getCursor(_context: ModeContext): string {
    return 'pointer' // Always pointer in read mode
  }
  
  getNodeClassName(nodeId: string, context: ModeContext): string {
    if (context.focus === nodeId) {
      return 'cursor-pointer'
    }
    return 'cursor-pointer opacity-90'
  }
  
  getStatusMessage(context: ModeContext): string {
    if (context.focus) {
      return 'Read Mode - Click nodes to inspect values'
    }
    return 'Read Mode - No editing allowed'
  }
  
  // Override permissions
  canEdit(_context: ModeContext): boolean {
    return false
  }
  
  canConnect(_context: ModeContext): boolean {
    return false
  }
  
  // URL state management
  getURLParams(_context: ModeContext): Record<string, string> {
    const params: Record<string, string> = {}
    if (this.inspectingNodeId) {
      params.inspecting = this.inspectingNodeId
    }
    return params
  }
  
  loadFromURLParams(params: Record<string, string>, context: ModeContext): void {
    if (params.inspecting) {
      this.inspectingNodeId = params.inspecting
      context.commands.setFocus(params.inspecting)
      this.highlightPropagationPaths(params.inspecting, context)
    }
  }
}
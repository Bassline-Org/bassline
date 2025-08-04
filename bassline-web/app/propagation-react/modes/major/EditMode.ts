/**
 * EditMode - Default major mode for normal editing
 * Handles standard node manipulation, connection creation, etc.
 */

import { MajorModeBase } from '../MajorModeBase'
import type {
  ModeContext,
  ClickTarget,
  DragTarget,
  DragEvent,
  ToolbarItem
} from '../types'

export class EditMode extends MajorModeBase {
  id = 'edit'
  name = 'Edit'
  icon = '✏️'
  description = 'Normal editing mode'
  
  private dragState: {
    type: 'move' | 'connect' | null
    sourceId?: string
    handleId?: string
  } = { type: null }
  
  onActivate(context: ModeContext): void {
    // Clear any visual annotations
    context.annotations.clearAll()
    this.dragState = { type: null }
  }
  
  onDeactivate(context: ModeContext): void {
    context.annotations.clearAll()
    this.dragState = { type: null }
  }
  
  handleClick(target: ClickTarget, context: ModeContext): boolean {
    if (target.type === 'node' && target.id) {
      // Single click selects
      if (target.event.shiftKey || target.event.metaKey) {
        // Add to selection
        context.commands.addToSelection([target.id])
      } else {
        // Replace selection
        context.commands.select([target.id])
      }
      return true
    }
    
    if (target.type === 'canvas') {
      // Click on canvas clears selection
      context.commands.clearSelection()
      return true
    }
    
    return false
  }
  
  handleDoubleClick(target: ClickTarget, context: ModeContext): boolean {
    if (target.type === 'node' && target.id) {
      // Check if it's a group/gadget
      const group = context.network.currentGroup.subgroups.get(target.id)
      if (group && !group.isPrimitive) {
        // Navigate into group
        context.commands.navigateToGroup(target.id)
        return true
      }
      
      // Otherwise open property editor
      context.commands.setFocus(target.id)
      return true
    }
    
    return false
  }
  
  handleDragStart(target: DragTarget, _context: ModeContext): boolean {
    if (target.type === 'node' && target.id) {
      // Dragging a node moves it (and selection if part of selection)
      this.dragState = { type: 'move', sourceId: target.id }
      return true
    }
    
    if (target.type === 'handle' && target.id && target.handleId) {
      // Dragging from handle starts connection
      this.dragState = { 
        type: 'connect', 
        sourceId: target.id,
        handleId: target.handleId 
      }
      return true
    }
    
    return false
  }
  
  handleDrag(event: DragEvent, context: ModeContext): boolean {
    if (this.dragState.type === 'move' && this.dragState.sourceId) {
      // Move the node (and any other selected nodes)
      const selectedNodes = context.selection.nodes.has(this.dragState.sourceId)
        ? Array.from(context.selection.nodes)
        : [this.dragState.sourceId]
      
      // Apply delta to all selected nodes
      selectedNodes.forEach(nodeId => {
        const node = context.network.currentGroup.contacts.get(nodeId) || 
                     context.network.currentGroup.subgroups.get(nodeId)
        if (node && node.position) {
          const newPos = {
            x: node.position.x + event.delta.x,
            y: node.position.y + event.delta.y
          }
          context.commands.moveNode(nodeId, newPos)
        }
      })
      
      return true
    }
    
    if (this.dragState.type === 'connect') {
      // Show connection preview
      context.annotations.showPreview({
        type: 'connection',
        fromId: this.dragState.sourceId!,
        toPosition: event.current,
        isValid: true // Could check hover target for validity
      })
      return true
    }
    
    return false
  }
  
  handleDragEnd(event: DragEvent, context: ModeContext): boolean {
    if (this.dragState.type === 'connect' && this.dragState.sourceId) {
      // Clear preview
      context.annotations.clearAll()
      
      // Check if we're over a valid target
      if (context.interactionPoint.hoveredNodeId) {
        // Create connection
        context.commands.connect(
          this.dragState.sourceId,
          context.interactionPoint.hoveredNodeId
        )
      } else if (event.target.type === 'canvas') {
        // Dropped on canvas - could show quick add menu
        // For now, create a new contact
        const newNodeId = context.commands.createNode(event.current, 'contact')
        context.commands.connect(this.dragState.sourceId, newNodeId)
      }
    }
    
    this.dragState = { type: null }
    return true
  }
  
  handleKeyPress(event: KeyboardEvent, context: ModeContext): boolean {
    // Delete key removes selected items
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selectedNodes = Array.from(context.selection.nodes)
      selectedNodes.forEach(nodeId => {
        context.commands.deleteNode(nodeId)
      })
      context.commands.clearSelection()
      return true
    }
    
    // Escape clears selection
    if (event.key === 'Escape') {
      context.commands.clearSelection()
      return true
    }
    
    return false
  }
  
  getCursor(context: ModeContext): string {
    if (context.interactionPoint.hoveredHandleId) {
      return 'crosshair'
    }
    if (context.interactionPoint.hoveredNodeId) {
      return 'move'
    }
    return 'default'
  }
  
  getNodeClassName(nodeId: string, context: ModeContext): string {
    const classes: string[] = []
    
    if (context.selection.nodes.has(nodeId)) {
      classes.push('ring-2 ring-primary')
    }
    
    if (context.focus === nodeId) {
      classes.push('ring-4 ring-primary shadow-lg')
    }
    
    return classes.join(' ')
  }
  
  getToolbarItems(context: ModeContext): ToolbarItem[] {
    return [
      {
        id: 'add-contact',
        label: 'Add Contact',
        icon: '➕',
        shortcut: 'A',
        onClick: () => {
          const pos = { x: 100, y: 100 } // Could be smarter about position
          context.commands.createNode(pos, 'contact')
        }
      },
      {
        id: 'delete-selected',
        label: 'Delete',
        icon: '🗑️',
        shortcut: 'Delete',
        onClick: () => {
          const selectedNodes = Array.from(context.selection.nodes)
          selectedNodes.forEach(nodeId => {
            context.commands.deleteNode(nodeId)
          })
          context.commands.clearSelection()
        },
        active: !context.selection.isEmpty()
      }
    ]
  }
}
/**
 * QuickPropertyMode - Single-click nodes to edit properties
 * Tab/Shift+Tab to cycle through nodes
 */

import { MinorModeBase } from '../MinorModeBase'
import type { ModeContext } from '../types'

export class QuickPropertyMode extends MinorModeBase {
  id = 'quick-property'
  name = 'Quick Property'
  icon = '⚡'
  description = 'Single-click to edit properties'
  
  private editingNodeId: string | null = null
  
  onEnable(context: ModeContext): void {
    // If there's a focused node, start editing it
    if (context.focus) {
      this.editingNodeId = context.focus
      this.highlightEditingNode(context)
    }
  }
  
  onDisable(context: ModeContext): void {
    this.editingNodeId = null
    context.annotations.clearAll()
  }
  
  handleKeyPress(event: KeyboardEvent, context: ModeContext): boolean {
    // Tab to cycle through nodes
    if (event.key === 'Tab') {
      event.preventDefault()
      
      const allNodes = Array.from(context.network.currentGroup.contacts.keys())
      if (allNodes.length === 0) return true
      
      if (!this.editingNodeId) {
        // Start with first node
        this.editingNodeId = allNodes[0]
      } else {
        // Find next node
        const currentIndex = allNodes.indexOf(this.editingNodeId)
        const nextIndex = event.shiftKey 
          ? (currentIndex - 1 + allNodes.length) % allNodes.length
          : (currentIndex + 1) % allNodes.length
        this.editingNodeId = allNodes[nextIndex]
      }
      
      context.commands.setFocus(this.editingNodeId)
      this.highlightEditingNode(context)
      return true
    }
    
    // Enter to confirm and move to next
    if (event.key === 'Enter' && this.editingNodeId) {
      // In real implementation, would save the property value
      // For now, just move to next
      const allNodes = Array.from(context.network.currentGroup.contacts.keys())
      const currentIndex = allNodes.indexOf(this.editingNodeId)
      const nextIndex = (currentIndex + 1) % allNodes.length
      this.editingNodeId = allNodes[nextIndex]
      context.commands.setFocus(this.editingNodeId)
      this.highlightEditingNode(context)
      return true
    }
    
    // Escape to stop editing
    if (event.key === 'Escape') {
      this.editingNodeId = null
      context.commands.setFocus(null)
      context.annotations.clearAll()
      return true
    }
    
    return false
  }
  
  private highlightEditingNode(context: ModeContext): void {
    context.annotations.clearAll()
    if (this.editingNodeId) {
      context.annotations.highlight([this.editingNodeId], 'ring-4 ring-yellow-500 shadow-lg')
      
      // Show current value in badge
      const contact = context.network.currentGroup.contacts.get(this.editingNodeId)
      if (contact) {
        const value = contact.content ?? '∅'
        context.annotations.badge(this.editingNodeId, String(value), 'top')
      }
    }
  }
  
  modifyNodeClassName(nodeId: string, className: string, _context: ModeContext): string {
    // Make all nodes look clickable in this mode
    return `${className} cursor-text hover:ring-2 hover:ring-yellow-400`
  }
  
  getStatusMessage(_context: ModeContext): string {
    if (this.editingNodeId) {
      return 'Quick Property: Tab to next, Shift+Tab to previous, Escape to exit'
    }
    return 'Quick Property: Click any node to edit'
  }
}
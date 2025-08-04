/**
 * ValenceMode - Click compatible nodes to auto-connect
 * Works as a minor mode that enhances the major mode's click behavior
 */

import { MinorModeBase } from '../MinorModeBase'
import type { ModeContext, ToolbarItem } from '../types'

export class ValenceMode extends MinorModeBase {
  id = 'valence'
  name = 'Valence'
  icon = '🔗'
  description = 'Click compatible gadgets to auto-connect'
  
  private sourceSelection: {
    nodes: string[]
    totalOutputs: number
  } | null = null
  
  onEnable(context: ModeContext): void {
    // Capture current selection as sources
    const selectedNodes = Array.from(context.selection.nodes)
    if (selectedNodes.length === 0) {
      // No selection - can't use valence mode
      this.sourceSelection = null
      return
    }
    
    // Calculate total outputs from selection
    let totalOutputs = 0
    selectedNodes.forEach(nodeId => {
      const contact = context.network.currentGroup.contacts.get(nodeId)
      if (contact) {
        totalOutputs += 1
      } else {
        const gadget = context.network.currentGroup.subgroups.get(nodeId)
        if (gadget) {
          const { outputs } = gadget.getBoundaryContacts()
          totalOutputs += outputs.length
        }
      }
    })
    
    this.sourceSelection = {
      nodes: selectedNodes,
      totalOutputs
    }
    
    // Highlight sources
    context.annotations.highlight(selectedNodes, 'ring-4 ring-blue-500')
    
    // Find and highlight compatible targets
    this.updateCompatibleTargets(context)
  }
  
  onDisable(context: ModeContext): void {
    this.sourceSelection = null
    context.annotations.clearAll()
    // Clear selection when exiting valence mode
    context.commands.clearSelection()
  }
  
  private updateCompatibleTargets(context: ModeContext): void {
    if (!this.sourceSelection) return
    
    const compatible: string[] = []
    
    // Check all gadgets for compatibility
    context.network.currentGroup.subgroups.forEach((gadget, gadgetId) => {
      // Skip if it's in the source selection
      if (this.sourceSelection!.nodes.includes(gadgetId)) return
      
      const { inputs } = gadget.getBoundaryContacts()
      if (inputs.length === this.sourceSelection!.totalOutputs) {
        compatible.push(gadgetId)
      }
    })
    
    // Highlight compatible targets
    if (compatible.length > 0) {
      context.annotations.highlight(compatible, 'ring-4 ring-green-500 animate-pulse')
    }
  }
  
  handleKeyPress(event: KeyboardEvent, context: ModeContext): boolean {
    // 'V' key toggles valence mode
    if (event.key === 'v' && !event.ctrlKey && !event.metaKey) {
      context.commands.toggleMinorMode(this.id)
      return true
    }
    
    // Escape also exits valence mode
    if (event.key === 'Escape' && this.sourceSelection) {
      context.commands.toggleMinorMode(this.id)
      return true
    }
    
    return false
  }
  
  modifyNodeClassName(nodeId: string, className: string, context: ModeContext): string {
    if (!this.sourceSelection) return className
    
    // Dim non-compatible nodes
    const isSource = this.sourceSelection.nodes.includes(nodeId)
    const isCompatible = this.isCompatibleTarget(nodeId, context)
    
    if (!isSource && !isCompatible) {
      return `${className} opacity-30`
    }
    
    if (isCompatible) {
      return `${className} cursor-pointer hover:scale-105`
    }
    
    return className
  }
  
  private isCompatibleTarget(nodeId: string, context: ModeContext): boolean {
    if (!this.sourceSelection) return false
    
    const gadget = context.network.currentGroup.subgroups.get(nodeId)
    if (!gadget) return false
    
    const { inputs } = gadget.getBoundaryContacts()
    return inputs.length === this.sourceSelection.totalOutputs
  }
  
  getToolbarItems(_context: ModeContext): ToolbarItem[] {
    return [
      {
        id: 'valence-info',
        label: `Valence: ${this.sourceSelection?.totalOutputs || 0} outputs`,
        icon: '🔗',
        onClick: () => {}, // Just informational
        active: true
      }
    ]
  }
  
  getStatusMessage(_context: ModeContext): string {
    if (this.sourceSelection) {
      return `Valence Mode: Click compatible gadgets (${this.sourceSelection.totalOutputs} inputs) to connect`
    }
    return 'Valence Mode: No sources selected'
  }
}
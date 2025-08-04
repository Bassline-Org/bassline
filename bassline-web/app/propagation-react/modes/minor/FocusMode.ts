/**
 * FocusMode - Dims non-selected nodes for better focus
 */

import { MinorModeBase } from '../MinorModeBase'
import type { ModeContext } from '../types'

export class FocusMode extends MinorModeBase {
  id = 'focus'
  name = 'Focus'
  icon = '🎯'
  description = 'Dim non-selected nodes'
  
  onEnable(_context: ModeContext): void {
    // Visual changes will be applied through modifyNodeClassName
  }
  
  onDisable(_context: ModeContext): void {
    // Visual changes will be removed automatically
  }
  
  modifyNodeClassName(nodeId: string, className: string, context: ModeContext): string {
    // If there's a selection and this node isn't in it, dim it
    if (!context.selection.isEmpty() && !context.selection.has(nodeId)) {
      return `${className} opacity-30 transition-opacity`
    }
    
    // If this is the focused node, make it stand out more
    if (context.focus === nodeId) {
      return `${className} scale-105 transition-transform`
    }
    
    return className
  }
  
  modifyEdgeClassName(edgeId: string, className: string, context: ModeContext): string {
    // Dim edges that don't connect to selected nodes
    if (!context.selection.isEmpty()) {
      // This is simplified - in real implementation would check if edge connects to selected nodes
      if (!context.selection.edges.has(edgeId)) {
        return `${className} opacity-20 transition-opacity`
      }
    }
    
    return className
  }
}
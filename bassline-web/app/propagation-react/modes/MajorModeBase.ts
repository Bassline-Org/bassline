/**
 * Base class for major modes
 * Provides default implementations that can be overridden
 */

import type {
  MajorMode,
  ModeContext,
  ClickTarget,
  DragTarget,
  DragEvent,
  HoverTarget,
  ToolbarItem
} from './types'

export abstract class MajorModeBase implements MajorMode {
  abstract id: string
  abstract name: string
  icon?: string
  description?: string
  
  // Lifecycle - must be implemented
  abstract onActivate(context: ModeContext): void
  abstract onDeactivate(context: ModeContext): void
  
  // Default implementations - override as needed
  
  handleClick(target: ClickTarget, context: ModeContext): boolean {
    return false
  }
  
  handleDoubleClick(target: ClickTarget, context: ModeContext): boolean {
    return false
  }
  
  handleRightClick(target: ClickTarget, context: ModeContext): boolean {
    return false
  }
  
  handleDragStart(target: DragTarget, context: ModeContext): boolean {
    return false
  }
  
  handleDrag(event: DragEvent, context: ModeContext): boolean {
    return false
  }
  
  handleDragEnd(event: DragEvent, context: ModeContext): boolean {
    return false
  }
  
  handleKeyPress(event: KeyboardEvent, context: ModeContext): boolean {
    return false
  }
  
  handleKeyUp(event: KeyboardEvent, context: ModeContext): boolean {
    return false
  }
  
  handleHover(target: HoverTarget, context: ModeContext): boolean {
    return false
  }
  
  getCursor(context: ModeContext): string {
    return 'default'
  }
  
  getNodeClassName(nodeId: string, context: ModeContext): string {
    return ''
  }
  
  getEdgeClassName(edgeId: string, context: ModeContext): string {
    return ''
  }
  
  getToolbarItems(context: ModeContext): ToolbarItem[] {
    return []
  }
  
  getStatusMessage(context: ModeContext): string {
    return `${this.name} Mode`
  }
  
  // Default permissions - override to restrict
  
  canEdit(context: ModeContext): boolean {
    return true
  }
  
  canSelect(context: ModeContext): boolean {
    return true
  }
  
  canConnect(context: ModeContext): boolean {
    return true
  }
}
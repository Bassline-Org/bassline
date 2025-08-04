/**
 * Base class for minor modes
 * Provides default implementations that can be overridden
 */

import type {
  MinorMode,
  ModeContext,
  Command,
  Point,
  ToolbarItem
} from './types'

export abstract class MinorModeBase implements MinorMode {
  abstract id: string
  abstract name: string
  icon?: string
  description?: string
  
  // Lifecycle - must be implemented
  abstract onEnable(context: ModeContext): void
  abstract onDisable(context: ModeContext): void
  
  // Default implementations - override as needed
  
  beforeCommand(command: Command, _context: ModeContext): Command | null {
    // By default, pass through unchanged
    return command
  }
  
  afterCommand(_command: Command, _result: any, _context: ModeContext): void {
    // By default, do nothing
  }
  
  handleKeyPress(_event: KeyboardEvent, _context: ModeContext): boolean {
    return false
  }
  
  modifyNodeClassName(_nodeId: string, className: string, _context: ModeContext): string {
    // By default, pass through unchanged
    return className
  }
  
  modifyEdgeClassName(_edgeId: string, className: string, _context: ModeContext): string {
    // By default, pass through unchanged
    return className
  }
  
  constrainNodePosition(_nodeId: string, position: Point, _context: ModeContext): Point {
    // By default, no constraint
    return position
  }
  
  getToolbarItems(_context: ModeContext): ToolbarItem[] {
    return []
  }
  
  getStatusMessage(_context: ModeContext): string {
    return ''
  }
}
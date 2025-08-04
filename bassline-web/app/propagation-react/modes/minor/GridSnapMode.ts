/**
 * GridSnapMode - Snaps node positions to a grid
 */

import { MinorModeBase } from '../MinorModeBase'
import type { ModeContext, Command, Point } from '../types'

export class GridSnapMode extends MinorModeBase {
  id = 'grid-snap'
  name = 'Grid Snap'
  icon = '⊞'
  description = 'Snap nodes to grid'
  
  private gridSize = 20
  
  onEnable(_context: ModeContext): void {
    // Could snap all existing nodes to grid on enable
  }
  
  onDisable(_context: ModeContext): void {
    // Nothing to clean up
  }
  
  beforeCommand(command: Command, _context: ModeContext): Command | null {
    // Intercept move commands to snap positions
    if (command.type === 'moveNode' && command.payload.position) {
      return {
        ...command,
        payload: {
          ...command.payload,
          position: this.snapToGrid(command.payload.position)
        }
      }
    }
    
    // Intercept create commands to snap positions
    if (command.type === 'createNode' && command.payload.position) {
      return {
        ...command,
        payload: {
          ...command.payload,
          position: this.snapToGrid(command.payload.position)
        }
      }
    }
    
    return command
  }
  
  constrainNodePosition(_nodeId: string, position: Point, _context: ModeContext): Point {
    return this.snapToGrid(position)
  }
  
  private snapToGrid(position: Point): Point {
    return {
      x: Math.round(position.x / this.gridSize) * this.gridSize,
      y: Math.round(position.y / this.gridSize) * this.gridSize
    }
  }
  
  getStatusMessage(_context: ModeContext): string {
    return `Grid: ${this.gridSize}px`
  }
  
  // URL state management
  getURLParams(_context: ModeContext): Record<string, string> {
    return {
      size: this.gridSize.toString()
    }
  }
  
  loadFromURLParams(params: Record<string, string>, _context: ModeContext): void {
    if (params.size) {
      const size = parseInt(params.size, 10)
      if (!isNaN(size) && size > 0 && size <= 100) {
        this.gridSize = size
      }
    }
  }
}
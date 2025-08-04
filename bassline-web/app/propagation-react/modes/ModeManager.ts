/**
 * ModeManager - Manages active major and minor modes
 * Routes interactions through modes in the correct order
 */

import type {
  MajorMode,
  MinorMode,
  ModeContext,
  ClickTarget,
  DragTarget,
  DragEvent,
  HoverTarget,
  Command,
  ToolbarItem,
  ModeInfo,
  Point
} from './types'

export class ModeManager {
  private majorMode: MajorMode | null = null
  private minorModes = new Map<string, MinorMode>()
  private majorModes = new Map<string, MajorMode>()
  private minorModeRegistry = new Map<string, MinorMode>()
  
  // URL state management
  private urlStatePrefix = 'mode' // Prefix for mode-specific URL params
  
  // Register available modes
  registerMajorMode(mode: MajorMode): void {
    this.majorModes.set(mode.id, mode)
  }
  
  registerMinorMode(mode: MinorMode): void {
    this.minorModeRegistry.set(mode.id, mode)
  }
  
  // Switch major mode
  switchMajorMode(modeId: string, context: ModeContext): void {
    const newMode = this.majorModes.get(modeId)
    if (!newMode) {
      console.warn(`Major mode '${modeId}' not found`)
      return
    }
    
    // Deactivate current mode
    if (this.majorMode) {
      this.majorMode.onDeactivate(context)
    }
    
    // Activate new mode
    this.majorMode = newMode
    this.majorMode.onActivate(context)
  }
  
  // Toggle minor mode
  toggleMinorMode(modeId: string, context: ModeContext): void {
    if (this.minorModes.has(modeId)) {
      // Disable if already active
      const mode = this.minorModes.get(modeId)!
      mode.onDisable(context)
      this.minorModes.delete(modeId)
    } else {
      // Enable if available
      const mode = this.minorModeRegistry.get(modeId)
      if (mode) {
        this.minorModes.set(modeId, mode)
        mode.onEnable(context)
      } else {
        console.warn(`Minor mode '${modeId}' not found`)
      }
    }
  }
  
  // Get active modes info
  getActiveMajorMode(): MajorMode | null {
    return this.majorMode
  }
  
  getActiveMinorModes(): MinorMode[] {
    return Array.from(this.minorModes.values())
  }
  
  getAvailableModes(): ModeInfo[] {
    const modes: ModeInfo[] = []
    
    // Add major modes
    this.majorModes.forEach(mode => {
      modes.push({
        id: mode.id,
        name: mode.name,
        type: 'major',
        icon: mode.icon,
        description: mode.description
      })
    })
    
    // Add minor modes
    this.minorModeRegistry.forEach(mode => {
      modes.push({
        id: mode.id,
        name: mode.name,
        type: 'minor',
        icon: mode.icon,
        description: mode.description
      })
    })
    
    return modes
  }
  
  // Interaction routing - Major mode first, then minor modes
  
  handleClick(target: ClickTarget, context: ModeContext): boolean {
    if (this.majorMode?.handleClick?.(target, context)) {
      return true
    }
    return false
  }
  
  handleDoubleClick(target: ClickTarget, context: ModeContext): boolean {
    if (this.majorMode?.handleDoubleClick?.(target, context)) {
      return true
    }
    return false
  }
  
  handleRightClick(target: ClickTarget, context: ModeContext): boolean {
    if (this.majorMode?.handleRightClick?.(target, context)) {
      return true
    }
    return false
  }
  
  handleDragStart(target: DragTarget, context: ModeContext): boolean {
    if (this.majorMode?.handleDragStart?.(target, context)) {
      return true
    }
    return false
  }
  
  handleDrag(event: DragEvent, context: ModeContext): boolean {
    if (this.majorMode?.handleDrag?.(event, context)) {
      return true
    }
    return false
  }
  
  handleDragEnd(event: DragEvent, context: ModeContext): boolean {
    if (this.majorMode?.handleDragEnd?.(event, context)) {
      return true
    }
    return false
  }
  
  handleKeyPress(event: KeyboardEvent, context: ModeContext): boolean {
    // Major mode gets first chance
    if (this.majorMode?.handleKeyPress?.(event, context)) {
      return true
    }
    
    // Then minor modes in order
    for (const mode of this.minorModes.values()) {
      if (mode.handleKeyPress?.(event, context)) {
        return true
      }
    }
    
    return false
  }
  
  handleHover(target: HoverTarget, context: ModeContext): boolean {
    if (this.majorMode?.handleHover?.(target, context)) {
      return true
    }
    return false
  }
  
  // Command transformation through minor modes
  
  transformCommand(command: Command, context: ModeContext): Command | null {
    let currentCommand = command
    
    // Let minor modes transform the command
    for (const mode of this.minorModes.values()) {
      if (mode.beforeCommand) {
        const transformed = mode.beforeCommand(currentCommand, context)
        if (transformed === null) {
          // Command cancelled
          return null
        }
        currentCommand = transformed
      }
    }
    
    return currentCommand
  }
  
  notifyCommandComplete(command: Command, result: any, context: ModeContext): void {
    // Notify minor modes of command completion
    for (const mode of this.minorModes.values()) {
      mode.afterCommand?.(command, result, context)
    }
  }
  
  // Visual state aggregation
  
  getCursor(context: ModeContext): string {
    return this.majorMode?.getCursor?.(context) || 'default'
  }
  
  getNodeClassName(nodeId: string, context: ModeContext): string {
    let className = this.majorMode?.getNodeClassName?.(nodeId, context) || ''
    
    // Let minor modes modify
    for (const mode of this.minorModes.values()) {
      if (mode.modifyNodeClassName) {
        className = mode.modifyNodeClassName(nodeId, className, context)
      }
    }
    
    return className
  }
  
  getEdgeClassName(edgeId: string, context: ModeContext): string {
    let className = this.majorMode?.getEdgeClassName?.(edgeId, context) || ''
    
    // Let minor modes modify
    for (const mode of this.minorModes.values()) {
      if (mode.modifyEdgeClassName) {
        className = mode.modifyEdgeClassName(edgeId, className, context)
      }
    }
    
    return className
  }
  
  // Constraint application
  
  constrainNodePosition(nodeId: string, position: Point, context: ModeContext): Point {
    let constrainedPos = position
    
    // Apply minor mode constraints in order
    for (const mode of this.minorModes.values()) {
      if (mode.constrainNodePosition) {
        constrainedPos = mode.constrainNodePosition(nodeId, constrainedPos, context)
      }
    }
    
    return constrainedPos
  }
  
  // UI state aggregation
  
  getToolbarItems(context: ModeContext): ToolbarItem[] {
    const items: ToolbarItem[] = []
    
    // Major mode items first
    if (this.majorMode?.getToolbarItems) {
      items.push(...this.majorMode.getToolbarItems(context))
    }
    
    // Then minor mode items
    for (const mode of this.minorModes.values()) {
      if (mode.getToolbarItems) {
        items.push(...mode.getToolbarItems(context))
      }
    }
    
    return items
  }
  
  getStatusMessage(context: ModeContext): string {
    // Prefer major mode status
    if (this.majorMode?.getStatusMessage) {
      const majorStatus = this.majorMode.getStatusMessage(context)
      if (majorStatus) return majorStatus
    }
    
    // Otherwise check minor modes
    for (const mode of this.minorModes.values()) {
      if (mode.getStatusMessage) {
        const minorStatus = mode.getStatusMessage(context)
        if (minorStatus) return minorStatus
      }
    }
    
    return ''
  }
  
  // Permission checks
  
  canEdit(context: ModeContext): boolean {
    return this.majorMode?.canEdit?.(context) ?? true
  }
  
  canSelect(context: ModeContext): boolean {
    return this.majorMode?.canSelect?.(context) ?? true
  }
  
  canConnect(context: ModeContext): boolean {
    return this.majorMode?.canConnect?.(context) ?? true
  }
  
  // URL state management
  
  getAllURLParams(context: ModeContext): Record<string, string> {
    const params: Record<string, string> = {}
    
    // Get major mode params
    if (this.majorMode?.getURLParams) {
      const majorParams = this.majorMode.getURLParams(context)
      Object.entries(majorParams).forEach(([key, value]) => {
        params[`${this.urlStatePrefix}.${this.majorMode!.id}.${key}`] = value
      })
    }
    
    // Get minor mode params
    for (const mode of this.minorModes.values()) {
      if (mode.getURLParams) {
        const minorParams = mode.getURLParams(context)
        Object.entries(minorParams).forEach(([key, value]) => {
          params[`${this.urlStatePrefix}.${mode.id}.${key}`] = value
        })
      }
    }
    
    return params
  }
  
  loadFromURLParams(params: Record<string, string>, context: ModeContext): void {
    const prefix = `${this.urlStatePrefix}.`
    
    // Group params by mode
    const modeParams = new Map<string, Record<string, string>>()
    
    Object.entries(params).forEach(([key, value]) => {
      if (key.startsWith(prefix)) {
        const keyWithoutPrefix = key.substring(prefix.length)
        const [modeId, ...paramParts] = keyWithoutPrefix.split('.')
        const paramKey = paramParts.join('.')
        
        if (!modeParams.has(modeId)) {
          modeParams.set(modeId, {})
        }
        modeParams.get(modeId)![paramKey] = value
      }
    })
    
    // Load major mode params
    if (this.majorMode && modeParams.has(this.majorMode.id)) {
      this.majorMode.loadFromURLParams?.(modeParams.get(this.majorMode.id)!, context)
    }
    
    // Load minor mode params
    for (const [modeId, params] of modeParams) {
      const mode = this.minorModes.get(modeId)
      if (mode?.loadFromURLParams) {
        mode.loadFromURLParams(params, context)
      }
    }
  }
}

// Singleton instance
export const modeManager = new ModeManager()
/**
 * Core types and interfaces for the mode system
 * Inspired by Emacs major/minor modes
 */

import type { PropagationNetwork } from '~/propagation-core'

// Core primitives that modes interact with

export interface Selection {
  nodes: Set<string>
  edges: Set<string>
  isEmpty(): boolean
  has(id: string): boolean
  clear(): void
  add(id: string): void
  remove(id: string): void
  toggle(id: string): void
  replace(ids: string[]): void
}

export interface InteractionPoint {
  x: number
  y: number
  hoveredNodeId?: string
  hoveredEdgeId?: string
  hoveredHandleId?: string
  isDragging: boolean
  dragStart?: { x: number; y: number }
}

export interface ViewState {
  zoom: number
  center: { x: number; y: number }
  currentGroupId: string
}

// Commands that modes can execute
export interface Commands {
  // Selection
  select(ids: string[]): void
  addToSelection(ids: string[]): void
  removeFromSelection(ids: string[]): void
  clearSelection(): void
  
  // Focus
  setFocus(id: string | null): void
  
  // Network mutations
  connect(fromId: string, toId: string): void
  disconnect(edgeId: string): void
  setValue(nodeId: string, value: any): void
  moveNode(nodeId: string, position: { x: number; y: number }): void
  createNode(position: { x: number; y: number }, type: 'contact' | 'boundary'): string
  deleteNode(nodeId: string): void
  
  // Navigation
  navigateToGroup(groupId: string): void
  navigateToParent(): void
  
  // View
  panTo(position: { x: number; y: number }): void
  zoomTo(level: number): void
  
  // Mode control
  switchMajorMode(modeId: string): void
  exitCurrentMode(): void
  toggleMinorMode(modeId: string): void
}

// Visual annotations (ephemeral, per-frame)
export interface Annotations {
  // Current imperative API
  highlight(ids: string[], className: string): void
  dim(ids: string[]): void
  badge(nodeId: string, text: string, position?: 'top' | 'bottom' | 'left' | 'right'): void
  showPreview(preview: ConnectionPreview | SelectionPreview): void
  clearAll(): void
  
  // Future wrapper API (stub for now)
  registerWrapper?(wrapper: {
    id: string
    component: React.ComponentType<any>
    priority?: number
  }): void
}

export interface ConnectionPreview {
  type: 'connection'
  fromId: string
  toPosition: { x: number; y: number }
  isValid: boolean
}

export interface SelectionPreview {
  type: 'selection'
  bounds: { x: number; y: number; width: number; height: number }
}

// Context passed to all modes
export interface ModeContext {
  // Read-only state
  readonly network: PropagationNetwork
  readonly selection: Selection
  readonly focus: string | null
  readonly viewState: ViewState
  readonly interactionPoint: InteractionPoint
  
  // Write through commands
  readonly commands: Commands
  
  // Visual feedback
  readonly annotations: Annotations
}

// Event types
export interface ClickTarget {
  type: 'node' | 'edge' | 'canvas' | 'handle'
  id?: string
  handleId?: string
  position: { x: number; y: number }
  event: MouseEvent
}

export interface DragTarget {
  type: 'node' | 'selection' | 'canvas' | 'handle'
  id?: string
  handleId?: string
  position: { x: number; y: number }
}

export interface DragEvent {
  start: { x: number; y: number }
  current: { x: number; y: number }
  delta: { x: number; y: number }
  target: DragTarget
  event: MouseEvent
}

export interface HoverTarget {
  type: 'node' | 'edge' | 'handle' | 'canvas'
  id?: string
  handleId?: string
  position: { x: number; y: number }
}

// Command type for transformation
export interface Command {
  type: string
  payload: any
}

export type Point = { x: number; y: number }

// Toolbar integration
export interface ToolbarItem {
  id: string
  label: string
  icon?: string
  shortcut?: string
  onClick: () => void
  active?: boolean
}

// Major mode interface - owns primary interactions
export interface MajorMode {
  id: string
  name: string
  icon?: string
  description?: string
  
  // Lifecycle
  onActivate(context: ModeContext): void
  onDeactivate(context: ModeContext): void
  
  // URL state management
  getURLParams?(context: ModeContext): Record<string, string>
  loadFromURLParams?(params: Record<string, string>, context: ModeContext): void
  
  // Interactions (return true if handled)
  handleClick?(target: ClickTarget, context: ModeContext): boolean
  handleDoubleClick?(target: ClickTarget, context: ModeContext): boolean
  handleRightClick?(target: ClickTarget, context: ModeContext): boolean
  handleDragStart?(target: DragTarget, context: ModeContext): boolean
  handleDrag?(event: DragEvent, context: ModeContext): boolean
  handleDragEnd?(event: DragEvent, context: ModeContext): boolean
  handleKeyPress?(event: KeyboardEvent, context: ModeContext): boolean
  handleKeyUp?(event: KeyboardEvent, context: ModeContext): boolean
  handleHover?(target: HoverTarget, context: ModeContext): boolean
  
  // Visual state
  getCursor?(context: ModeContext): string
  getNodeClassName?(nodeId: string, context: ModeContext): string
  getEdgeClassName?(edgeId: string, context: ModeContext): string
  
  // UI state
  getToolbarItems?(context: ModeContext): ToolbarItem[]
  getStatusMessage?(context: ModeContext): string
  
  // Prevent certain actions
  canEdit?(context: ModeContext): boolean
  canSelect?(context: ModeContext): boolean
  canConnect?(context: ModeContext): boolean
}

// Minor mode interface - adds behaviors without changing core interactions
export interface MinorMode {
  id: string
  name: string
  icon?: string
  description?: string
  
  // Lifecycle
  onEnable(context: ModeContext): void
  onDisable(context: ModeContext): void
  
  // URL state management
  getURLParams?(context: ModeContext): Record<string, string>
  loadFromURLParams?(params: Record<string, string>, context: ModeContext): void
  
  // Command transformation (return null to cancel command)
  beforeCommand?(command: Command, context: ModeContext): Command | null
  afterCommand?(command: Command, result: any, context: ModeContext): void
  
  // Additional behaviors (return true if handled)
  handleKeyPress?(event: KeyboardEvent, context: ModeContext): boolean
  
  // Visual modifications
  modifyNodeClassName?(nodeId: string, className: string, context: ModeContext): string
  modifyEdgeClassName?(edgeId: string, className: string, context: ModeContext): string
  
  // Constraints
  constrainNodePosition?(nodeId: string, position: Point, context: ModeContext): Point
  
  // UI contributions
  getToolbarItems?(context: ModeContext): ToolbarItem[]
  getStatusMessage?(context: ModeContext): string
}

// Mode metadata for UI
export interface ModeInfo {
  id: string
  name: string
  type: 'major' | 'minor'
  icon?: string
  description?: string
  shortcut?: string
}
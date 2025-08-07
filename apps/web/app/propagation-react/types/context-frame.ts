// Context Frame represents a working environment
export interface ContextFrame {
  id: string
  groupId: string  // The ContactGroup we're currently working in
  selection: SelectionState
  viewState: ViewState
  parentContextId?: string  // For nested contexts when navigating into subgroups
  timestamp: number
}

// Selection state within a context
export interface SelectionState {
  contactIds: Set<string>
  groupIds: Set<string>
  lastModified: number
}

// View state for the context
export interface ViewState {
  zoom: number
  center: { x: number; y: number }
  // Could add more view-related state here
}

// Tools that can be activated within a context
export interface Tool {
  id: string
  name: string
  icon?: string
  
  // Lifecycle methods
  onActivate(context: ContextFrame): void
  onDeactivate(): void
  
  // Interaction handlers
  handleKeyPress?(event: KeyboardEvent, context: ContextFrame): boolean
  handleNodeClick?(nodeId: string, context: ContextFrame): void
  handleCanvasClick?(position: { x: number; y: number }, context: ContextFrame): void
  
  // Visual state
  getNodeHighlight?(nodeId: string, context: ContextFrame): string | undefined
  getCursor?(): string
}

// Tool activation state
export interface ToolActivation {
  toolId: string
  activatedAt: number
  context: ContextFrame
}
// Enhanced Context Frame system that unifies navigation and UI modes

// Frame types that can be pushed onto the stack
export type FrameType = 
  | 'navigation'      // Navigation into a subgroup
  | 'property'        // Property editing mode
  | 'valence'         // Valence connection mode
  | 'gadgetMenu'      // Gadget palette/menu
  | 'tool'            // Generic tool activation
  | 'search'          // Search mode (future)
  | 'command'         // Command palette (future)

// Base frame properties shared by all frame types
export interface BaseFrame {
  id: string
  type: FrameType
  groupId: string              // Which group this frame operates in
  selection: SelectionState    // Selection state for this frame
  viewState: ViewState         // Camera position, zoom, etc.
  parentFrameId?: string       // Parent frame in the stack
  timestamp: number
  
  // Optional metadata
  metadata?: Record<string, any>
  
  // Lifecycle callbacks
  onEnter?: () => void
  onExit?: () => void
  onEscape?: () => boolean | void  // Return true to prevent default pop
}

// Navigation frame - when entering a subgroup
export interface NavigationFrame extends BaseFrame {
  type: 'navigation'
  previousGroupId: string  // To know where we came from
}

// Property editing frame
export interface PropertyFrame extends BaseFrame {
  type: 'property'
  focusedNodeId?: string   // Which node is being edited
  focusInput?: boolean     // Whether to focus the input field
}

// Valence connection frame
export interface ValenceFrame extends BaseFrame {
  type: 'valence'
  sourceSelection: {
    contactIds: string[]
    groupIds: string[]
    totalOutputCount: number
  }
}

// Gadget menu frame
export interface GadgetMenuFrame extends BaseFrame {
  type: 'gadgetMenu'
  selectedCategory?: string
}

// Tool frame - for custom tools
export interface ToolFrame extends BaseFrame {
  type: 'tool'
  toolId: string
  toolState?: any  // Tool-specific state
}

// Union type for all frame types
export type ContextFrame = 
  | NavigationFrame 
  | PropertyFrame 
  | ValenceFrame 
  | GadgetMenuFrame 
  | ToolFrame

// Selection state within a frame
export interface SelectionState {
  contactIds: Set<string>
  groupIds: Set<string>
  lastModified: number
}

// View state for the frame
export interface ViewState {
  zoom: number
  center: { x: number; y: number }
  // Additional view properties
  showGrid?: boolean
  showMinimap?: boolean
  showLabels?: boolean
}

// Stack operations result
export interface StackOperation {
  success: boolean
  frame?: ContextFrame
  error?: string
}

// Stack state for debugging/visualization
export interface StackState {
  frames: ContextFrame[]
  currentFrame: ContextFrame | null
  depth: number
  canPop: boolean
  canPush: boolean
}

// Frame factory function type
export type FrameFactory<T extends ContextFrame = ContextFrame> = (
  params: Omit<T, 'id' | 'timestamp'>
) => T

// Tool interface remains compatible
export interface Tool {
  id: string
  name: string
  icon?: string
  
  // Create a frame for this tool
  createFrame?(currentFrame: ContextFrame): ToolFrame
  
  // Lifecycle methods
  onActivate?(frame: ContextFrame): void
  onDeactivate?(): void
  
  // Interaction handlers
  handleKeyPress?(event: KeyboardEvent, frame: ContextFrame): boolean
  handleNodeClick?(nodeId: string, frame: ContextFrame): void
  handleCanvasClick?(position: { x: number; y: number }, frame: ContextFrame): void
  
  // Visual state
  getNodeHighlight?(nodeId: string, frame: ContextFrame): string | undefined
  getCursor?(): string
}
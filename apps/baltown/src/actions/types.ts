import type { JSX } from 'solid-js'

/**
 * Resource reference passed to actions during targeting
 */
export interface Resource {
  uri: string
  type: 'cell' | 'propagator' | 'handler'
  name: string
  data?: any
}

/**
 * Toast API for action feedback
 */
interface ToastAPI {
  success: (msg: string) => void
  error: (msg: string) => void
  info: (msg: string) => void
}

/**
 * Context provided to actions when started
 */
export interface ActionContext {
  /** Bassline client for API calls */
  bl: {
    get: (uri: string) => Promise<any>
    put: (uri: string, headers: any, body: any) => Promise<any>
  }
  /** Currently available cells */
  cells: Resource[]
  /** Currently available propagators */
  propagators: Resource[]
  /** Toast notifications */
  toast: ToastAPI
  /** Signal that action is complete and should execute */
  complete: () => void
  /** Signal that action was cancelled */
  cancel: () => void
  /** Trigger graph refresh */
  refresh: () => void
}

/**
 * Action definition - controls its own flow and rendering
 *
 * Actions are factory functions that return an Action object.
 * The factory closure holds the action's internal state.
 */
export interface Action {
  /** Unique action identifier */
  id: string
  /** Display name */
  name: string
  /** Description shown in sidebar */
  description?: string
  /** Icon component */
  icon: () => JSX.Element

  // Lifecycle hooks - action controls everything

  /** Called when action starts */
  onStart: (ctx: ActionContext) => void
  /** Called when action is cancelled (Escape) */
  onCancel: () => void
  /** Called when a graph node is clicked during action */
  onClick: (target: Resource, event: MouseEvent) => void
  /** Called for keyboard events during action */
  onKeyDown: (event: KeyboardEvent) => void

  // Rendering

  /** Render action's overlay UI (prompts, forms, highlights) */
  renderOverlay: () => JSX.Element | null

  // State

  /** Check if action has collected all required input and is ready to execute */
  isComplete: () => boolean
  /** Execute the action (called after isComplete returns true) */
  execute: () => Promise<void>
}

/**
 * Action factory function type
 */
type ActionFactory = () => Action

// ============================================
// Stack Types - Phase 2
// ============================================

/**
 * Status of a stacked action
 */
export type StackedActionStatus =
  | 'building' // Currently being configured (targets being selected)
  | 'pending' // Ready and waiting on stack
  | 'resolving' // Currently executing
  | 'resolved' // Successfully completed
  | 'cancelled' // Removed from stack

/**
 * Targets collected by an action
 */
interface ActionTargets {
  /** Graph resources (cells, propagators) */
  resources: Resource[]
  /** IDs of other stacked actions (for meta-actions) */
  stackItems: string[]
}

/**
 * A stacked action instance with its captured state
 */
export interface StackedAction {
  /** Unique instance ID */
  id: string
  /** The action definition */
  action: Action
  /** Status on the stack */
  status: StackedActionStatus
  /** Collected targets */
  targets: ActionTargets
  /** Summary for display (set by action after configuration) */
  summary?: string
}

/**
 * Extended context for stack-aware actions
 */
export interface StackActionContext extends ActionContext {
  /** Get current stack for meta-actions */
  getStack: () => StackedAction[]
  /** Target a stack item (for meta-actions) */
  targetStackItem: (id: string) => void
}

/**
 * Meta-action that can target other stack items
 */
export interface MetaAction extends Action {
  /** Flag indicating this action targets stack items */
  isMeta: true
  /** Called when a stack item is clicked during targeting */
  onStackItemClick: (item: StackedAction) => void
}

import { createSignal, createMemo } from 'solid-js'
import type {
  Action,
  ActionContext,
  StackedAction,
  StackedActionStatus,
  Resource,
  MetaAction,
} from '../actions/types'

/**
 * Generate unique ID for stacked actions
 */
function generateId(): string {
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Check if an action is a meta-action
 */
function isMetaAction(action: Action): action is MetaAction {
  return 'isMeta' in action && (action as MetaAction).isMeta === true
}

/**
 * Action Stack Store
 *
 * Manages the MTG-style action stack where:
 * - Actions queue up and resolve LIFO
 * - Meta-actions can target other pending actions
 * - Auto-resolve mode for instant execution
 */
function createStackStore() {
  // Stack state
  const [stack, setStack] = createSignal<StackedAction[]>([])
  const [autoResolve, setAutoResolve] = createSignal(false)
  const [isResolving, setIsResolving] = createSignal(false)

  // Currently building action (being configured)
  const [buildingAction, setBuildingAction] = createSignal<StackedAction | null>(null)

  // Derived state
  const pendingItems = createMemo(() => stack().filter((item) => item.status === 'pending'))

  const topItem = createMemo(() => {
    const pending = pendingItems()
    return pending.length > 0 ? pending[pending.length - 1] : null
  })

  const hasItems = createMemo(() => pendingItems().length > 0)

  const isBuilding = createMemo(() => buildingAction() !== null)

  /**
   * Start a new action - enters building mode
   */
  function startAction(action: Action, context: ActionContext): StackedAction {
    // Create stacked action instance
    const stackedAction: StackedAction = {
      id: generateId(),
      action,
      status: 'building',
      targets: {
        resources: [],
        stackItems: [],
      },
    }

    // Set as building
    setBuildingAction(stackedAction)

    // Create extended context that captures to this stacked action
    const stackContext: ActionContext = {
      ...context,
      complete: () => completeBuilding(),
      cancel: () => cancelBuilding(),
    }

    // Start the action
    action.onStart(stackContext)

    return stackedAction
  }

  /**
   * Complete building - move action to pending on stack
   */
  async function completeBuilding() {
    const building = buildingAction()
    if (!building) return

    const action = building.action

    // Check if action is complete
    if (!action.isComplete()) {
      console.warn('Action not complete, cannot add to stack')
      return
    }

    // If auto-resolve is on, execute immediately
    if (autoResolve()) {
      setBuildingAction(null)
      building.status = 'resolving'
      setIsResolving(true)

      try {
        await action.execute()
        building.status = 'resolved'
      } catch (err) {
        console.error('Action execution failed:', err)
        building.status = 'cancelled'
      } finally {
        setIsResolving(false)
      }
      return
    }

    // Otherwise add to stack as pending
    building.status = 'pending'
    // Generate summary from action state if available
    building.summary = action.name

    setStack((prev) => [...prev, building])
    setBuildingAction(null)
  }

  /**
   * Cancel building - discard the action being configured
   */
  function cancelBuilding() {
    const building = buildingAction()
    if (!building) return

    building.action.onCancel()
    setBuildingAction(null)
  }

  /**
   * Resolve the next (top) action on the stack
   */
  async function resolveNext(): Promise<boolean> {
    const top = topItem()
    if (!top || isResolving()) return false

    setIsResolving(true)

    // Update status
    setStack((prev) =>
      prev.map((item) =>
        item.id === top.id ? { ...item, status: 'resolving' as StackedActionStatus } : item
      )
    )

    try {
      await top.action.execute()

      // Mark as resolved and remove from stack
      setStack((prev) => prev.filter((item) => item.id !== top.id))
      return true
    } catch (err) {
      console.error('Action resolution failed:', err)

      // Mark as cancelled
      setStack((prev) =>
        prev.map((item) =>
          item.id === top.id ? { ...item, status: 'cancelled' as StackedActionStatus } : item
        )
      )
      return false
    } finally {
      setIsResolving(false)
    }
  }

  /**
   * Resolve all pending actions in LIFO order
   */
  async function resolveAll(): Promise<void> {
    while (pendingItems().length > 0 && !isResolving()) {
      const success = await resolveNext()
      if (!success) break
    }
  }

  /**
   * Cancel a specific action on the stack (used by Cancel meta-action)
   */
  function cancelAction(id: string): boolean {
    const item = stack().find((i) => i.id === id)
    if (!item || item.status !== 'pending') return false

    item.action.onCancel()
    setStack((prev) => prev.filter((i) => i.id !== id))
    return true
  }

  /**
   * Duplicate an action on the stack (used by Duplicate meta-action)
   */
  function duplicateAction(id: string): StackedAction | null {
    const item = stack().find((i) => i.id === id)
    if (!item || item.status !== 'pending') return null

    const duplicate: StackedAction = {
      id: generateId(),
      action: item.action, // Same action instance - might need to clone
      status: 'pending',
      targets: { ...item.targets },
      summary: item.summary ? `${item.summary} (copy)` : undefined,
    }

    setStack((prev) => [...prev, duplicate])
    return duplicate
  }

  /**
   * Handle click during building mode
   */
  function handleClick(resource: Resource, event: MouseEvent) {
    const building = buildingAction()
    if (!building) return

    building.action.onClick(resource, event)
  }

  /**
   * Handle stack item click (for meta-actions)
   */
  function handleStackItemClick(item: StackedAction) {
    const building = buildingAction()
    if (!building) return

    if (isMetaAction(building.action)) {
      building.action.onStackItemClick(item)
    }
  }

  /**
   * Handle keyboard events during building mode
   */
  function handleKeyDown(event: KeyboardEvent) {
    const building = buildingAction()
    if (!building) return

    building.action.onKeyDown(event)
  }

  /**
   * Get overlay from building action
   */
  function renderOverlay() {
    const building = buildingAction()
    if (!building) return null

    return building.action.renderOverlay()
  }

  /**
   * Clear entire stack
   */
  function clearStack() {
    stack().forEach((item) => {
      if (item.status === 'pending') {
        item.action.onCancel()
      }
    })
    setStack([])
  }

  return {
    // State
    stack,
    pendingItems,
    topItem,
    hasItems,
    buildingAction,
    isBuilding,
    autoResolve,
    setAutoResolve,
    isResolving,

    // Building actions
    startAction,
    completeBuilding,
    cancelBuilding,
    handleClick,
    handleStackItemClick,
    handleKeyDown,
    renderOverlay,

    // Stack operations
    resolveNext,
    resolveAll,
    cancelAction,
    duplicateAction,
    clearStack,
  }
}

// Export singleton instance
export const stackStore = createStackStore()

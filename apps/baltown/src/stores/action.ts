import { createRoot, createSignal } from 'solid-js'
import type { Action, ActionContext, Resource } from '../actions/types'

/**
 * Global action store - manages active action state
 *
 * Only one action can be active at a time. When active,
 * clicks and keyboard events are routed to the action.
 */
function createActionStore() {
  const [activeAction, setActiveAction] = createSignal<Action | null>(null)
  const [context, setContext] = createSignal<ActionContext | null>(null)

  // Derived state
  const isActive = () => activeAction() !== null

  /**
   * Start a new action
   */
  function startAction(action: Action, ctx: ActionContext) {
    // Cancel any existing action
    if (activeAction()) {
      cancelAction()
    }

    // Create context with complete/cancel callbacks
    const actionContext: ActionContext = {
      ...ctx,
      complete: () => {
        completeAction()
      },
      cancel: () => {
        cancelAction()
      },
    }

    setActiveAction(action)
    setContext(actionContext)
    action.onStart(actionContext)
  }

  /**
   * Cancel the current action
   */
  function cancelAction() {
    const action = activeAction()
    if (action) {
      action.onCancel()
      setActiveAction(null)
      setContext(null)
    }
  }

  /**
   * Complete and execute the current action
   */
  async function completeAction() {
    const action = activeAction()
    const ctx = context()

    if (action && ctx) {
      if (action.isComplete()) {
        try {
          await action.execute()
          ctx.toast.success(`${action.name} completed`)
          ctx.refresh()
        } catch (err) {
          ctx.toast.error(
            `${action.name} failed: ${err instanceof Error ? err.message : 'Unknown error'}`
          )
        }
      }
      setActiveAction(null)
      setContext(null)
    }
  }

  /**
   * Route click event to active action
   */
  function handleClick(target: Resource, event: MouseEvent) {
    const action = activeAction()
    if (action) {
      action.onClick(target, event)
    }
  }

  /**
   * Route keyboard event to active action
   */
  function handleKeyDown(event: KeyboardEvent) {
    const action = activeAction()
    if (action) {
      // Escape always cancels
      if (event.key === 'Escape') {
        cancelAction()
        return
      }
      action.onKeyDown(event)
    }
  }

  /**
   * Get overlay JSX from active action
   */
  function renderOverlay() {
    const action = activeAction()
    return action ? action.renderOverlay() : null
  }

  return {
    // State
    activeAction,
    isActive,

    // Actions
    startAction,
    cancelAction,
    completeAction,

    // Event routing
    handleClick,
    handleKeyDown,

    // Rendering
    renderOverlay,
  }
}

export const actionStore = createRoot(createActionStore)

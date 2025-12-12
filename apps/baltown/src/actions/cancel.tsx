import { createSignal, For, Show } from 'solid-js'
import type { MetaAction, ActionContext, StackedAction, StackActionContext } from './types'
import { stackStore } from '../stores/stack'

/**
 * Cancel Action (Meta-Action)
 *
 * Targets another pending action on the stack.
 * When resolved, removes the target from the stack.
 */
export function cancelAction(): MetaAction {
  let ctx: StackActionContext | null = null
  const [targetId, setTargetId] = createSignal<string | null>(null)

  // Get available targets (pending actions, not this one)
  const availableTargets = () => {
    const building = stackStore.buildingAction()
    return stackStore.pendingItems().filter((item) => item.id !== building?.id)
  }

  const targetItem = () => {
    const id = targetId()
    if (!id) return null
    return stackStore.stack().find((item) => item.id === id)
  }

  return {
    id: 'cancel-action',
    name: 'Cancel',
    description: 'Cancel a pending action',
    isMeta: true,

    icon: () => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),

    onStart(context: ActionContext) {
      ctx = context as StackActionContext
      setTargetId(null)
    },

    onCancel() {
      ctx = null
      setTargetId(null)
    },

    onClick() {
      // This meta-action doesn't use graph clicks
    },

    onStackItemClick(item: StackedAction) {
      // Toggle selection
      if (targetId() === item.id) {
        setTargetId(null)
      } else {
        setTargetId(item.id)
        ctx?.complete()
      }
    },

    onKeyDown(event) {
      if (event.key === 'Escape') {
        ctx?.cancel()
      }
    },

    renderOverlay() {
      const targets = availableTargets()

      return (
        <div class="cancel-overlay">
          <div class="meta-prompt">
            <div class="prompt-header">
              <span class="prompt-icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              </span>
              <span class="prompt-title">Cancel Action</span>
            </div>

            <Show
              when={targets.length > 0}
              fallback={<div class="no-targets">No pending actions to cancel</div>}
            >
              <div class="prompt-instruction">Click an action in the stack to cancel it</div>

              <div class="target-list">
                <For each={targets}>
                  {(item) => (
                    <button
                      class={`target-item ${targetId() === item.id ? 'selected' : ''}`}
                      onClick={() => {
                        setTargetId(item.id)
                        ctx?.complete()
                      }}
                    >
                      <span class="target-icon">{item.action.icon()}</span>
                      <span class="target-name">{item.action.name}</span>
                      <Show when={item.summary}>
                        <span class="target-summary">{item.summary}</span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </Show>

            <div class="prompt-hint">Press Escape to cancel</div>
          </div>

          <style>{`
            .cancel-overlay {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              align-items: flex-start;
              justify-content: center;
              padding-top: 60px;
              pointer-events: none;
            }

            .meta-prompt {
              background: #161b22;
              border: 2px solid #f85149;
              border-radius: 12px;
              padding: 20px;
              min-width: 300px;
              max-width: 400px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
              pointer-events: auto;
              position: relative;
              z-index: 10;
            }

            .prompt-header {
              display: flex;
              align-items: center;
              gap: 10px;
              margin-bottom: 16px;
            }

            .prompt-icon {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 32px;
              height: 32px;
              background: rgba(248, 81, 73, 0.1);
              border-radius: 8px;
              color: #f85149;
            }

            .prompt-title {
              font-size: 16px;
              font-weight: 600;
              color: #c9d1d9;
            }

            .prompt-instruction {
              font-size: 13px;
              color: #8b949e;
              margin-bottom: 12px;
            }

            .no-targets {
              padding: 20px;
              text-align: center;
              color: #6e7681;
              font-size: 13px;
            }

            .target-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }

            .target-item {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 10px 12px;
              background: #21262d;
              border: 1px solid #30363d;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.15s ease;
              text-align: left;
            }

            .target-item:hover {
              background: #30363d;
              border-color: #f85149;
            }

            .target-item.selected {
              background: rgba(248, 81, 73, 0.1);
              border-color: #f85149;
            }

            .target-icon {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              color: #8b949e;
            }

            .target-icon svg {
              width: 16px;
              height: 16px;
            }

            .target-name {
              flex: 1;
              font-size: 13px;
              font-weight: 500;
              color: #c9d1d9;
            }

            .target-summary {
              font-size: 11px;
              color: #6e7681;
            }

            .prompt-hint {
              margin-top: 16px;
              padding-top: 12px;
              border-top: 1px solid #30363d;
              font-size: 11px;
              color: #6e7681;
              text-align: center;
            }
          `}</style>
        </div>
      )
    },

    isComplete() {
      return targetId() !== null
    },

    async execute() {
      const id = targetId()
      if (!id) return

      const success = stackStore.cancelAction(id)
      if (success) {
        ctx?.toast.info(`Cancelled action`)
      }
    },
  }
}

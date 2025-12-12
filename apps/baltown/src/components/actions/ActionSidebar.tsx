import { For } from 'solid-js'
import type { Action } from '../../actions/types'
import { createCellAction } from '../../actions/createCell'
import { createPropagatorAction } from '../../actions/createPropagator'
import { cancelAction } from '../../actions/cancel'
import { duplicateAction } from '../../actions/duplicate'

interface ActionSidebarProps {
  onStartAction: (action: Action) => void
}

// Available action factories by category
const CREATE_ACTIONS = [createCellAction, createPropagatorAction]

const META_ACTIONS = [cancelAction, duplicateAction]

/**
 * ActionSidebar - Shows available actions to cast
 *
 * Organized into:
 * - Create actions (Cell, Propagator)
 * - Meta actions (Cancel, Duplicate)
 */
export default function ActionSidebar(props: ActionSidebarProps) {
  function handleActionClick(factory: () => Action) {
    props.onStartAction(factory())
  }

  return (
    <aside class="action-sidebar">
      <div class="sidebar-header">
        <h2>Actions</h2>
      </div>

      <div class="sidebar-content">
        {/* Create section */}
        <div class="action-section">
          <div class="section-label">Create</div>
          <For each={CREATE_ACTIONS}>
            {(factory) => {
              const action = factory()
              return (
                <button class="action-btn" onClick={() => handleActionClick(factory)}>
                  <span class="action-icon">{action.icon()}</span>
                  <span class="action-info">
                    <span class="action-name">{action.name}</span>
                    {action.description && <span class="action-desc">{action.description}</span>}
                  </span>
                </button>
              )
            }}
          </For>
        </div>

        {/* Meta section */}
        <div class="action-section">
          <div class="section-label">Stack</div>
          <For each={META_ACTIONS}>
            {(factory) => {
              const action = factory()
              return (
                <button class="action-btn meta" onClick={() => handleActionClick(factory)}>
                  <span class="action-icon meta">{action.icon()}</span>
                  <span class="action-info">
                    <span class="action-name">{action.name}</span>
                    {action.description && <span class="action-desc">{action.description}</span>}
                  </span>
                </button>
              )
            }}
          </For>
        </div>
      </div>

      <style>{`
        .action-sidebar {
          width: 240px;
          min-width: 240px;
          background: #161b22;
          border-right: 1px solid #30363d;
          display: flex;
          flex-direction: column;
        }

        .sidebar-header {
          padding: 16px;
          border-bottom: 1px solid #30363d;
        }

        .sidebar-header h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sidebar-content {
          flex: 1;
          padding: 12px;
          overflow-y: auto;
        }

        .action-section {
          margin-bottom: 20px;
        }

        .section-label {
          font-size: 10px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
          padding-left: 4px;
        }

        .action-btn {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          width: 100%;
          padding: 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          margin-bottom: 8px;
          transition: all 0.15s ease;
        }

        .action-btn:hover {
          border-color: #58a6ff;
          background: #161b22;
        }

        .action-btn.meta:hover {
          border-color: #a371f7;
        }

        .action-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: #21262d;
          border-radius: 6px;
          color: #58a6ff;
          flex-shrink: 0;
        }

        .action-icon.meta {
          color: #a371f7;
        }

        .action-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .action-name {
          font-size: 13px;
          font-weight: 500;
          color: #c9d1d9;
        }

        .action-desc {
          font-size: 11px;
          color: #8b949e;
        }
      `}</style>
    </aside>
  )
}

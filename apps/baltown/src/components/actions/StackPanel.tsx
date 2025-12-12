import { For, Show } from 'solid-js'
import type { StackedAction } from '../../actions/types'
import StackCard from './StackCard'

interface StackPanelProps {
  items: StackedAction[]
  buildingItem: StackedAction | null
  autoResolve: boolean
  isResolving: boolean
  onToggleAutoResolve: () => void
  onResolveNext: () => void
  onResolveAll: () => void
  onClearStack: () => void
  onItemClick?: (item: StackedAction) => void
  onItemHover?: (item: StackedAction | null) => void
}

/**
 * StackPanel - The action stack visualization
 *
 * Shows all pending actions in LIFO order with resolve controls.
 * The newest action (top of stack) is shown at the bottom visually
 * so it "stacks up" like cards.
 */
export default function StackPanel(props: StackPanelProps) {
  // Reverse for display (newest at bottom = top of stack visually)
  const displayItems = () => [...props.items].reverse()

  const pendingCount = () => props.items.filter((i) => i.status === 'pending').length

  return (
    <div class="stack-panel">
      <div class="stack-header">
        <h3>The Stack</h3>
        <span class="stack-count">{pendingCount()} pending</span>
      </div>

      {/* Building action (if any) */}
      <Show when={props.buildingItem}>
        {(item) => (
          <div class="building-section">
            <div class="section-label">Building</div>
            <StackCard item={item()} isTop={false} />
          </div>
        )}
      </Show>

      {/* Stack visualization */}
      <div class="stack-items">
        <Show
          when={props.items.length > 0}
          fallback={
            <div class="stack-empty">
              <div class="empty-icon">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <div class="empty-text">Stack is empty</div>
              <div class="empty-hint">
                {props.autoResolve ? 'Actions execute immediately' : 'Actions will queue here'}
              </div>
            </div>
          }
        >
          <For each={displayItems()}>
            {(item, index) => (
              <StackCard
                item={item}
                isTop={index() === 0}
                onClick={() => props.onItemClick?.(item)}
                onHover={(hovering) => props.onItemHover?.(hovering ? item : null)}
              />
            )}
          </For>
        </Show>
      </div>

      {/* Controls */}
      <div class="stack-controls">
        {/* Auto-resolve toggle */}
        <label class="auto-resolve-toggle">
          <input type="checkbox" checked={props.autoResolve} onChange={props.onToggleAutoResolve} />
          <span class="toggle-label">Auto-resolve</span>
          <span class="toggle-hint">
            {props.autoResolve ? 'Actions execute immediately' : 'Actions queue on stack'}
          </span>
        </label>

        {/* Resolve buttons */}
        <Show when={!props.autoResolve}>
          <div class="resolve-buttons">
            <button
              class="resolve-next-btn"
              disabled={pendingCount() === 0 || props.isResolving}
              onClick={props.onResolveNext}
            >
              <span class="btn-text">Resolve Next</span>
              <span class="btn-shortcut">Space</span>
            </button>

            <button
              class="resolve-all-btn"
              disabled={pendingCount() === 0 || props.isResolving}
              onClick={props.onResolveAll}
            >
              Resolve All
            </button>

            <button
              class="clear-btn"
              disabled={pendingCount() === 0 || props.isResolving}
              onClick={props.onClearStack}
            >
              Clear
            </button>
          </div>
        </Show>
      </div>

      <style>{`
        .stack-panel {
          width: 280px;
          background: #0d1117;
          border-left: 1px solid #30363d;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .stack-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px;
          border-bottom: 1px solid #30363d;
        }

        .stack-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .stack-count {
          font-size: 12px;
          color: #8b949e;
          background: #21262d;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .building-section {
          padding: 12px;
          border-bottom: 1px solid #30363d;
          background: rgba(240, 136, 62, 0.05);
        }

        .section-label {
          font-size: 10px;
          font-weight: 600;
          color: #f0883e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .stack-items {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stack-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6e7681;
          text-align: center;
        }

        .empty-icon {
          opacity: 0.3;
          margin-bottom: 12px;
        }

        .empty-text {
          font-size: 13px;
          color: #8b949e;
          margin-bottom: 4px;
        }

        .empty-hint {
          font-size: 11px;
          color: #6e7681;
        }

        .stack-controls {
          padding: 12px;
          border-top: 1px solid #30363d;
          background: #161b22;
        }

        .auto-resolve-toggle {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          margin-bottom: 12px;
        }

        .auto-resolve-toggle input {
          width: 16px;
          height: 16px;
          accent-color: #58a6ff;
        }

        .toggle-label {
          font-size: 13px;
          color: #c9d1d9;
          font-weight: 500;
        }

        .toggle-hint {
          width: 100%;
          font-size: 11px;
          color: #6e7681;
          padding-left: 24px;
        }

        .resolve-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .resolve-next-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 10px 12px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .resolve-next-btn:hover:not(:disabled) {
          background: #2ea043;
        }

        .resolve-next-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-shortcut {
          font-size: 11px;
          opacity: 0.7;
          background: rgba(0,0,0,0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .resolve-all-btn,
        .clear-btn {
          width: 100%;
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .resolve-all-btn:hover:not(:disabled) {
          background: #30363d;
          border-color: #58a6ff;
        }

        .clear-btn:hover:not(:disabled) {
          background: #30363d;
          border-color: #f85149;
          color: #f85149;
        }

        .resolve-all-btn:disabled,
        .clear-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

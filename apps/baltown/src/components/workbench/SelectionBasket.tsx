import { For, Show } from 'solid-js'
import { selectionStore } from '../../stores/selection'

/**
 * SelectionBasket - Shows currently selected resources
 */
export default function SelectionBasket() {
  const { selected, clearSelection, toggleSelection } = selectionStore

  return (
    <div class="selection-basket">
      <div class="selection-list">
        <For each={selected()}>
          {(item) => (
            <div class="selection-item">
              <span class={`item-type ${item.type}`}>{item.type[0].toUpperCase()}</span>
              <span class="item-name">{item.name}</span>
              <button
                class="remove-btn"
                onClick={() => toggleSelection(item)}
                title="Remove from selection"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
        </For>
      </div>

      <Show when={selected().length > 0}>
        <button class="clear-btn" onClick={clearSelection}>
          Clear Selection
        </button>
      </Show>

      <style>{`
        .selection-basket {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .selection-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 200px;
          overflow-y: auto;
        }

        .selection-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          background: #0d1117;
          border-radius: 6px;
        }

        .item-type {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
        }

        .item-type.cell {
          background: #388bfd22;
          color: #58a6ff;
        }

        .item-type.propagator {
          background: #f0883e22;
          color: #f0883e;
        }

        .item-type.handler {
          background: #a371f722;
          color: #a371f7;
        }

        .item-type.recipe {
          background: #3fb95022;
          color: #3fb950;
        }

        .item-name {
          flex: 1;
          font-size: 12px;
          color: #c9d1d9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .remove-btn {
          padding: 2px;
          background: none;
          border: none;
          color: #6e7681;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-btn:hover {
          color: #f85149;
        }

        .clear-btn {
          padding: 8px;
          background: none;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 12px;
          cursor: pointer;
        }

        .clear-btn:hover {
          background: #21262d;
          color: #c9d1d9;
        }
      `}</style>
    </div>
  )
}

import { Show, For, createSignal } from 'solid-js'
import { selectionStore } from '../../stores/selection'
import NewResourceTools from './NewResourceTools'
import PromotionActions from './PromotionActions'
import SelectionBasket from './SelectionBasket'

interface ToolboxPanelProps {
  onResourceCreated: () => void
  cells: Array<{ uri: string; lattice?: string; value?: any }>
}

/**
 * ToolboxPanel - Left sidebar showing contextual tools
 *
 * Shows different content based on what's selected:
 * - Nothing: New resource buttons
 * - Something: Promotion actions + Selection basket
 */
export default function ToolboxPanel(props: ToolboxPanelProps) {
  const { selected, hasSelection, isMultiSelect, selectionType } = selectionStore

  return (
    <aside class="toolbox-panel">
      {/* Header */}
      <div class="toolbox-header">
        <h2>Toolbox</h2>
      </div>

      <div class="toolbox-content">
        {/* New Resource Tools (always shown) */}
        <div class="toolbox-section">
          <h3>Create</h3>
          <NewResourceTools onResourceCreated={props.onResourceCreated} cells={props.cells} />
        </div>

        {/* Selection-based content */}
        <Show when={hasSelection()}>
          {/* Selection Basket */}
          <div class="toolbox-section">
            <h3>Selected ({selected().length})</h3>
            <SelectionBasket />
          </div>

          {/* Promotion Actions */}
          <div class="toolbox-section">
            <h3>Promote</h3>
            <PromotionActions onResourceCreated={props.onResourceCreated} cells={props.cells} />
          </div>
        </Show>

        {/* Help text when nothing selected */}
        <Show when={!hasSelection()}>
          <div class="toolbox-help">
            <p>Click on a resource in the graph to select it.</p>
            <p>Shift+click to multi-select.</p>
            <p>Selected resources can be promoted to recipes.</p>
          </div>
        </Show>
      </div>

      <style>{`
        .toolbox-panel {
          width: 240px;
          min-width: 240px;
          background: #161b22;
          border-right: 1px solid #30363d;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .toolbox-header {
          padding: 16px;
          border-bottom: 1px solid #30363d;
        }

        .toolbox-header h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .toolbox-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .toolbox-section {
          margin-bottom: 24px;
        }

        .toolbox-section h3 {
          margin: 0 0 12px 0;
          font-size: 11px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .toolbox-help {
          padding: 16px;
          background: #0d1117;
          border-radius: 8px;
          border: 1px solid #30363d;
        }

        .toolbox-help p {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #8b949e;
          line-height: 1.5;
        }

        .toolbox-help p:last-child {
          margin-bottom: 0;
        }
      `}</style>
    </aside>
  )
}

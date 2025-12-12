import { For, Show } from 'solid-js'
import { useLiveResource } from '@bassline/solid'
import { LatticeVisualizer } from '../cells'

interface InputPanelProps {
  cellUris: string[]
  title?: string
  compact?: boolean
}

/**
 * InputPanel - Lattice-aware input controls for a set of cells
 */
export default function InputPanel(props: InputPanelProps) {
  return (
    <div class={`input-panel ${props.compact ? 'compact' : ''}`}>
      <Show when={props.title}>
        <div class="panel-header">
          <h3 class="panel-title">{props.title}</h3>
          <span class="cell-count">{props.cellUris.length} cells</span>
        </div>
      </Show>

      <div class="input-list">
        <For each={props.cellUris}>{(uri) => <InputCell uri={uri} compact={props.compact} />}</For>
      </div>

      <Show when={props.cellUris.length === 0}>
        <div class="empty-state">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M9 9h6M9 13h6M9 17h4" />
          </svg>
          <p>No input cells</p>
        </div>
      </Show>

      <style>{`
        .input-panel {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .input-panel.compact {
          border-radius: 6px;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #21262d;
          border-bottom: 1px solid #30363d;
        }

        .compact .panel-header {
          padding: 8px 12px;
        }

        .panel-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .cell-count {
          font-size: 11px;
          color: #6e7681;
        }

        .input-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
          background: #30363d;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 32px;
          color: #6e7681;
        }

        .empty-state p {
          margin: 0;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}

interface InputCellProps {
  uri: string
  compact?: boolean
}

function InputCell(props: InputCellProps) {
  const { data, loading, isLive } = useLiveResource(() => props.uri)

  // Extract cell name
  const cellName = () => props.uri.split('/').pop() || 'cell'

  // Extract lattice type
  const lattice = () => {
    const d = data()
    if (!d) return 'lww'
    return d.headers?.lattice ?? d.body?.lattice ?? 'lww'
  }

  return (
    <div class={`input-cell ${props.compact ? 'compact' : ''}`}>
      <div class="cell-label">
        <span class="cell-name">{cellName()}</span>
        <span class="cell-lattice">{lattice()}</span>
        <Show when={isLive()}>
          <span class="live-dot" />
        </Show>
      </div>

      <div class="cell-control">
        <Show when={loading()}>
          <div class="loading-placeholder" />
        </Show>
        <Show when={!loading()}>
          <LatticeVisualizer uri={props.uri} compact={props.compact} showControls={true} />
        </Show>
      </div>

      <style>{`
        .input-cell {
          background: #0d1117;
          padding: 12px 16px;
        }

        .input-cell.compact {
          padding: 8px 12px;
        }

        .cell-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .cell-name {
          font-weight: 500;
          font-size: 12px;
          color: #c9d1d9;
        }

        .cell-lattice {
          font-size: 10px;
          padding: 2px 6px;
          background: #21262d;
          color: #8b949e;
          border-radius: 8px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: #3fb950;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .cell-control {
          min-height: 40px;
        }

        .loading-placeholder {
          height: 40px;
          background: linear-gradient(90deg, #21262d 0%, #30363d 50%, #21262d 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  )
}

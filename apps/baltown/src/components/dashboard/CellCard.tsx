import { createSignal, Show, createMemo, createEffect, onCleanup } from 'solid-js'
import { useLiveResource } from '@bassline/solid'
import { LatticeVisualizer } from '../cells'

interface CellCardProps {
  uri: string
  label?: string
  compact?: boolean
  showControls?: boolean
}

/**
 * CellCard - Individual cell display with live value and metadata
 */
export default function CellCard(props: CellCardProps) {
  const { data, loading, error, isLive } = useLiveResource(() => props.uri)
  const [history, setHistory] = createSignal<{ value: any; timestamp: number }[]>([])

  // Track value history
  createEffect(() => {
    const val = data()
    if (val !== undefined) {
      setHistory(prev => {
        const newEntry = { value: val?.body ?? val, timestamp: Date.now() }
        return [...prev.slice(-19), newEntry]
      })
    }
  })

  // Extract cell info
  const cellInfo = createMemo(() => {
    const d = data()
    if (!d) return null

    const body = d.body ?? d
    const headers = d.headers ?? {}

    return {
      lattice: headers.lattice ?? body?.lattice ?? 'lww',
      value: body?.value ?? body,
      name: props.uri.split('/').pop() || 'cell'
    }
  })

  // Calculate trend
  const trend = createMemo(() => {
    const h = history()
    if (h.length < 2) return null

    const recent = h.slice(-5)
    const first = typeof recent[0]?.value === 'number' ? recent[0].value : null
    const last = typeof recent[recent.length - 1]?.value === 'number' ? recent[recent.length - 1].value : null

    if (first === null || last === null) return null
    if (last > first) return 'up'
    if (last < first) return 'down'
    return 'stable'
  })

  return (
    <div class={`cell-card ${props.compact ? 'compact' : ''}`}>
      <div class="cell-header">
        <div class="cell-info">
          <span class="cell-name">{cellInfo()?.name ?? props.label}</span>
          <Show when={cellInfo()?.lattice}>
            <span class="cell-lattice">{cellInfo()!.lattice}</span>
          </Show>
        </div>

        <div class="cell-status">
          <Show when={isLive()}>
            <span class="live-indicator" title="Live updates">
              <span class="live-dot" />
              LIVE
            </span>
          </Show>

          <Show when={trend()}>
            <span class={`trend-indicator ${trend()}`}>
              {trend() === 'up' && '↑'}
              {trend() === 'down' && '↓'}
              {trend() === 'stable' && '→'}
            </span>
          </Show>
        </div>
      </div>

      <div class="cell-content">
        <Show when={loading()}>
          <div class="loading-shimmer" />
        </Show>

        <Show when={error()}>
          <div class="cell-error">
            Error: {error()?.message || 'Failed to load'}
          </div>
        </Show>

        <Show when={!loading() && !error() && data()}>
          <LatticeVisualizer
            uri={props.uri}
            compact={props.compact}
            showControls={props.showControls}
          />
        </Show>
      </div>

      <Show when={!props.compact}>
        <div class="cell-footer">
          <span class="cell-uri" title={props.uri}>
            {props.uri.length > 40 ? '...' + props.uri.slice(-40) : props.uri}
          </span>
          <span class="update-count">{history().length} updates</span>
        </div>
      </Show>

      <style>{`
        .cell-card {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
          transition: border-color 0.15s ease;
        }

        .cell-card:hover {
          border-color: #484f58;
        }

        .cell-card.compact {
          border-radius: 6px;
        }

        .cell-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #21262d;
          border-bottom: 1px solid #30363d;
        }

        .compact .cell-header {
          padding: 8px 12px;
        }

        .cell-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cell-name {
          font-weight: 600;
          color: #c9d1d9;
          font-size: 14px;
        }

        .compact .cell-name {
          font-size: 12px;
        }

        .cell-lattice {
          font-size: 10px;
          padding: 2px 6px;
          background: #388bfd22;
          color: #58a6ff;
          border-radius: 10px;
          font-weight: 500;
        }

        .cell-status {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #3fb950;
          font-weight: 600;
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

        .trend-indicator {
          font-size: 14px;
          font-weight: 600;
        }

        .trend-indicator.up { color: #3fb950; }
        .trend-indicator.down { color: #f85149; }
        .trend-indicator.stable { color: #8b949e; }

        .cell-content {
          padding: 16px;
          min-height: 60px;
        }

        .compact .cell-content {
          padding: 12px;
          min-height: 40px;
        }

        .loading-shimmer {
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

        .cell-error {
          padding: 12px;
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 6px;
          color: #f85149;
          font-size: 12px;
        }

        .cell-footer {
          display: flex;
          justify-content: space-between;
          padding: 8px 16px;
          border-top: 1px solid #30363d;
          font-size: 11px;
          color: #6e7681;
        }

        .cell-uri {
          font-family: monospace;
          max-width: 70%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .update-count {
          color: #8b949e;
        }
      `}</style>
    </div>
  )
}

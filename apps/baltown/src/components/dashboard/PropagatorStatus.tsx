import { createSignal, Show, For, createEffect } from 'solid-js'
import { useLiveResource } from '@bassline/solid'

interface PropagatorStatusProps {
  uri: string
  compact?: boolean
}

interface PropagatorInfo {
  name: string
  inputs: string[]
  output: string
  handler: string | any[]
  lastFired?: number
  fireCount?: number
  status?: 'idle' | 'firing' | 'error'
}

/**
 * PropagatorStatus - Display propagator health and execution status
 */
export default function PropagatorStatus(props: PropagatorStatusProps) {
  const { data, loading, error, isLive } = useLiveResource(() => props.uri)
  const [recentFires, setRecentFires] = createSignal<number[]>([])

  // Parse propagator data
  const propInfo = (): PropagatorInfo | null => {
    const d = data()
    if (!d) return null

    const body = d.body ?? d
    return {
      name: props.uri.split('/').pop() || 'propagator',
      inputs: body.inputs ?? [],
      output: body.output ?? '',
      handler: body.handler,
      lastFired: body.lastFired,
      fireCount: body.fireCount ?? 0,
      status: body.status ?? 'idle',
    }
  }

  // Track fires
  createEffect(() => {
    const info = propInfo()
    if (info?.lastFired) {
      setRecentFires((prev) => [...prev.slice(-9), info.lastFired!])
    }
  })

  // Format handler display
  const handlerDisplay = () => {
    const info = propInfo()
    if (!info) return ''
    const h = info.handler
    if (typeof h === 'string') return h
    if (Array.isArray(h)) return h[0] + (h.length > 1 ? '...' : '')
    return 'custom'
  }

  // Time since last fire
  const timeSince = () => {
    const info = propInfo()
    if (!info?.lastFired) return null

    const diff = Date.now() - info.lastFired
    if (diff < 1000) return 'just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
  }

  // Fire rate (fires per minute over last 10 fires)
  const fireRate = () => {
    const fires = recentFires()
    if (fires.length < 2) return null

    const oldest = fires[0]
    const newest = fires[fires.length - 1]
    const duration = (newest - oldest) / 60000 // in minutes

    if (duration < 0.01) return null
    return (fires.length / duration).toFixed(1)
  }

  return (
    <div
      class={`propagator-status ${props.compact ? 'compact' : ''} ${propInfo()?.status ?? 'idle'}`}
    >
      <Show when={loading()}>
        <div class="status-loading">
          <div class="loading-bar" />
        </div>
      </Show>

      <Show when={error()}>
        <div class="status-error">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          Error
        </div>
      </Show>

      <Show when={!loading() && !error() && propInfo()}>
        <div class="status-header">
          <div class="status-icon">
            <Show when={propInfo()!.status === 'firing'}>
              <div class="firing-pulse" />
            </Show>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M4 12h4l3-9 6 18 3-9h4" />
            </svg>
          </div>

          <div class="status-info">
            <span class="prop-name">{propInfo()!.name}</span>
            <span class="prop-handler">{handlerDisplay()}</span>
          </div>

          <div class="status-badge">
            <Show when={propInfo()!.status === 'idle'}>
              <span class="badge idle">Idle</span>
            </Show>
            <Show when={propInfo()!.status === 'firing'}>
              <span class="badge firing">Firing</span>
            </Show>
            <Show when={propInfo()!.status === 'error'}>
              <span class="badge error">Error</span>
            </Show>
            <Show when={!propInfo()!.status}>
              <span class="badge healthy">Healthy</span>
            </Show>
          </div>
        </div>

        <Show when={!props.compact}>
          <div class="status-details">
            <div class="detail-row">
              <span class="detail-label">Inputs:</span>
              <div class="input-list">
                <For each={propInfo()!.inputs}>
                  {(input) => <span class="input-uri">{input.split('/').pop()}</span>}
                </For>
              </div>
            </div>

            <div class="detail-row">
              <span class="detail-label">Output:</span>
              <span class="output-uri">{propInfo()!.output.split('/').pop()}</span>
            </div>

            <div class="stats-row">
              <div class="stat">
                <span class="stat-value">{propInfo()!.fireCount ?? 0}</span>
                <span class="stat-label">fires</span>
              </div>

              <Show when={timeSince()}>
                <div class="stat">
                  <span class="stat-value">{timeSince()}</span>
                  <span class="stat-label">last fire</span>
                </div>
              </Show>

              <Show when={fireRate()}>
                <div class="stat">
                  <span class="stat-value">{fireRate()}/min</span>
                  <span class="stat-label">rate</span>
                </div>
              </Show>
            </div>
          </div>
        </Show>

        <Show when={isLive()}>
          <div class="live-indicator">
            <span class="live-dot" />
          </div>
        </Show>
      </Show>

      <style>{`
        .propagator-status {
          position: relative;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .propagator-status.firing {
          border-color: #58a6ff;
        }

        .propagator-status.error {
          border-color: #f85149;
        }

        .propagator-status.compact {
          border-radius: 6px;
        }

        .status-loading {
          padding: 20px;
        }

        .loading-bar {
          height: 4px;
          background: linear-gradient(90deg, #21262d 0%, #58a6ff 50%, #21262d 100%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
          border-radius: 2px;
        }

        @keyframes loading {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        .status-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 16px;
          color: #f85149;
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #21262d;
        }

        .compact .status-header {
          padding: 8px 12px;
        }

        .status-icon {
          position: relative;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0d1117;
          border-radius: 8px;
          color: #8b949e;
        }

        .firing .status-icon {
          color: #58a6ff;
        }

        .firing-pulse {
          position: absolute;
          inset: -4px;
          border: 2px solid #58a6ff;
          border-radius: 12px;
          animation: pulse-ring 1s infinite;
        }

        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .status-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .prop-name {
          font-weight: 600;
          color: #c9d1d9;
          font-size: 13px;
        }

        .prop-handler {
          font-size: 11px;
          color: #8b949e;
          font-family: monospace;
        }

        .status-badge .badge {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 600;
        }

        .badge.idle { background: #21262d; color: #8b949e; }
        .badge.healthy { background: #23863633; color: #3fb950; }
        .badge.firing { background: #388bfd33; color: #58a6ff; }
        .badge.error { background: #f8514933; color: #f85149; }

        .status-details {
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .detail-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .detail-label {
          font-size: 11px;
          color: #6e7681;
          width: 50px;
          flex-shrink: 0;
        }

        .input-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .input-uri, .output-uri {
          font-family: monospace;
          font-size: 11px;
          padding: 2px 6px;
          background: #0d1117;
          border-radius: 4px;
          color: #79c0ff;
        }

        .output-uri {
          color: #3fb950;
        }

        .stats-row {
          display: flex;
          gap: 16px;
          padding-top: 8px;
          border-top: 1px solid #30363d;
          margin-top: 4px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .stat-label {
          font-size: 10px;
          color: #6e7681;
        }

        .live-indicator {
          position: absolute;
          top: 8px;
          right: 8px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #3fb950;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  )
}

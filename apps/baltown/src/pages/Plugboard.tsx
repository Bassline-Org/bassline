import { createMemo, Show } from 'solid-js'
import { useResource } from '@bassline/solid'
import { PlugboardGraph } from '../components/plugboard'

/**
 * Plugboard - Visualization of the plumber message routing system
 *
 * Shows:
 * - Sources (left): Things that dispatch messages to the plumber
 * - Rules (center): Pattern matchers that route messages to ports
 * - Ports (right): Named destinations where listeners subscribe
 */
export default function Plugboard() {
  // Fetch plumber state
  const { data, loading, error, refetch } = useResource(() => 'bl:///r/plumb/state')

  const plumberState = createMemo(() => {
    const d = data()
    if (!d) return { sources: [], rules: [], ports: [] }
    return {
      sources: d.sources ?? [],
      rules: d.rules ?? [],
      ports: d.ports ?? []
    }
  })

  const stats = createMemo(() => ({
    sources: plumberState().sources.length,
    rules: plumberState().rules.length,
    ports: plumberState().ports.length,
    activeListeners: plumberState().ports.reduce((sum: number, p: any) => sum + (p.listenerCount || 0), 0)
  }))

  return (
    <div class="plugboard-page">
      <div class="page-header">
        <div class="header-content">
          <h1>Plugboard</h1>
          <p class="subtitle">Message routing visualization</p>
        </div>
        <button class="refresh-btn" onClick={refetch} title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M23 4v6h-6M1 20v-6h6"/>
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-value">{stats().sources}</span>
          <span class="stat-label">Sources</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-value">{stats().rules}</span>
          <span class="stat-label">Rules</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-value">{stats().ports}</span>
          <span class="stat-label">Ports</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-value">{stats().activeListeners}</span>
          <span class="stat-label">Active Listeners</span>
        </div>
      </div>

      <Show when={loading()}>
        <div class="loading-state">
          <div class="loading-spinner" />
          <span>Loading plumber state...</span>
        </div>
      </Show>

      <Show when={error()}>
        <div class="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <h3>Failed to load plumber state</h3>
          <p>{error()?.message || 'Unknown error'}</p>
          <button class="btn btn-secondary" onClick={refetch}>Retry</button>
        </div>
      </Show>

      <Show when={!loading() && !error() && data()}>
        <div class="graph-section">
          <PlugboardGraph
            sources={plumberState().sources}
            rules={plumberState().rules}
            ports={plumberState().ports}
          />
        </div>

        {/* Info panels */}
        <div class="info-panels">
          <div class="info-panel">
            <h3>How it works</h3>
            <p>
              The plumber routes messages from <strong>sources</strong> (cells, timers, fetch)
              through <strong>rules</strong> (pattern matchers) to <strong>ports</strong> (named queues).
            </p>
            <p>
              Dashed green lines show potential source-to-rule connections.
              Solid orange lines show rule-to-port routing.
            </p>
          </div>

          <div class="info-panel">
            <h3>Message Flow</h3>
            <ol>
              <li>PUT operation triggers a tap</li>
              <li>Response becomes a message</li>
              <li>Rules match against message</li>
              <li>Matching messages dispatch to ports</li>
              <li>Port listeners receive the message</li>
            </ol>
          </div>
        </div>
      </Show>

      <style>{`
        .plugboard-page {
          padding: 24px;
          max-width: 1400px;
          margin: 0 auto;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .header-content h1 {
          margin: 0 0 4px 0;
          font-size: 28px;
          color: #c9d1d9;
        }

        .subtitle {
          margin: 0;
          font-size: 14px;
          color: #8b949e;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .refresh-btn:hover {
          background: #30363d;
          border-color: #484f58;
        }

        .stats-bar {
          display: flex;
          align-items: center;
          gap: 24px;
          padding: 16px 24px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-value {
          font-size: 24px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .stat-label {
          font-size: 12px;
          color: #8b949e;
        }

        .stat-divider {
          width: 1px;
          height: 40px;
          background: #30363d;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px;
          color: #8b949e;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #30363d;
          border-top-color: #58a6ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 60px;
          color: #f85149;
          text-align: center;
        }

        .error-state h3 {
          margin: 0;
          font-size: 18px;
        }

        .error-state p {
          margin: 0;
          color: #8b949e;
        }

        .graph-section {
          margin-bottom: 24px;
        }

        .info-panels {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 16px;
        }

        .info-panel {
          padding: 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
        }

        .info-panel h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #c9d1d9;
        }

        .info-panel p {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: #8b949e;
          line-height: 1.5;
        }

        .info-panel p:last-child {
          margin-bottom: 0;
        }

        .info-panel ol {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #8b949e;
          line-height: 1.8;
        }

        .info-panel strong {
          color: #c9d1d9;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-secondary {
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
        }

        .btn-secondary:hover {
          background: #30363d;
        }
      `}</style>
    </div>
  )
}

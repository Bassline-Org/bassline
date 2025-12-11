import { Show, For, createMemo } from 'solid-js'

interface MetricsSummaryProps {
  metrics: {
    cells?: number
    propagators?: number
    totalFires?: number
    uptime?: number
    lastActivity?: number
    errors?: number
    liveConnections?: number
  }
  compact?: boolean
}

/**
 * MetricsSummary - Instance statistics overview
 */
export default function MetricsSummary(props: MetricsSummaryProps) {
  // Format uptime
  const formattedUptime = createMemo(() => {
    const uptime = props.metrics.uptime
    if (!uptime) return null

    const hours = Math.floor(uptime / 3600000)
    const minutes = Math.floor((uptime % 3600000) / 60000)
    const seconds = Math.floor((uptime % 60000) / 1000)

    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
  })

  // Format last activity
  const lastActivityAgo = createMemo(() => {
    const last = props.metrics.lastActivity
    if (!last) return null

    const diff = Date.now() - last
    if (diff < 1000) return 'just now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    return `${Math.floor(diff / 3600000)}h ago`
  })

  const metrics = createMemo(() => [
    {
      label: 'Cells',
      value: props.metrics.cells ?? 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
      ),
      color: '#58a6ff'
    },
    {
      label: 'Propagators',
      value: props.metrics.propagators ?? 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12h4l3-9 6 18 3-9h4"/>
        </svg>
      ),
      color: '#f0883e'
    },
    {
      label: 'Fires',
      value: props.metrics.totalFires ?? 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      ),
      color: '#3fb950'
    },
    {
      label: 'Uptime',
      value: formattedUptime() ?? '—',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      ),
      color: '#a371f7',
      isText: true
    },
    {
      label: 'Last Activity',
      value: lastActivityAgo() ?? '—',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8v4l3 3"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      ),
      color: '#8b949e',
      isText: true
    },
    {
      label: 'Live',
      value: props.metrics.liveConnections ?? 0,
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
      color: '#3fb950'
    }
  ])

  return (
    <div class={`metrics-summary ${props.compact ? 'compact' : ''}`}>
      <div class="metrics-grid">
        <For each={metrics()}>
          {(metric) => (
            <div class="metric-card" style={{ '--metric-color': metric.color }}>
              <div class="metric-icon">
                {metric.icon}
              </div>
              <div class="metric-content">
                <span class="metric-value">{metric.value}</span>
                <span class="metric-label">{metric.label}</span>
              </div>
            </div>
          )}
        </For>
      </div>

      <Show when={props.metrics.errors && props.metrics.errors > 0}>
        <div class="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <span>{props.metrics.errors} error{props.metrics.errors > 1 ? 's' : ''} detected</span>
        </div>
      </Show>

      <style>{`
        .metrics-summary {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .metrics-summary.compact {
          padding: 12px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
        }

        .compact .metrics-grid {
          gap: 8px;
        }

        .metric-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #0d1117;
          border-radius: 6px;
          transition: transform 0.15s ease;
        }

        .compact .metric-card {
          padding: 8px;
          gap: 8px;
        }

        .metric-card:hover {
          transform: translateY(-1px);
        }

        .metric-icon {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: color-mix(in srgb, var(--metric-color) 15%, transparent);
          border-radius: 8px;
          color: var(--metric-color);
        }

        .compact .metric-icon {
          width: 28px;
          height: 28px;
        }

        .metric-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .metric-value {
          font-size: 18px;
          font-weight: 700;
          color: #c9d1d9;
          line-height: 1;
        }

        .compact .metric-value {
          font-size: 14px;
        }

        .metric-label {
          font-size: 10px;
          color: #6e7681;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .compact .metric-label {
          font-size: 9px;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
          padding: 10px 14px;
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 6px;
          color: #f85149;
          font-size: 12px;
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}

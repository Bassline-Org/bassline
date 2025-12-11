import { createSignal, createEffect, For, Show, createMemo } from 'solid-js'

interface TimelineEntry {
  value: any
  timestamp: number
}

interface ValueTimelineProps {
  history: TimelineEntry[]
  label?: string
  height?: number
  showSparkline?: boolean
}

/**
 * ValueTimeline - History visualization with sparkline
 */
export default function ValueTimeline(props: ValueTimelineProps) {
  const height = () => props.height ?? 60

  // Extract numeric values for sparkline
  const numericValues = createMemo(() => {
    return props.history
      .map(h => {
        const v = h.value
        if (typeof v === 'number') return v
        if (v && typeof v === 'object' && 'value' in v && typeof v.value === 'number') return v.value
        return null
      })
      .filter((v): v is number => v !== null)
  })

  // Calculate sparkline path
  const sparklinePath = createMemo(() => {
    const values = numericValues()
    if (values.length < 2) return ''

    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1

    const width = 200
    const h = height() - 20
    const stepX = width / (values.length - 1)

    const points = values.map((v, i) => {
      const x = i * stepX
      const y = h - ((v - min) / range) * h + 10
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  })

  // Format value for display
  function formatValue(value: any): string {
    if (value === undefined || value === null) return '—'
    if (typeof value === 'object') {
      if ('value' in value) return formatValue(value.value)
      return JSON.stringify(value).slice(0, 30)
    }
    if (typeof value === 'number') {
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
    }
    return String(value).slice(0, 30)
  }

  // Format timestamp
  function formatTime(ts: number): string {
    const date = new Date(ts)
    return date.toLocaleTimeString()
  }

  // Time ago
  function timeAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 1000) return 'now'
    if (diff < 60000) return `${Math.floor(diff / 1000)}s`
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    return `${Math.floor(diff / 3600000)}h`
  }

  // Stats
  const stats = createMemo(() => {
    const values = numericValues()
    if (values.length === 0) return null

    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      current: values[values.length - 1],
      change: values.length > 1 ? values[values.length - 1] - values[values.length - 2] : 0
    }
  })

  return (
    <div class="value-timeline">
      <Show when={props.label}>
        <div class="timeline-header">
          <span class="timeline-label">{props.label}</span>
          <span class="entry-count">{props.history.length} entries</span>
        </div>
      </Show>

      <Show when={props.showSparkline !== false && numericValues().length >= 2}>
        <div class="sparkline-container" style={{ height: `${height()}px` }}>
          <svg width="100%" height="100%" viewBox={`0 0 200 ${height()}`} preserveAspectRatio="none">
            {/* Grid lines */}
            <line x1="0" y1={height() / 2} x2="200" y2={height() / 2} stroke="#21262d" stroke-dasharray="4"/>

            {/* Sparkline */}
            <path
              d={sparklinePath()}
              fill="none"
              stroke="#58a6ff"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            {/* Latest point */}
            <Show when={numericValues().length > 0}>
              {(() => {
                const values = numericValues()
                const min = Math.min(...values)
                const max = Math.max(...values)
                const range = max - min || 1
                const lastY = (height() - 20) - ((values[values.length - 1] - min) / range) * (height() - 20) + 10
                return (
                  <circle cx="200" cy={lastY} r="4" fill="#58a6ff" />
                )
              })()}
            </Show>
          </svg>

          <Show when={stats()}>
            <div class="sparkline-labels">
              <span class="label-max">{stats()!.max.toFixed(1)}</span>
              <span class="label-min">{stats()!.min.toFixed(1)}</span>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={stats()}>
        <div class="stats-row">
          <div class="stat">
            <span class="stat-label">Current</span>
            <span class="stat-value current">{stats()!.current.toFixed(2)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Change</span>
            <span class={`stat-value ${stats()!.change >= 0 ? 'positive' : 'negative'}`}>
              {stats()!.change >= 0 ? '+' : ''}{stats()!.change.toFixed(2)}
            </span>
          </div>
          <div class="stat">
            <span class="stat-label">Avg</span>
            <span class="stat-value">{stats()!.avg.toFixed(2)}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Range</span>
            <span class="stat-value">{(stats()!.max - stats()!.min).toFixed(2)}</span>
          </div>
        </div>
      </Show>

      <div class="history-list">
        <For each={props.history.slice().reverse().slice(0, 10)}>
          {(entry) => (
            <div class="history-entry">
              <span class="entry-time" title={formatTime(entry.timestamp)}>
                {timeAgo(entry.timestamp)}
              </span>
              <span class="entry-value">{formatValue(entry.value)}</span>
            </div>
          )}
        </For>
      </div>

      <style>{`
        .value-timeline {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .timeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .timeline-label {
          font-weight: 600;
          font-size: 13px;
          color: #c9d1d9;
        }

        .entry-count {
          font-size: 11px;
          color: #6e7681;
        }

        .sparkline-container {
          position: relative;
          margin-bottom: 12px;
          background: #0d1117;
          border-radius: 6px;
          padding: 8px;
        }

        .sparkline-labels {
          position: absolute;
          right: 12px;
          top: 8px;
          bottom: 8px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .label-max, .label-min {
          font-size: 10px;
          color: #6e7681;
          font-family: monospace;
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 12px;
          padding: 12px;
          background: #0d1117;
          border-radius: 6px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .stat-label {
          font-size: 10px;
          color: #6e7681;
          text-transform: uppercase;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
          font-family: monospace;
        }

        .stat-value.current {
          color: #58a6ff;
        }

        .stat-value.positive {
          color: #3fb950;
        }

        .stat-value.negative {
          color: #f85149;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 200px;
          overflow-y: auto;
        }

        .history-entry {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 6px 10px;
          background: #0d1117;
          border-radius: 4px;
        }

        .entry-time {
          font-size: 10px;
          color: #6e7681;
          width: 40px;
          flex-shrink: 0;
        }

        .entry-value {
          font-family: monospace;
          font-size: 12px;
          color: #c9d1d9;
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

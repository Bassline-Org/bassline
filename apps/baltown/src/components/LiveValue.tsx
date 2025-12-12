import { Show, createMemo, createSignal, createEffect, on } from 'solid-js'
import { useLiveResource } from '@bassline/solid'

interface LiveValueProps {
  uri: string
  label?: string
  showUri?: boolean
  compact?: boolean
}

/**
 * LiveValue - Display a cell's value with real-time updates
 *
 * Uses WebSocket subscription to receive live updates when the cell changes.
 * Shows a pulse animation when values change.
 */
export default function LiveValue(props: LiveValueProps) {
  const { data, loading, error, isLive } = useLiveResource(() => props.uri)
  const [hasChanged, setHasChanged] = createSignal(false)
  let previousValue: any = undefined

  // Extract value - handle both cell format and raw value
  const value = createMemo(() => {
    const d = data()
    if (!d) return null

    // Cell value format: { body: { value: X } } or { value: X }
    if (d.body?.value !== undefined) return d.body.value
    if (d.value !== undefined) return d.value
    if (d.body !== undefined) return d.body

    return d
  })

  // Detect value changes and trigger pulse animation
  createEffect(
    on(
      value,
      (newValue) => {
        const newStr = JSON.stringify(newValue)
        const prevStr = JSON.stringify(previousValue)

        if (previousValue !== undefined && newStr !== prevStr) {
          setHasChanged(true)
          // Remove the changed class after animation completes
          setTimeout(() => setHasChanged(false), 600)
        }
        previousValue = newValue
      },
      { defer: true }
    )
  )

  // Format value for display
  const displayValue = createMemo(() => {
    const v = value()
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'object') return JSON.stringify(v, null, 2)
    return String(v)
  })

  // Determine value type for styling
  const valueType = createMemo(() => {
    const v = value()
    if (v === null || v === undefined) return 'null'
    if (typeof v === 'number') return 'number'
    if (typeof v === 'boolean') return 'boolean'
    if (typeof v === 'string') return 'string'
    if (Array.isArray(v)) return 'array'
    if (typeof v === 'object') return 'object'
    return 'unknown'
  })

  return (
    <div class={`live-value ${props.compact ? 'compact' : ''}`}>
      <Show when={props.label || props.showUri}>
        <div class="live-value-header">
          <span class="live-value-label">{props.label || props.uri}</span>
          <Show when={isLive()}>
            <span class="live-indicator" title="Live updates active">
              LIVE
            </span>
          </Show>
        </div>
      </Show>

      <Show when={loading()}>
        <div class="live-value-loading">Loading...</div>
      </Show>

      <Show when={error()}>
        <div class="live-value-error" title={error()?.message}>
          Error
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <div
          class={`live-value-content type-${valueType()} ${hasChanged() ? 'value-changed' : ''}`}
        >
          <Show when={valueType() === 'object' || valueType() === 'array'}>
            <pre class="live-value-json">{displayValue()}</pre>
          </Show>
          <Show when={valueType() !== 'object' && valueType() !== 'array'}>
            <span class="live-value-primitive">{displayValue()}</span>
          </Show>
        </div>
      </Show>

      <style>{`
        .live-value {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          overflow: hidden;
        }

        .live-value.compact {
          display: inline-flex;
          align-items: center;
          background: #21262d;
          border-radius: 4px;
          padding: 2px 8px;
        }

        .live-value.compact .live-value-header {
          padding: 0;
          border: none;
          margin-right: 8px;
        }

        .live-value.compact .live-value-content {
          padding: 0;
        }

        .live-value-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-bottom: 1px solid #30363d;
          background: #0d1117;
        }

        .live-value-label {
          font-size: 12px;
          color: #8b949e;
          font-family: monospace;
        }

        .live-indicator {
          font-size: 10px;
          padding: 2px 6px;
          background: #238636;
          color: white;
          border-radius: 10px;
          font-weight: 600;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

        .live-value-content {
          padding: 12px;
        }

        .live-value-loading {
          padding: 12px;
          color: #8b949e;
          font-size: 13px;
        }

        .live-value-error {
          padding: 12px;
          color: #f85149;
          font-size: 13px;
        }

        .live-value-json {
          margin: 0;
          font-size: 12px;
          color: #c9d1d9;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .live-value-primitive {
          font-size: 16px;
          font-weight: 600;
        }

        .type-number .live-value-primitive {
          color: #79c0ff;
        }

        .type-string .live-value-primitive {
          color: #a5d6ff;
        }

        .type-boolean .live-value-primitive {
          color: #ff7b72;
        }

        .type-null .live-value-primitive {
          color: #8b949e;
          font-style: italic;
        }

        /* Value change pulse animation */
        .value-changed {
          animation: value-pulse 0.6s ease-out;
        }

        @keyframes value-pulse {
          0% {
            background: rgba(88, 166, 255, 0.4);
            box-shadow: 0 0 8px rgba(88, 166, 255, 0.6);
          }
          100% {
            background: transparent;
            box-shadow: none;
          }
        }

        .live-value-content {
          transition: background 0.3s ease;
          border-radius: 4px;
        }
      `}</style>
    </div>
  )
}

/**
 * CellValue - Shorthand for LiveValue with cell-specific defaults
 */
export function CellValue(props: { name: string; label?: string }) {
  return (
    <LiveValue
      uri={`bl:///r/cells/${props.name}/value`}
      label={props.label || props.name}
      showUri={false}
    />
  )
}

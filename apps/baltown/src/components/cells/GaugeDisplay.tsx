import { createSignal, createEffect, createMemo, Show } from 'solid-js'
import { useBassline } from '@bassline/solid'

interface GaugeDisplayProps {
  uri: string
  value: number
  label?: string
  min?: number
  max?: number
  latticeType?: 'maxNumber' | 'minNumber'
  showInput?: boolean
  thresholds?: { value: number; color: string }[]
}

/**
 * GaugeDisplay - Visual gauge for maxNumber/minNumber lattices
 *
 * Shows value position within a range with optional threshold markers.
 */
export default function GaugeDisplay(props: GaugeDisplayProps) {
  const bl = useBassline()
  const [inputValue, setInputValue] = createSignal('')
  const [updating, setUpdating] = createSignal(false)
  const [history, setHistory] = createSignal<number[]>([])

  const min = () => props.min ?? 0
  const max = () => props.max ?? 100

  // Track history
  createEffect(() => {
    const val = props.value
    if (val !== undefined && val !== null) {
      setHistory(prev => [...prev, val].slice(-20))
    }
  })

  // Calculate percentage for gauge fill
  const percentage = createMemo(() => {
    const val = props.value ?? 0
    const range = max() - min()
    if (range === 0) return 0
    return Math.min(100, Math.max(0, ((val - min()) / range) * 100))
  })

  // Get color based on thresholds or default gradient
  const gaugeColor = createMemo(() => {
    const val = props.value ?? 0
    const thresholds = props.thresholds || [
      { value: 25, color: '#f85149' },
      { value: 50, color: '#d29922' },
      { value: 75, color: '#3fb950' }
    ]

    // Find matching threshold (percentage-based)
    const pct = percentage()
    for (let i = thresholds.length - 1; i >= 0; i--) {
      if (pct >= thresholds[i].value) {
        return thresholds[i].color
      }
    }
    return thresholds[0]?.color || '#58a6ff'
  })

  // Update value
  async function updateValue() {
    const val = parseFloat(inputValue())
    if (isNaN(val)) return

    setUpdating(true)
    try {
      await bl.put(`${props.uri}/value`, {}, val)
      setInputValue('')
    } catch (err) {
      console.error('Failed to update:', err)
    } finally {
      setUpdating(false)
    }
  }

  // Sparkline path
  const sparklinePath = () => {
    const h = history()
    if (h.length < 2) return ''

    const minH = Math.min(...h)
    const maxH = Math.max(...h)
    const range = maxH - minH || 1
    const width = 100
    const height = 20

    const points = h.map((val, i) => {
      const x = (i / (h.length - 1)) * width
      const y = height - ((val - minH) / range) * height
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  return (
    <div class="gauge-display">
      <Show when={props.label}>
        <div class="gauge-label">{props.label}</div>
      </Show>

      <div class="gauge-value-row">
        <span class="gauge-value" style={{ color: gaugeColor() }}>
          {props.value ?? 0}
        </span>
        <span class="gauge-range">
          {min()} - {max()}
        </span>
      </div>

      <div class="gauge-bar">
        <div
          class="gauge-fill"
          style={{
            width: `${percentage()}%`,
            background: gaugeColor()
          }}
        />
        <div class="gauge-markers">
          {props.thresholds?.map(t => (
            <div
              class="gauge-marker"
              style={{ left: `${t.value}%` }}
              title={`Threshold: ${t.value}%`}
            />
          ))}
        </div>
      </div>

      <div class="gauge-labels">
        <span>{min()}</span>
        <span class="gauge-lattice-type">
          {props.latticeType === 'minNumber' ? 'decreasing' : 'increasing'}
        </span>
        <span>{max()}</span>
      </div>

      <Show when={history().length > 1}>
        <div class="gauge-history">
          <svg width="100%" height="20" viewBox="0 0 100 20" preserveAspectRatio="none">
            <path
              d={sparklinePath()}
              fill="none"
              stroke={gaugeColor()}
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
      </Show>

      <Show when={props.showInput !== false}>
        <div class="gauge-input">
          <input
            type="number"
            class="form-input"
            placeholder={props.latticeType === 'minNumber' ? 'New lower value...' : 'New higher value...'}
            value={inputValue()}
            onInput={(e) => setInputValue(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && updateValue()}
          />
          <button
            class="btn btn-primary"
            onClick={updateValue}
            disabled={updating() || !inputValue()}
          >
            {updating() ? '...' : 'Set'}
          </button>
        </div>
      </Show>

      <style>{`
        .gauge-display {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .gauge-label {
          font-size: 12px;
          color: #8b949e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .gauge-value-row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .gauge-value {
          font-size: 28px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          transition: color 0.3s ease;
        }

        .gauge-range {
          font-size: 12px;
          color: #8b949e;
        }

        .gauge-bar {
          position: relative;
          height: 8px;
          background: #21262d;
          border-radius: 4px;
          overflow: hidden;
        }

        .gauge-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease, background 0.3s ease;
        }

        .gauge-markers {
          position: absolute;
          inset: 0;
        }

        .gauge-marker {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(255, 255, 255, 0.3);
          transform: translateX(-50%);
        }

        .gauge-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 6px;
          font-size: 11px;
          color: #8b949e;
        }

        .gauge-lattice-type {
          font-style: italic;
          opacity: 0.7;
        }

        .gauge-history {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .gauge-input {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .gauge-input .form-input {
          flex: 1;
        }
      `}</style>
    </div>
  )
}

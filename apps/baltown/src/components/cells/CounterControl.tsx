import { createSignal, createEffect, Show, For } from 'solid-js'
import { useBassline } from '@bassline/solid'

interface CounterControlProps {
  uri: string
  value: number
  label?: string
  showHistory?: boolean
  compact?: boolean
}

/**
 * CounterControl - Interactive counter with +/- buttons and sparkline
 *
 * For counter lattice cells that only increment.
 */
export default function CounterControl(props: CounterControlProps) {
  const bl = useBassline()
  const [history, setHistory] = createSignal<number[]>([])
  const [updating, setUpdating] = createSignal(false)
  const [lastChange, setLastChange] = createSignal<number | null>(null)

  // Ensure value is a number (defensive against objects being passed)
  const safeValue = () => {
    const v = props.value
    if (typeof v === 'number') return v
    if (typeof v === 'string') return parseFloat(v) || 0
    return 0
  }

  // Track value history
  createEffect(() => {
    const val = safeValue()
    if (val !== undefined && val !== null) {
      setHistory(prev => {
        const newHistory = [...prev, val].slice(-20)
        return newHistory
      })
    }
  })

  // Increment the counter
  async function increment(amount: number = 1) {
    setUpdating(true)
    setLastChange(amount)
    try {
      await bl.put(`${props.uri}/value`, {}, amount)
    } catch (err) {
      console.error('Failed to increment:', err)
    } finally {
      setUpdating(false)
      setTimeout(() => setLastChange(null), 500)
    }
  }

  // Generate sparkline path
  const sparklinePath = () => {
    const h = history()
    if (h.length < 2) return ''

    const min = Math.min(...h)
    const max = Math.max(...h)
    const range = max - min || 1
    const width = 80
    const height = 24
    const padding = 2

    const points = h.map((val, i) => {
      const x = padding + (i / (h.length - 1)) * (width - padding * 2)
      const y = height - padding - ((val - min) / range) * (height - padding * 2)
      return `${x},${y}`
    })

    return `M ${points.join(' L ')}`
  }

  return (
    <div class={`counter-control ${props.compact ? 'compact' : ''}`}>
      <Show when={props.label}>
        <div class="counter-label">{props.label}</div>
      </Show>

      <div class="counter-display">
        <span class={`counter-value ${lastChange() ? 'animate-bump' : ''}`}>
          {safeValue()}
        </span>
        <Show when={lastChange()}>
          <span class="counter-delta">+{lastChange()}</span>
        </Show>
      </div>

      <div class="counter-buttons">
        <button
          class="counter-btn"
          onClick={() => increment(1)}
          disabled={updating()}
        >
          +1
        </button>
        <button
          class="counter-btn"
          onClick={() => increment(5)}
          disabled={updating()}
        >
          +5
        </button>
        <button
          class="counter-btn"
          onClick={() => increment(10)}
          disabled={updating()}
        >
          +10
        </button>
      </div>

      <Show when={props.showHistory !== false && history().length > 1}>
        <div class="counter-sparkline">
          <svg width="80" height="24" viewBox="0 0 80 24">
            <path
              d={sparklinePath()}
              fill="none"
              stroke="#3fb950"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </Show>

      <style>{`
        .counter-control {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .counter-control.compact {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
        }

        .counter-label {
          font-size: 12px;
          color: #8b949e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .counter-display {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 12px;
        }

        .compact .counter-display {
          margin-bottom: 0;
        }

        .counter-value {
          font-size: 32px;
          font-weight: 700;
          color: #58a6ff;
          font-variant-numeric: tabular-nums;
          transition: transform 0.1s ease;
        }

        .compact .counter-value {
          font-size: 20px;
        }

        .counter-value.animate-bump {
          animation: bump 0.3s ease;
        }

        @keyframes bump {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .counter-delta {
          font-size: 14px;
          color: #3fb950;
          font-weight: 600;
          animation: fadeUp 0.5s ease forwards;
        }

        @keyframes fadeUp {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-10px); }
        }

        .counter-buttons {
          display: flex;
          gap: 8px;
        }

        .counter-btn {
          flex: 1;
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .counter-btn:hover:not(:disabled) {
          background: #30363d;
          border-color: #8b949e;
        }

        .counter-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .counter-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .counter-sparkline {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .compact .counter-sparkline {
          margin-top: 0;
          padding-top: 0;
          border-top: none;
        }
      `}</style>
    </div>
  )
}

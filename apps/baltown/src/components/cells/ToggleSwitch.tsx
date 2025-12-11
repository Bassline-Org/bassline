import { createSignal, Show } from 'solid-js'
import { useBassline } from '@bassline/solid'

interface ToggleSwitchProps {
  uri: string
  value: boolean
  label?: string
  onLabel?: string
  offLabel?: string
  showCelebration?: boolean
}

/**
 * ToggleSwitch - Toggle for boolean lattice
 *
 * Once true, cannot be set back to false (monotonic).
 * Shows celebration animation when toggled to true.
 */
export default function ToggleSwitch(props: ToggleSwitchProps) {
  const bl = useBassline()
  const [updating, setUpdating] = createSignal(false)
  const [celebrating, setCelebrating] = createSignal(false)

  const isOn = () => Boolean(props.value)

  async function toggle() {
    if (isOn()) return // Can't toggle off once true

    setUpdating(true)
    try {
      await bl.put(`${props.uri}/value`, {}, true)
      if (props.showCelebration !== false) {
        setCelebrating(true)
        setTimeout(() => setCelebrating(false), 1500)
      }
    } catch (err) {
      console.error('Failed to toggle:', err)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div class="toggle-switch-container">
      <Show when={props.label}>
        <div class="toggle-label">{props.label}</div>
      </Show>

      <div class={`toggle-row ${isOn() ? 'is-on' : 'is-off'}`}>
        <button
          class={`toggle-switch ${isOn() ? 'on' : 'off'}`}
          onClick={toggle}
          disabled={updating() || isOn()}
          title={isOn() ? 'Permanently enabled' : 'Click to enable'}
        >
          <span class="toggle-track">
            <span class="toggle-thumb">
              <Show when={isOn()}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </Show>
            </span>
          </span>
        </button>

        <span class="toggle-status">
          {isOn()
            ? (props.onLabel || 'Enabled')
            : (props.offLabel || 'Disabled')}
        </span>

        <Show when={isOn()}>
          <span class="toggle-locked" title="Boolean lattice: once true, always true">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </span>
        </Show>
      </div>

      <div class="toggle-meta">
        <span class="toggle-type">boolean (monotonic)</span>
        <Show when={isOn()}>
          <span class="toggle-permanent">permanently enabled</span>
        </Show>
      </div>

      <Show when={celebrating()}>
        <div class="celebration">
          <span class="confetti">!</span>
          <span class="confetti" style="animation-delay: 0.1s">!</span>
          <span class="confetti" style="animation-delay: 0.2s">!</span>
        </div>
      </Show>

      <style>{`
        .toggle-switch-container {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
          position: relative;
          overflow: hidden;
        }

        .toggle-label {
          font-size: 12px;
          color: #8b949e;
          margin-bottom: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .toggle-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-switch {
          width: 52px;
          height: 28px;
          padding: 0;
          background: none;
          border: none;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .toggle-switch:disabled {
          cursor: not-allowed;
        }

        .toggle-switch.on:disabled {
          cursor: default;
        }

        .toggle-track {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 14px;
          background: #21262d;
          position: relative;
          transition: background 0.2s ease;
        }

        .toggle-switch.on .toggle-track {
          background: #238636;
        }

        .toggle-switch:not(.on):hover .toggle-track {
          background: #30363d;
        }

        .toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          border-radius: 12px;
          background: #c9d1d9;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease, background 0.2s ease;
        }

        .toggle-switch.on .toggle-thumb {
          transform: translateX(24px);
          background: white;
        }

        .toggle-thumb svg {
          color: #238636;
        }

        .toggle-status {
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .is-on .toggle-status {
          color: #3fb950;
        }

        .toggle-locked {
          display: flex;
          align-items: center;
          color: #8b949e;
        }

        .toggle-meta {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          font-size: 11px;
          color: #8b949e;
        }

        .toggle-type {
          font-style: italic;
        }

        .toggle-permanent {
          color: #3fb950;
        }

        .celebration {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .confetti {
          position: absolute;
          font-size: 24px;
          animation: confetti 1.5s ease forwards;
        }

        @keyframes confetti {
          0% {
            opacity: 1;
            transform: translate(0, 0) rotate(0deg);
          }
          100% {
            opacity: 0;
            transform: translate(var(--x, 50px), var(--y, -80px)) rotate(var(--r, 360deg));
          }
        }

        .confetti:nth-child(1) {
          --x: -60px;
          --y: -70px;
          --r: -180deg;
        }

        .confetti:nth-child(2) {
          --x: 60px;
          --y: -80px;
          --r: 180deg;
        }

        .confetti:nth-child(3) {
          --x: 0px;
          --y: -90px;
          --r: 270deg;
        }
      `}</style>
    </div>
  )
}

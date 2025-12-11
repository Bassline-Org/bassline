import { createSignal, Show } from 'solid-js'

interface NumericConfigEditorProps {
  value: number
  onChange: (value: number) => void
  label?: string
  min?: number
  max?: number
  step?: number
  showSlider?: boolean
}

/**
 * NumericConfigEditor - Slider and number input for numeric configs
 *
 * Used for handlers like multiply, add, divide, power, etc.
 */
export default function NumericConfigEditor(props: NumericConfigEditorProps) {
  const [localValue, setLocalValue] = createSignal(props.value ?? 0)

  const min = () => props.min ?? -1000
  const max = () => props.max ?? 1000
  const step = () => props.step ?? 1
  const showSlider = () => props.showSlider !== false && min() !== -Infinity && max() !== Infinity

  function handleChange(newValue: number) {
    const clamped = Math.min(max(), Math.max(min(), newValue))
    setLocalValue(clamped)
    props.onChange(clamped)
  }

  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement
    const num = parseFloat(target.value)
    if (!isNaN(num)) {
      handleChange(num)
    }
  }

  function handleSliderChange(e: Event) {
    const target = e.target as HTMLInputElement
    handleChange(parseFloat(target.value))
  }

  // Quick adjustment buttons
  function nudge(amount: number) {
    handleChange(localValue() + amount)
  }

  return (
    <div class="numeric-config-editor">
      <Show when={props.label}>
        <label class="numeric-label">{props.label}</label>
      </Show>

      <div class="numeric-controls">
        <div class="numeric-input-group">
          <button
            class="nudge-btn"
            onClick={() => nudge(-step())}
            title={`Decrease by ${step()}`}
          >
            −
          </button>

          <input
            type="number"
            class="numeric-input"
            value={localValue()}
            min={min()}
            max={max()}
            step={step()}
            onInput={handleInputChange}
          />

          <button
            class="nudge-btn"
            onClick={() => nudge(step())}
            title={`Increase by ${step()}`}
          >
            +
          </button>
        </div>

        <Show when={showSlider()}>
          <input
            type="range"
            class="numeric-slider"
            value={localValue()}
            min={min()}
            max={max()}
            step={step()}
            onInput={handleSliderChange}
          />
          <div class="slider-labels">
            <span>{min()}</span>
            <span>{max()}</span>
          </div>
        </Show>
      </div>

      <style>{`
        .numeric-config-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .numeric-label {
          font-size: 12px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .numeric-controls {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .numeric-input-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .numeric-input {
          flex: 1;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 16px;
          font-family: monospace;
          text-align: center;
          outline: none;
          -moz-appearance: textfield;
        }

        .numeric-input::-webkit-outer-spin-button,
        .numeric-input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .numeric-input:focus {
          border-color: #58a6ff;
        }

        .nudge-btn {
          width: 36px;
          height: 36px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .nudge-btn:hover {
          background: #30363d;
          border-color: #484f58;
        }

        .nudge-btn:active {
          background: #484f58;
        }

        .numeric-slider {
          width: 100%;
          height: 6px;
          background: #21262d;
          border-radius: 3px;
          outline: none;
          -webkit-appearance: none;
          cursor: pointer;
        }

        .numeric-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          background: #58a6ff;
          border-radius: 50%;
          cursor: pointer;
          transition: transform 0.15s ease;
        }

        .numeric-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        .numeric-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #58a6ff;
          border-radius: 50%;
          border: none;
          cursor: pointer;
        }

        .slider-labels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #6e7681;
        }
      `}</style>
    </div>
  )
}

import { createSignal, For, Show } from 'solid-js'

interface TypeSelectorProps {
  value: string
  onChange: (value: string) => void
  types?: string[]
  label?: string
}

const DEFAULT_TYPES = [
  { value: 'string', label: 'String', icon: 'T', color: '#3fb950' },
  { value: 'number', label: 'Number', icon: '#', color: '#58a6ff' },
  { value: 'boolean', label: 'Boolean', icon: '?', color: '#a371f7' },
  { value: 'json', label: 'JSON', icon: '{ }', color: '#f0883e' },
  { value: 'array', label: 'Array', icon: '[ ]', color: '#f778ba' },
]

/**
 * TypeSelector - Type selection for coercion handlers
 *
 * Visual type picker for handlers like coerce.
 */
export default function TypeSelector(props: TypeSelectorProps) {
  const [selected, setSelected] = createSignal(props.value ?? 'string')

  // Filter types if custom list provided
  const availableTypes = () => {
    if (!props.types) return DEFAULT_TYPES
    return DEFAULT_TYPES.filter(t => props.types!.includes(t.value))
  }

  function selectType(type: string) {
    setSelected(type)
    props.onChange(type)
  }

  return (
    <div class="type-selector">
      <Show when={props.label}>
        <label class="type-label">{props.label}</label>
      </Show>

      <div class="type-grid">
        <For each={availableTypes()}>
          {(type) => (
            <button
              class={`type-option ${selected() === type.value ? 'selected' : ''}`}
              style={{ '--type-color': type.color }}
              onClick={() => selectType(type.value)}
            >
              <span class="type-icon">{type.icon}</span>
              <span class="type-name">{type.label}</span>
            </button>
          )}
        </For>
      </div>

      <div class="type-preview">
        <span class="preview-label">Convert to:</span>
        <span class="preview-type" style={{ color: availableTypes().find(t => t.value === selected())?.color }}>
          {selected()}
        </span>
      </div>

      <style>{`
        .type-selector {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .type-label {
          font-size: 12px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 8px;
        }

        .type-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 16px 12px;
          background: #161b22;
          border: 2px solid #30363d;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .type-option:hover {
          border-color: var(--type-color);
          background: #1c2128;
        }

        .type-option.selected {
          border-color: var(--type-color);
          background: color-mix(in srgb, var(--type-color) 10%, transparent);
        }

        .type-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #21262d;
          border-radius: 8px;
          font-size: 18px;
          font-weight: 700;
          font-family: monospace;
          color: var(--type-color);
        }

        .type-option.selected .type-icon {
          background: color-mix(in srgb, var(--type-color) 20%, transparent);
        }

        .type-name {
          font-size: 12px;
          font-weight: 500;
          color: #c9d1d9;
        }

        .type-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #0d1117;
          border-radius: 6px;
        }

        .preview-label {
          font-size: 12px;
          color: #6e7681;
        }

        .preview-type {
          font-weight: 600;
          font-size: 14px;
        }
      `}</style>
    </div>
  )
}

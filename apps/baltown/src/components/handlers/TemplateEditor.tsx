import { createSignal, createMemo, For, Show } from 'solid-js'

interface TemplateEditorProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  presets?: string[]
  showPreview?: boolean
  previewData?: any
}

/**
 * TemplateEditor - String template editor with variable hints
 *
 * Used for handlers like format, split, join.
 * Supports {0}, {1} positional and {name} named placeholders.
 */
export default function TemplateEditor(props: TemplateEditorProps) {
  const [inputValue, setInputValue] = createSignal(props.value ?? '')
  const [showPresets, setShowPresets] = createSignal(false)

  // Extract variables from template
  const variables = createMemo(() => {
    const matches = inputValue().matchAll(/\{(\w+)\}/g)
    return [...matches].map((m) => m[1])
  })

  // Generate preview with sample data
  const preview = createMemo(() => {
    if (!props.showPreview) return null

    let result = inputValue()
    const data = props.previewData || {}

    // Replace named variables
    Object.entries(data).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val))
    })

    // Replace positional variables
    if (Array.isArray(data)) {
      data.forEach((val, i) => {
        result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), String(val))
      })
    }

    return result
  })

  function handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    setInputValue(target.value)
    props.onChange(target.value)
  }

  function selectPreset(preset: string) {
    setInputValue(preset)
    props.onChange(preset)
    setShowPresets(false)
  }

  function insertVariable(name: string) {
    const current = inputValue()
    const newValue = current + `{${name}}`
    setInputValue(newValue)
    props.onChange(newValue)
  }

  return (
    <div class="template-editor">
      <Show when={props.label}>
        <label class="template-label">{props.label}</label>
      </Show>

      <div class="template-input-wrapper">
        <input
          type="text"
          class="template-input"
          value={inputValue()}
          placeholder={props.placeholder || 'Enter template string...'}
          onInput={handleInput}
        />

        <Show when={props.presets?.length}>
          <button
            class="presets-btn"
            onClick={() => setShowPresets(!showPresets())}
            title="Show presets"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </Show>
      </div>

      <Show when={showPresets() && props.presets?.length}>
        <div class="presets-dropdown">
          <For each={props.presets}>
            {(preset) => (
              <div class="preset-item" onClick={() => selectPreset(preset)}>
                <code>{preset}</code>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={variables().length > 0}>
        <div class="variables-info">
          <span class="variables-label">Variables:</span>
          <For each={variables()}>{(v) => <span class="variable-tag">{`{${v}}`}</span>}</For>
        </div>
      </Show>

      <div class="quick-insert">
        <span class="quick-label">Insert:</span>
        <button class="insert-btn" onClick={() => insertVariable('0')}>
          {'{0}'}
        </button>
        <button class="insert-btn" onClick={() => insertVariable('1')}>
          {'{1}'}
        </button>
        <button class="insert-btn" onClick={() => insertVariable('name')}>
          {'{name}'}
        </button>
        <button class="insert-btn" onClick={() => insertVariable('value')}>
          {'{value}'}
        </button>
      </div>

      <Show when={props.showPreview && preview()}>
        <div class="preview-section">
          <span class="preview-label">Preview:</span>
          <div class="preview-output">{preview()}</div>
        </div>
      </Show>

      <style>{`
        .template-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .template-label {
          font-size: 12px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .template-input-wrapper {
          display: flex;
          gap: 4px;
        }

        .template-input {
          flex: 1;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 14px;
          font-family: monospace;
          outline: none;
        }

        .template-input:focus {
          border-color: #58a6ff;
        }

        .template-input::placeholder {
          color: #6e7681;
        }

        .presets-btn {
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .presets-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .presets-dropdown {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          overflow: hidden;
        }

        .preset-item {
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .preset-item:hover {
          background: #21262d;
        }

        .preset-item code {
          font-size: 13px;
          color: #79c0ff;
        }

        .variables-info {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .variables-label {
          font-size: 11px;
          color: #6e7681;
        }

        .variable-tag {
          padding: 2px 6px;
          background: #388bfd33;
          color: #58a6ff;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
        }

        .quick-insert {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .quick-label {
          font-size: 11px;
          color: #6e7681;
        }

        .insert-btn {
          padding: 4px 8px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #8b949e;
          font-family: monospace;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .insert-btn:hover {
          background: #30363d;
          color: #c9d1d9;
          border-color: #484f58;
        }

        .preview-section {
          padding: 8px;
          background: #21262d;
          border-radius: 6px;
        }

        .preview-label {
          font-size: 10px;
          color: #6e7681;
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }

        .preview-output {
          font-family: monospace;
          font-size: 13px;
          color: #3fb950;
        }
      `}</style>
    </div>
  )
}

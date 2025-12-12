import { createSignal, Show, For, createMemo } from 'solid-js'
import { HANDLER_METADATA, getHandlerMetadata, HandlerMetadata } from '../../lib/handlerMetadata'

interface NestedHandlerEditorProps {
  handler: string
  config: Record<string, any>
  onHandlerChange: (handler: string) => void
  onConfigChange: (config: Record<string, any>) => void
  type?: 'predicate' | 'transform' | 'any'
  label?: string
}

// Group handlers by category
const HANDLER_CATEGORIES = Object.entries(HANDLER_METADATA).reduce(
  (acc, [name, meta]) => {
    const cat = meta.category
    if (!acc[cat]) acc[cat] = []
    acc[cat].push({ name, ...meta })
    return acc
  },
  {} as Record<string, Array<{ name: string } & HandlerMetadata>>
)

// Filter handlers for predicates (return boolean)
const PREDICATE_HANDLERS = [
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq',
  'isEmpty',
  'isNull',
  'isNumber',
  'isString',
  'isArray',
  'isObject',
  'isBoolean',
  'has',
  'not',
  'and',
  'or',
  'match',
]

/**
 * NestedHandlerEditor - Recursive handler picker for nested configs
 *
 * Used for handlers like filter, map, when, tap that take another handler as config.
 */
export default function NestedHandlerEditor(props: NestedHandlerEditorProps) {
  const [selectedHandler, setSelectedHandler] = createSignal(props.handler ?? '')
  const [showPicker, setShowPicker] = createSignal(false)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [configValue, setConfigValue] = createSignal(
    props.config ? JSON.stringify(props.config, null, 2) : ''
  )

  // Get metadata for selected handler
  const handlerMeta = createMemo(() => getHandlerMetadata(selectedHandler()))

  // Filter handlers based on type and search
  const filteredCategories = createMemo(() => {
    const query = searchQuery().toLowerCase()
    const result: Record<string, Array<{ name: string } & HandlerMetadata>> = {}

    Object.entries(HANDLER_CATEGORIES).forEach(([cat, handlers]) => {
      let filtered = handlers

      // Filter by type if specified
      if (props.type === 'predicate') {
        filtered = handlers.filter((h) => PREDICATE_HANDLERS.includes(h.name))
      }

      // Filter by search query
      if (query) {
        filtered = filtered.filter(
          (h) => h.name.toLowerCase().includes(query) || h.description.toLowerCase().includes(query)
        )
      }

      if (filtered.length > 0) {
        result[cat] = filtered
      }
    })

    return result
  })

  function handleHandlerSelect(name: string) {
    setSelectedHandler(name)
    props.onHandlerChange(name)
    setShowPicker(false)

    // Reset config when handler changes
    const meta = getHandlerMetadata(name)
    if (meta?.uiType === 'none') {
      setConfigValue('')
      props.onConfigChange({})
    }
  }

  function handleConfigChange(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value
    setConfigValue(value)

    try {
      const parsed = value ? JSON.parse(value) : {}
      props.onConfigChange(parsed)
    } catch {
      // Invalid JSON, don't update
    }
  }

  return (
    <div class="nested-handler-editor">
      <Show when={props.label}>
        <label class="nested-label">{props.label}</label>
      </Show>

      <div class="handler-selector">
        <button class="handler-select-btn" onClick={() => setShowPicker(!showPicker())}>
          <Show
            when={selectedHandler()}
            fallback={<span class="placeholder">Select a handler...</span>}
          >
            <span class="handler-name">{selectedHandler()}</span>
            <Show when={handlerMeta()}>
              <span class="handler-desc">{handlerMeta()!.description}</span>
            </Show>
          </Show>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        <Show when={showPicker()}>
          <div class="handler-picker">
            <div class="picker-search">
              <input
                type="text"
                placeholder="Search handlers..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                autofocus
              />
            </div>

            <div class="picker-categories">
              <For each={Object.entries(filteredCategories())}>
                {([category, handlers]) => (
                  <div class="picker-category">
                    <div class="category-header">{category}</div>
                    <For each={handlers}>
                      {(h) => (
                        <div
                          class={`handler-option ${selectedHandler() === h.name ? 'selected' : ''}`}
                          onClick={() => handleHandlerSelect(h.name)}
                        >
                          <span class="option-name">{h.name}</span>
                          <span class="option-desc">{h.description}</span>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <Show when={selectedHandler() && handlerMeta()?.uiType !== 'none'}>
        <div class="config-section">
          <label class="config-label">
            Handler Config
            <Show when={handlerMeta()?.config}>
              <span class="config-schema">
                {Object.entries(handlerMeta()!.config || {})
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(', ')}
              </span>
            </Show>
          </label>
          <textarea
            class="config-input"
            value={configValue()}
            onInput={handleConfigChange}
            rows={4}
            placeholder={`{ "value": ... }`}
          />
        </div>
      </Show>

      <style>{`
        .nested-handler-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nested-label {
          font-size: 12px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .handler-selector {
          position: relative;
        }

        .handler-select-btn {
          width: 100%;
          padding: 12px 16px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          text-align: left;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .handler-select-btn:hover {
          border-color: #58a6ff;
        }

        .handler-select-btn svg {
          margin-left: auto;
          color: #6e7681;
        }

        .placeholder {
          color: #6e7681;
        }

        .handler-name {
          font-weight: 600;
          color: #58a6ff;
        }

        .handler-desc {
          color: #8b949e;
          font-size: 12px;
          flex: 1;
        }

        .handler-picker {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 4px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          max-height: 400px;
          overflow: hidden;
          z-index: 100;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .picker-search {
          padding: 12px;
          border-bottom: 1px solid #30363d;
        }

        .picker-search input {
          width: 100%;
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          outline: none;
          box-sizing: border-box;
        }

        .picker-search input:focus {
          border-color: #58a6ff;
        }

        .picker-categories {
          max-height: 340px;
          overflow-y: auto;
        }

        .picker-category {
          border-bottom: 1px solid #21262d;
        }

        .picker-category:last-child {
          border-bottom: none;
        }

        .category-header {
          padding: 8px 12px;
          font-size: 10px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          background: #21262d;
          position: sticky;
          top: 0;
        }

        .handler-option {
          padding: 10px 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .handler-option:hover {
          background: #21262d;
        }

        .handler-option.selected {
          background: #388bfd22;
        }

        .option-name {
          font-weight: 500;
          color: #c9d1d9;
          font-size: 13px;
        }

        .option-desc {
          color: #6e7681;
          font-size: 11px;
        }

        .config-section {
          margin-top: 4px;
        }

        .config-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          color: #6e7681;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .config-schema {
          font-family: monospace;
          color: #8b949e;
          text-transform: none;
        }

        .config-input {
          width: 100%;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #79c0ff;
          font-family: monospace;
          font-size: 13px;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
        }

        .config-input:focus {
          border-color: #58a6ff;
        }
      `}</style>
    </div>
  )
}

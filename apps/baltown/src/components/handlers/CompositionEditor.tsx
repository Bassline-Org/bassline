import { createSignal, For, Show } from 'solid-js'
import { HANDLER_METADATA, HandlerMetadata } from '../../lib/handlerMetadata'

interface CompositionEditorProps {
  handlers: Array<string | [string, Record<string, any>]>
  onChange: (handlers: Array<string | [string, Record<string, any>]>) => void
  type: 'pipe' | 'fork' | 'compose'
  label?: string
}

// Handler picker categories
const CATEGORY_ORDER = [
  'Reducers',
  'Arithmetic',
  'Comparison',
  'Array',
  'ArrayReducers',
  'Object',
  'String',
  'Logic',
  'Type',
  'Utility',
  'Structural',
  'Conditional',
]

const HANDLER_LIST = Object.entries(HANDLER_METADATA).map(([name, meta]) => ({
  name,
  ...meta,
}))

/**
 * CompositionEditor - Drag-and-drop handler sequence editor
 *
 * Used for handlers like pipe, fork, compose.
 */
export default function CompositionEditor(props: CompositionEditorProps) {
  const [showPicker, setShowPicker] = createSignal(false)
  const [insertIndex, setInsertIndex] = createSignal(-1)
  const [searchQuery, setSearchQuery] = createSignal('')
  const [editingIndex, setEditingIndex] = createSignal(-1)
  const [dragIndex, setDragIndex] = createSignal(-1)
  const [dropIndex, setDropIndex] = createSignal(-1)

  // Get handler name from entry
  function getHandlerName(entry: string | [string, Record<string, any>]): string {
    return Array.isArray(entry) ? entry[0] : entry
  }

  // Get handler config from entry
  function getHandlerConfig(
    entry: string | [string, Record<string, any>]
  ): Record<string, any> | undefined {
    return Array.isArray(entry) ? entry[1] : undefined
  }

  // Filter handlers by search
  function filteredHandlers() {
    const query = searchQuery().toLowerCase()
    if (!query) return HANDLER_LIST
    return HANDLER_LIST.filter(
      (h) =>
        h.name.toLowerCase().includes(query) ||
        h.description.toLowerCase().includes(query) ||
        h.category.toLowerCase().includes(query)
    )
  }

  // Group handlers by category
  function groupedHandlers() {
    const groups: Record<string, typeof HANDLER_LIST> = {}
    filteredHandlers().forEach((h) => {
      if (!groups[h.category]) groups[h.category] = []
      groups[h.category].push(h)
    })

    // Sort by category order
    return CATEGORY_ORDER.filter((cat) => groups[cat]).map((cat) => ({
      category: cat,
      handlers: groups[cat],
    }))
  }

  function openPicker(index: number) {
    setInsertIndex(index)
    setShowPicker(true)
    setSearchQuery('')
  }

  function addHandler(name: string) {
    const newHandlers = [...props.handlers]
    const meta = HANDLER_METADATA[name]
    const entry: string | [string, Record<string, any>] =
      meta?.uiType === 'none' ? name : [name, {}]

    if (insertIndex() >= 0) {
      newHandlers.splice(insertIndex(), 0, entry)
    } else {
      newHandlers.push(entry)
    }

    props.onChange(newHandlers)
    setShowPicker(false)
  }

  function removeHandler(index: number) {
    const newHandlers = [...props.handlers]
    newHandlers.splice(index, 1)
    props.onChange(newHandlers)
  }

  function updateHandlerConfig(index: number, config: Record<string, any>) {
    const newHandlers = [...props.handlers]
    const name = getHandlerName(newHandlers[index])
    newHandlers[index] = [name, config]
    props.onChange(newHandlers)
  }

  // Drag and drop
  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault()
    setDropIndex(index)
  }

  function handleDrop(index: number) {
    const from = dragIndex()
    if (from >= 0 && from !== index) {
      const newHandlers = [...props.handlers]
      const [moved] = newHandlers.splice(from, 1)
      newHandlers.splice(index > from ? index - 1 : index, 0, moved)
      props.onChange(newHandlers)
    }
    setDragIndex(-1)
    setDropIndex(-1)
  }

  function handleDragEnd() {
    setDragIndex(-1)
    setDropIndex(-1)
  }

  const typeLabels = {
    pipe: { label: 'Pipeline', desc: 'Execute handlers in sequence, passing output to next input' },
    fork: { label: 'Fork', desc: 'Execute all handlers on same input, collect outputs' },
    compose: {
      label: 'Compose',
      desc: 'Combine handlers right-to-left (mathematical composition)',
    },
  }

  return (
    <div class="composition-editor">
      <Show when={props.label}>
        <label class="comp-label">{props.label}</label>
      </Show>

      <div class="comp-info">
        <span class="comp-type">{typeLabels[props.type].label}</span>
        <span class="comp-desc">{typeLabels[props.type].desc}</span>
      </div>

      <div class="handler-sequence">
        <For each={props.handlers}>
          {(entry, index) => {
            const name = getHandlerName(entry)
            const config = getHandlerConfig(entry)
            const meta = HANDLER_METADATA[name]

            return (
              <>
                <Show when={index() === dropIndex() && dragIndex() !== index()}>
                  <div class="drop-indicator" />
                </Show>

                <div
                  class={`handler-item ${dragIndex() === index() ? 'dragging' : ''}`}
                  draggable={true}
                  onDragStart={() => handleDragStart(index())}
                  onDragOver={(e) => handleDragOver(e, index())}
                  onDrop={() => handleDrop(index())}
                  onDragEnd={handleDragEnd}
                >
                  <div class="handler-grip">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="8" cy="6" r="2" />
                      <circle cx="16" cy="6" r="2" />
                      <circle cx="8" cy="12" r="2" />
                      <circle cx="16" cy="12" r="2" />
                      <circle cx="8" cy="18" r="2" />
                      <circle cx="16" cy="18" r="2" />
                    </svg>
                  </div>

                  <div
                    class="handler-info"
                    onClick={() => setEditingIndex(editingIndex() === index() ? -1 : index())}
                  >
                    <span class="handler-name">{name}</span>
                    <Show when={meta}>
                      <span class="handler-category">{meta!.category}</span>
                    </Show>
                    <Show when={config && Object.keys(config).length > 0}>
                      <span class="handler-config-badge">{Object.keys(config!).length} config</span>
                    </Show>
                  </div>

                  <button
                    class="remove-btn"
                    onClick={() => removeHandler(index())}
                    title="Remove handler"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <Show when={editingIndex() === index() && meta?.config}>
                  <div class="handler-config-editor">
                    <For each={Object.entries(meta!.config || {})}>
                      {([key, type]) => (
                        <div class="config-field">
                          <label>
                            {key} ({type})
                          </label>
                          <input
                            type={type === 'number' ? 'number' : 'text'}
                            value={config?.[key] ?? ''}
                            onInput={(e) => {
                              let val: any = e.currentTarget.value
                              if (type === 'number') val = parseFloat(val) || 0
                              updateHandlerConfig(index(), { ...config, [key]: val })
                            }}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                </Show>

                <Show when={props.type === 'pipe' && index() < props.handlers.length - 1}>
                  <div class="pipe-arrow">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  </div>
                </Show>
              </>
            )
          }}
        </For>

        <button class="add-handler-btn" onClick={() => openPicker(props.handlers.length)}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Handler
        </button>
      </div>

      <Show when={showPicker()}>
        <div class="handler-picker-overlay" onClick={() => setShowPicker(false)}>
          <div class="handler-picker" onClick={(e) => e.stopPropagation()}>
            <div class="picker-header">
              <input
                type="text"
                placeholder="Search handlers..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                autofocus
              />
              <button class="close-picker" onClick={() => setShowPicker(false)}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="picker-body">
              <For each={groupedHandlers()}>
                {({ category, handlers }) => (
                  <div class="picker-category">
                    <div class="category-name">{category}</div>
                    <div class="category-handlers">
                      <For each={handlers}>
                        {(h) => (
                          <button class="picker-handler" onClick={() => addHandler(h.name)}>
                            <span class="handler-name">{h.name}</span>
                            <span class="handler-desc">{h.description}</span>
                          </button>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </Show>

      <style>{`
        .composition-editor {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .comp-label {
          font-size: 12px;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .comp-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background: #21262d;
          border-radius: 6px;
        }

        .comp-type {
          font-weight: 600;
          color: #58a6ff;
          font-size: 12px;
        }

        .comp-desc {
          color: #8b949e;
          font-size: 12px;
        }

        .handler-sequence {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .handler-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          cursor: move;
        }

        .handler-item.dragging {
          opacity: 0.5;
        }

        .handler-item:hover {
          border-color: #484f58;
        }

        .drop-indicator {
          height: 2px;
          background: #58a6ff;
          border-radius: 1px;
          margin: 4px 0;
        }

        .handler-grip {
          color: #6e7681;
          cursor: grab;
        }

        .handler-info {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .handler-name {
          font-weight: 500;
          color: #c9d1d9;
        }

        .handler-category {
          font-size: 10px;
          color: #6e7681;
          padding: 2px 6px;
          background: #21262d;
          border-radius: 4px;
        }

        .handler-config-badge {
          font-size: 10px;
          color: #58a6ff;
          padding: 2px 6px;
          background: #388bfd22;
          border-radius: 4px;
        }

        .remove-btn {
          background: none;
          border: none;
          color: #6e7681;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
        }

        .remove-btn:hover {
          background: #f8514933;
          color: #f85149;
        }

        .handler-config-editor {
          padding: 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          margin-left: 28px;
        }

        .config-field {
          margin-bottom: 8px;
        }

        .config-field:last-child {
          margin-bottom: 0;
        }

        .config-field label {
          display: block;
          font-size: 11px;
          color: #8b949e;
          margin-bottom: 4px;
        }

        .config-field input {
          width: 100%;
          padding: 8px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #c9d1d9;
          font-size: 13px;
          box-sizing: border-box;
        }

        .pipe-arrow {
          display: flex;
          justify-content: center;
          padding: 4px 0;
          color: #484f58;
        }

        .add-handler-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: #21262d;
          border: 1px dashed #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          font-size: 13px;
        }

        .add-handler-btn:hover {
          background: #30363d;
          border-style: solid;
          color: #c9d1d9;
        }

        .handler-picker-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .handler-picker {
          width: 500px;
          max-height: 80vh;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .picker-header {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-bottom: 1px solid #30363d;
        }

        .picker-header input {
          flex: 1;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 14px;
          outline: none;
        }

        .picker-header input:focus {
          border-color: #58a6ff;
        }

        .close-picker {
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 8px;
        }

        .picker-body {
          flex: 1;
          overflow-y: auto;
        }

        .picker-category {
          border-bottom: 1px solid #21262d;
        }

        .category-name {
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

        .category-handlers {
          display: flex;
          flex-direction: column;
        }

        .picker-handler {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 10px 12px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
          width: 100%;
        }

        .picker-handler:hover {
          background: #21262d;
        }

        .picker-handler .handler-name {
          font-size: 13px;
        }

        .picker-handler .handler-desc {
          font-size: 11px;
          color: #6e7681;
        }
      `}</style>
    </div>
  )
}

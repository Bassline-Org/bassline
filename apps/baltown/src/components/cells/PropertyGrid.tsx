import { createSignal, Show, For, createMemo } from 'solid-js'
import { useBassline } from '@bassline/solid'

interface PropertyGridProps {
  uri: string
  value: Record<string, any>
  label?: string
  editable?: boolean
  maxDepth?: number
}

/**
 * PropertyGrid - Key-value editor for object lattice
 *
 * Shows object properties with inline editing and nested expansion.
 */
export default function PropertyGrid(props: PropertyGridProps) {
  const bl = useBassline()
  const [editingKey, setEditingKey] = createSignal<string | null>(null)
  const [editValue, setEditValue] = createSignal('')
  const [newKey, setNewKey] = createSignal('')
  const [newValue, setNewValue] = createSignal('')
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set())
  const [saving, setSaving] = createSignal(false)

  // Get entries from value
  const entries = createMemo(() => {
    const val = props.value
    if (!val || typeof val !== 'object') return []
    return Object.entries(val)
  })

  // Toggle expansion of nested object
  function toggleExpand(key: string) {
    const exp = new Set(expanded())
    if (exp.has(key)) {
      exp.delete(key)
    } else {
      exp.add(key)
    }
    setExpanded(exp)
  }

  // Get type indicator for a value
  function getTypeIndicator(val: any): string {
    if (val === null) return 'null'
    if (val === undefined) return 'undefined'
    if (Array.isArray(val)) return `array[${val.length}]`
    if (typeof val === 'object') return `object{${Object.keys(val).length}}`
    return typeof val
  }

  // Format value for display
  function formatValue(val: any): string {
    if (val === null) return 'null'
    if (val === undefined) return 'undefined'
    if (typeof val === 'string') return `"${val}"`
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  // Start editing a key
  function startEdit(key: string, value: any) {
    if (props.editable === false) return
    setEditingKey(key)
    setEditValue(typeof value === 'object' ? JSON.stringify(value) : String(value))
  }

  // Save edited value
  async function saveEdit() {
    const key = editingKey()
    if (!key) return

    setSaving(true)
    try {
      let value: any = editValue()

      // Try to parse as JSON
      try {
        value = JSON.parse(value)
      } catch {
        // Keep as string if not valid JSON
      }

      // Merge with existing object
      const newObj = { ...props.value, [key]: value }
      await bl.put(`${props.uri}/value`, {}, newObj)
      setEditingKey(null)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  // Add new property
  async function addProperty() {
    const key = newKey().trim()
    if (!key) return

    setSaving(true)
    try {
      let value: any = newValue()
      try {
        value = JSON.parse(value)
      } catch {}

      const newObj = { ...props.value, [key]: value }
      await bl.put(`${props.uri}/value`, {}, newObj)
      setNewKey('')
      setNewValue('')
    } catch (err) {
      console.error('Failed to add property:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="property-grid">
      <Show when={props.label}>
        <div class="grid-label">{props.label}</div>
      </Show>

      <div class="grid-header">
        <span class="grid-count">{entries().length} properties</span>
        <span class="grid-type">object (shallow merge)</span>
      </div>

      <Show when={entries().length === 0}>
        <div class="grid-empty">No properties. Add some below.</div>
      </Show>

      <div class="grid-entries">
        <For each={entries()}>
          {([key, value]) => {
            const isObject = typeof value === 'object' && value !== null
            const isExpanded = () => expanded().has(key)

            return (
              <div class="grid-entry">
                <div class="entry-row">
                  <Show when={isObject}>
                    <button class="expand-btn" onClick={() => toggleExpand(key)}>
                      {isExpanded() ? '▼' : '▶'}
                    </button>
                  </Show>

                  <span class="entry-key">{key}</span>
                  <span class="entry-type">{getTypeIndicator(value)}</span>

                  <Show when={editingKey() !== key}>
                    <span class="entry-value" onClick={() => startEdit(key, value)}>
                      {formatValue(value)}
                    </span>
                  </Show>

                  <Show when={editingKey() === key}>
                    <input
                      type="text"
                      class="entry-input"
                      value={editValue()}
                      onInput={(e) => setEditValue(e.currentTarget.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') setEditingKey(null)
                      }}
                      autofocus
                    />
                    <button class="entry-btn save" onClick={saveEdit} disabled={saving()}>
                      Save
                    </button>
                    <button class="entry-btn cancel" onClick={() => setEditingKey(null)}>
                      Cancel
                    </button>
                  </Show>
                </div>

                <Show when={isObject && isExpanded()}>
                  <div class="entry-nested">
                    <pre class="nested-json">{JSON.stringify(value, null, 2)}</pre>
                  </div>
                </Show>
              </div>
            )
          }}
        </For>
      </div>

      <Show when={props.editable !== false}>
        <div class="grid-add">
          <input
            type="text"
            class="add-key"
            placeholder="Key"
            value={newKey()}
            onInput={(e) => setNewKey(e.currentTarget.value)}
          />
          <input
            type="text"
            class="add-value"
            placeholder="Value (JSON or string)"
            value={newValue()}
            onInput={(e) => setNewValue(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && addProperty()}
          />
          <button class="add-btn" onClick={addProperty} disabled={saving() || !newKey().trim()}>
            Add
          </button>
        </div>
      </Show>

      <style>{`
        .property-grid {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .grid-label {
          font-size: 12px;
          color: #8b949e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .grid-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .grid-count {
          color: #c9d1d9;
          font-weight: 600;
        }

        .grid-type {
          color: #8b949e;
          font-style: italic;
        }

        .grid-empty {
          padding: 20px;
          text-align: center;
          color: #8b949e;
          font-size: 13px;
          background: #0d1117;
          border-radius: 6px;
        }

        .grid-entries {
          background: #0d1117;
          border-radius: 6px;
          overflow: hidden;
        }

        .grid-entry {
          border-bottom: 1px solid #21262d;
        }

        .grid-entry:last-child {
          border-bottom: none;
        }

        .entry-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
        }

        .expand-btn {
          width: 16px;
          height: 16px;
          padding: 0;
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          font-size: 10px;
        }

        .entry-key {
          font-family: monospace;
          font-size: 13px;
          color: #79c0ff;
          min-width: 80px;
        }

        .entry-type {
          font-size: 10px;
          color: #8b949e;
          background: #21262d;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .entry-value {
          flex: 1;
          font-family: monospace;
          font-size: 13px;
          color: #c9d1d9;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
          transition: background 0.15s ease;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .entry-value:hover {
          background: #21262d;
        }

        .entry-input {
          flex: 1;
          padding: 4px 8px;
          background: #161b22;
          border: 1px solid #58a6ff;
          border-radius: 4px;
          color: #c9d1d9;
          font-family: monospace;
          font-size: 13px;
        }

        .entry-btn {
          padding: 4px 10px;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .entry-btn.save {
          background: #238636;
          color: white;
        }

        .entry-btn.cancel {
          background: #21262d;
          color: #c9d1d9;
        }

        .entry-nested {
          padding: 0 12px 12px 36px;
        }

        .nested-json {
          margin: 0;
          padding: 12px;
          background: #161b22;
          border-radius: 4px;
          font-size: 11px;
          color: #8b949e;
          overflow-x: auto;
        }

        .grid-add {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .add-key {
          width: 100px;
          padding: 8px 10px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .add-value {
          flex: 1;
          padding: 8px 10px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .add-btn {
          padding: 8px 16px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }

        .add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

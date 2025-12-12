import { createSignal, Show } from 'solid-js'
import { useBassline } from '@bassline/solid'

interface EditableFieldProps {
  uri: string
  value: any
  label?: string
  timestamp?: string | number
  placeholder?: string
}

/**
 * EditableField - Editable field for LWW (Last-Writer-Wins) lattice
 *
 * Shows current value with timestamp and allows inline editing.
 */
export default function EditableField(props: EditableFieldProps) {
  const bl = useBassline()
  const [editing, setEditing] = createSignal(false)
  const [editValue, setEditValue] = createSignal('')
  const [saving, setSaving] = createSignal(false)
  const [showHistory, setShowHistory] = createSignal(false)

  // Format timestamp
  const formattedTime = () => {
    if (!props.timestamp) return null
    const date = new Date(props.timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }

  // Get display value
  const displayValue = () => {
    const val = props.value
    if (val === null || val === undefined) return ''

    // LWW wraps values in {value, timestamp}
    if (typeof val === 'object' && 'value' in val) {
      return typeof val.value === 'object' ? JSON.stringify(val.value) : String(val.value)
    }

    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  }

  // Start editing
  function startEdit() {
    setEditValue(displayValue())
    setEditing(true)
  }

  // Cancel editing
  function cancelEdit() {
    setEditing(false)
    setEditValue('')
  }

  // Save value
  async function saveValue() {
    setSaving(true)
    try {
      let value: any = editValue()

      // Try to parse as JSON if it looks like JSON
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          value = JSON.parse(value)
        } catch {}
      } else if (value === 'true') {
        value = true
      } else if (value === 'false') {
        value = false
      } else if (!isNaN(Number(value)) && value !== '') {
        value = Number(value)
      }

      await bl.put(`${props.uri}/value`, {}, value)
      setEditing(false)
    } catch (err) {
      console.error('Failed to save:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div class="editable-field">
      <Show when={props.label}>
        <div class="field-label">{props.label}</div>
      </Show>

      <Show when={!editing()}>
        <div class="field-display" onClick={startEdit}>
          <Show
            when={displayValue()}
            fallback={
              <span class="field-placeholder">{props.placeholder || 'Click to edit...'}</span>
            }
          >
            <span class="field-value">{displayValue()}</span>
          </Show>
          <span class="field-edit-icon">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </span>
        </div>
      </Show>

      <Show when={editing()}>
        <div class="field-edit">
          <input
            type="text"
            class="field-input"
            value={editValue()}
            onInput={(e) => setEditValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveValue()
              if (e.key === 'Escape') cancelEdit()
            }}
            autofocus
          />
          <div class="field-actions">
            <button class="field-btn save" onClick={saveValue} disabled={saving()}>
              {saving() ? '...' : 'Save'}
            </button>
            <button class="field-btn cancel" onClick={cancelEdit} disabled={saving()}>
              Cancel
            </button>
          </div>
        </div>
      </Show>

      <div class="field-meta">
        <span class="field-type">lww (last-writer-wins)</span>
        <Show when={formattedTime()}>
          <span class="field-timestamp" title={props.timestamp?.toString()}>
            Updated {formattedTime()}
          </span>
        </Show>
      </div>

      <style>{`
        .editable-field {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .field-label {
          font-size: 12px;
          color: #8b949e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .field-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }

        .field-display:hover {
          border-color: #58a6ff;
        }

        .field-value {
          font-size: 16px;
          color: #c9d1d9;
          word-break: break-all;
        }

        .field-placeholder {
          font-size: 14px;
          color: #8b949e;
          font-style: italic;
        }

        .field-edit-icon {
          color: #8b949e;
          opacity: 0;
          transition: opacity 0.15s ease;
        }

        .field-display:hover .field-edit-icon {
          opacity: 1;
        }

        .field-edit {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .field-input {
          padding: 12px 16px;
          background: #0d1117;
          border: 2px solid #58a6ff;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 16px;
          outline: none;
        }

        .field-actions {
          display: flex;
          gap: 8px;
        }

        .field-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .field-btn.save {
          background: #238636;
          color: white;
        }

        .field-btn.save:hover:not(:disabled) {
          background: #2ea043;
        }

        .field-btn.cancel {
          background: #21262d;
          color: #c9d1d9;
        }

        .field-btn.cancel:hover:not(:disabled) {
          background: #30363d;
        }

        .field-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .field-meta {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          font-size: 11px;
          color: #8b949e;
        }

        .field-type {
          font-style: italic;
        }

        .field-timestamp {
          color: #3fb950;
        }
      `}</style>
    </div>
  )
}

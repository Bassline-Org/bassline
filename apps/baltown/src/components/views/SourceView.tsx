import { createSignal, Show, createMemo } from 'solid-js'

interface SourceViewProps {
  data: any
  editable?: boolean
  onSave?: (data: any) => void
}

/**
 * SourceView - Raw JSON source with syntax highlighting
 */
export default function SourceView(props: SourceViewProps) {
  const [editing, setEditing] = createSignal(false)
  const [editValue, setEditValue] = createSignal('')
  const [error, setError] = createSignal<string | null>(null)
  const [copied, setCopied] = createSignal(false)

  // Format JSON with syntax highlighting
  const formattedJSON = createMemo(() => {
    try {
      const json = JSON.stringify(props.data, null, 2)
      return highlightJSON(json)
    } catch {
      return String(props.data)
    }
  })

  // Plain JSON for editing
  const plainJSON = createMemo(() => {
    try {
      return JSON.stringify(props.data, null, 2)
    } catch {
      return String(props.data)
    }
  })

  function startEditing() {
    setEditValue(plainJSON())
    setEditing(true)
    setError(null)
  }

  function cancelEditing() {
    setEditing(false)
    setError(null)
  }

  function saveChanges() {
    try {
      const parsed = JSON.parse(editValue())
      props.onSave?.(parsed)
      setEditing(false)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(plainJSON())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  function downloadJSON() {
    const blob = new Blob([plainJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'source.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div class="source-view">
      <div class="source-header">
        <span class="source-label">JSON Source</span>
        <div class="source-actions">
          <button
            class="action-btn"
            onClick={copyToClipboard}
            title="Copy to clipboard"
          >
            <Show when={copied()} fallback={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            }>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </Show>
          </button>
          <button
            class="action-btn"
            onClick={downloadJSON}
            title="Download JSON"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <Show when={props.editable && !editing()}>
            <button
              class="action-btn edit"
              onClick={startEditing}
              title="Edit source"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </Show>
        </div>
      </div>

      <Show when={!editing()}>
        <div class="source-content">
          <pre innerHTML={formattedJSON()} />
        </div>
      </Show>

      <Show when={editing()}>
        <div class="source-editor">
          <textarea
            class={`editor-textarea ${error() ? 'has-error' : ''}`}
            value={editValue()}
            onInput={(e) => {
              setEditValue(e.currentTarget.value)
              setError(null)
            }}
            spellcheck={false}
          />
          <Show when={error()}>
            <div class="editor-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              {error()}
            </div>
          </Show>
          <div class="editor-actions">
            <button class="btn save" onClick={saveChanges}>Save Changes</button>
            <button class="btn cancel" onClick={cancelEditing}>Cancel</button>
          </div>
        </div>
      </Show>

      <style>{`
        .source-view {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .source-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #21262d;
          border-bottom: 1px solid #30363d;
        }

        .source-label {
          font-size: 12px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .source-actions {
          display: flex;
          gap: 4px;
        }

        .action-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
        }

        .action-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .action-btn.edit {
          color: #58a6ff;
        }

        .source-content {
          max-height: 600px;
          overflow: auto;
        }

        .source-content pre {
          margin: 0;
          padding: 16px;
          font-family: monospace;
          font-size: 13px;
          line-height: 1.5;
          color: #c9d1d9;
          white-space: pre-wrap;
          word-break: break-all;
        }

        /* Syntax highlighting classes */
        .source-content pre :global(.json-key) {
          color: #79c0ff;
        }

        .source-content pre :global(.json-string) {
          color: #a5d6ff;
        }

        .source-content pre :global(.json-number) {
          color: #ffa657;
        }

        .source-content pre :global(.json-boolean) {
          color: #ff7b72;
        }

        .source-content pre :global(.json-null) {
          color: #ff7b72;
        }

        .source-content pre :global(.json-bracket) {
          color: #8b949e;
        }

        .source-editor {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
        }

        .editor-textarea {
          width: 100%;
          min-height: 400px;
          padding: 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-family: monospace;
          font-size: 13px;
          line-height: 1.5;
          resize: vertical;
          outline: none;
          box-sizing: border-box;
        }

        .editor-textarea:focus {
          border-color: #58a6ff;
        }

        .editor-textarea.has-error {
          border-color: #f85149;
        }

        .editor-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 6px;
          color: #f85149;
          font-size: 12px;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 8px 16px;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn.save {
          background: #238636;
          color: white;
        }

        .btn.save:hover {
          background: #2ea043;
        }

        .btn.cancel {
          background: #21262d;
          color: #c9d1d9;
        }

        .btn.cancel:hover {
          background: #30363d;
        }
      `}</style>
    </div>
  )
}

// Simple JSON syntax highlighting
function highlightJSON(json: string): string {
  return json
    // Keys (before colon)
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    // String values (after colon or in arrays)
    .replace(/: "([^"]*)"([,\n\]}])/g, ': <span class="json-string">"$1"</span>$2')
    .replace(/\["([^"]*)"/g, '[<span class="json-string">"$1"</span>')
    .replace(/, "([^"]*)"/g, ', <span class="json-string">"$1"</span>')
    // Numbers
    .replace(/: (\d+\.?\d*)([,\n\]}])/g, ': <span class="json-number">$1</span>$2')
    // Booleans
    .replace(/: (true|false)([,\n\]}])/g, ': <span class="json-boolean">$1</span>$2')
    // Null
    .replace(/: (null)([,\n\]}])/g, ': <span class="json-null">$1</span>$2')
    // Brackets
    .replace(/([{}\[\]])/g, '<span class="json-bracket">$1</span>')
}

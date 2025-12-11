import { Show, For, createMemo, createSignal } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { ConfigDispatcher } from '../handlers'

interface NodeData {
  id: string
  type: 'cell' | 'propagator'
  uri: string
  name: string
  // Cell-specific
  lattice?: string
  value?: any
  // Propagator-specific
  handler?: string | any[]
  inputs?: string[]
  output?: string
}

interface InspectorPanelProps {
  node: NodeData | null
  onClose: () => void
  onUpdate?: (updates: Partial<NodeData>) => void
  onDelete?: () => void
}

/**
 * InspectorPanel - Node detail editing sidebar
 */
export default function InspectorPanel(props: InspectorPanelProps) {
  const bl = useBassline()

  // State for operations
  const [updating, setUpdating] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  // Handler name for propagator
  const handlerName = createMemo(() => {
    const h = props.node?.handler
    if (!h) return ''
    if (typeof h === 'string') return h
    if (Array.isArray(h)) return h[0]
    return 'custom'
  })

  // Handler config for propagator
  const handlerConfig = createMemo(() => {
    const h = props.node?.handler
    if (!h || typeof h === 'string') return {}
    if (Array.isArray(h) && h.length > 1) return h[1]
    return {}
  })

  // Format value for display
  const displayValue = createMemo(() => {
    const v = props.node?.value
    if (v === undefined || v === null) return '—'
    if (typeof v === 'object') {
      if ('value' in v) return JSON.stringify(v.value, null, 2)
      return JSON.stringify(v, null, 2)
    }
    return String(v)
  })

  // Update cell lattice type
  async function updateCellLattice(lattice: string) {
    if (!props.node || props.node.type !== 'cell') return

    setUpdating(true)
    setError(null)

    try {
      await bl.put(props.node.uri, {}, { lattice })
      props.onUpdate?.({ lattice })
    } catch (err) {
      console.error('Failed to update cell lattice:', err)
      setError(`Failed to update lattice: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  // Update propagator handler config
  async function updatePropagatorConfig(config: any) {
    if (!props.node || props.node.type !== 'propagator') return

    setUpdating(true)
    setError(null)

    try {
      // Build the updated propagator body
      const body = {
        inputs: props.node.inputs || [],
        output: props.node.output,
        handler: handlerName(),
        handlerConfig: config
      }

      await bl.put(props.node.uri, {}, body)

      // Update local state with new handler format
      const newHandler = [handlerName(), config]
      props.onUpdate?.({ handler: newHandler })
    } catch (err) {
      console.error('Failed to update propagator:', err)
      setError(`Failed to update propagator: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  // Delete node (cell or propagator)
  function deleteNode() {
    // Delegate to parent's delete handler
    props.onDelete?.()
  }

  return (
    <div class={`inspector-panel ${props.node ? 'open' : ''}`}>
      <Show when={props.node}>
        <div class="inspector-header">
          <div class="header-info">
            <span class={`node-type ${props.node!.type}`}>
              {props.node!.type}
            </span>
            <h3 class="node-name">{props.node!.name}</h3>
          </div>
          <button class="close-btn" onClick={props.onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="inspector-body">
          {/* Error message */}
          <Show when={error()}>
            <div class="error-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 8v4M12 16h.01"/>
              </svg>
              <span>{error()}</span>
              <button class="error-close" onClick={() => setError(null)}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </Show>

          {/* URI */}
          <div class="field">
            <label>URI</label>
            <div class="uri-display">
              <code>{props.node!.uri}</code>
              <button class="copy-btn" title="Copy URI">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Cell-specific fields */}
          <Show when={props.node!.type === 'cell'}>
            <div class="field">
              <label>Lattice Type</label>
              <select
                value={props.node!.lattice ?? 'lww'}
                onChange={(e) => updateCellLattice(e.currentTarget.value)}
                disabled={updating()}
              >
                <option value="counter">counter</option>
                <option value="maxNumber">maxNumber</option>
                <option value="minNumber">minNumber</option>
                <option value="setUnion">setUnion</option>
                <option value="lww">lww</option>
                <option value="boolean">boolean</option>
                <option value="object">object</option>
              </select>
            </div>

            <div class="field">
              <label>Current Value</label>
              <pre class="value-display">{displayValue()}</pre>
            </div>
          </Show>

          {/* Propagator-specific fields */}
          <Show when={props.node!.type === 'propagator'}>
            <div class="field">
              <label>Handler</label>
              <div class="handler-info">
                <span class="handler-name">{handlerName()}</span>
              </div>
            </div>

            <Show when={Object.keys(handlerConfig()).length > 0}>
              <div class="field">
                <label>Handler Config</label>
                <ConfigDispatcher
                  handler={handlerName()}
                  config={handlerConfig()}
                  onChange={(config) => updatePropagatorConfig(config)}
                />
              </div>
            </Show>

            <div class="field">
              <label>Inputs</label>
              <div class="input-list">
                <For each={props.node!.inputs ?? []}>
                  {(input) => (
                    <div class="input-item">
                      <span class="input-uri">{input.split('/').pop()}</span>
                    </div>
                  )}
                </For>
                <Show when={!props.node!.inputs?.length}>
                  <span class="empty">No inputs</span>
                </Show>
              </div>
            </div>

            <div class="field">
              <label>Output</label>
              <div class="output-display">
                <Show when={props.node!.output}>
                  <span class="output-uri">{props.node!.output?.split('/').pop()}</span>
                </Show>
                <Show when={!props.node!.output}>
                  <span class="empty">No output</span>
                </Show>
              </div>
            </div>
          </Show>
        </div>

        <div class="inspector-footer">
          <button class="delete-btn" onClick={deleteNode} disabled={updating()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
            Delete
          </button>
        </div>
      </Show>

      <style>{`
        .inspector-panel {
          position: absolute;
          top: 0;
          right: -300px;
          width: 300px;
          height: 100%;
          background: #161b22;
          border-left: 1px solid #30363d;
          display: flex;
          flex-direction: column;
          transition: right 0.2s ease;
          z-index: 200;
        }

        .inspector-panel.open {
          right: 0;
        }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #f8514922;
          border: 1px solid #f85149;
          border-radius: 6px;
          color: #f85149;
          font-size: 12px;
          margin-bottom: 16px;
        }

        .error-banner svg {
          flex-shrink: 0;
        }

        .error-banner span {
          flex: 1;
          line-height: 1.4;
        }

        .error-close {
          background: none;
          border: none;
          color: #f85149;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .error-close:hover {
          opacity: 0.8;
        }

        .inspector-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 16px;
          border-bottom: 1px solid #30363d;
        }

        .header-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .node-type {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .node-type.cell {
          background: #388bfd22;
          color: #58a6ff;
        }

        .node-type.propagator {
          background: #f0883e22;
          color: #f0883e;
        }

        .node-name {
          margin: 0;
          font-size: 16px;
          color: #c9d1d9;
        }

        .close-btn {
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 4px;
        }

        .close-btn:hover {
          color: #c9d1d9;
        }

        .inspector-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 11px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .uri-display {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .uri-display code {
          flex: 1;
          padding: 8px;
          background: #0d1117;
          border-radius: 4px;
          font-size: 11px;
          color: #79c0ff;
          word-break: break-all;
        }

        .copy-btn {
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 4px;
        }

        .field select {
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          outline: none;
          cursor: pointer;
        }

        .field select:focus {
          border-color: #58a6ff;
        }

        .field select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .value-display {
          padding: 12px;
          background: #0d1117;
          border-radius: 6px;
          font-size: 12px;
          color: #3fb950;
          margin: 0;
          max-height: 150px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .handler-info {
          padding: 8px 12px;
          background: #0d1117;
          border-radius: 6px;
        }

        .handler-name {
          font-family: monospace;
          color: #f0883e;
        }

        .input-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .input-item {
          padding: 6px 10px;
          background: #0d1117;
          border-radius: 4px;
        }

        .input-uri, .output-uri {
          font-family: monospace;
          font-size: 12px;
          color: #58a6ff;
        }

        .output-display {
          padding: 8px 12px;
          background: #0d1117;
          border-radius: 6px;
        }

        .output-uri {
          color: #3fb950;
        }

        .empty {
          color: #6e7681;
          font-size: 12px;
          font-style: italic;
        }

        .inspector-footer {
          padding: 16px;
          border-top: 1px solid #30363d;
        }

        .delete-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 10px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          font-size: 13px;
          justify-content: center;
        }

        .delete-btn:hover {
          background: #f8514933;
          color: #f85149;
          border-color: #f85149;
        }
      `}</style>
    </div>
  )
}

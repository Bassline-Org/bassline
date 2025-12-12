import { Show, createMemo, createSignal, createEffect } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { selectionStore } from '../../stores/selection'
import { useToast } from '../../context/ToastContext'
import { ConfigDispatcher } from '../handlers'
import HiccupComposer from '../HiccupComposer'

type HiccupNode = string | [string, ...any[]]

interface WorkbenchInspectorProps {
  onUpdate: () => void
  onHandlerUpdate?: (uri: string, handler: HiccupNode) => void
  onHandlerDelete?: (uri: string) => void
}

/**
 * WorkbenchInspector - Right panel showing details of selected resource
 *
 * Shows different content based on selection:
 * - Nothing: Tips and help
 * - Cell: Value editor, lattice info
 * - Propagator: Handler config, inputs/outputs
 */
export default function WorkbenchInspector(props: WorkbenchInspectorProps) {
  const bl = useBassline()
  const { toast } = useToast()
  const { primarySelection, hasSelection, clearSelection } = selectionStore

  const [updating, setUpdating] = createSignal(false)
  const [cellValue, setCellValue] = createSignal('')
  const [handlerComposition, setHandlerComposition] = createSignal<HiccupNode>('identity')

  // Sync handler composition when selection changes
  createEffect(() => {
    const sel = primarySelection()
    if (sel?.type === 'handler' && sel.data?.handler) {
      setHandlerComposition(sel.data.handler)
    }
  })

  // Handler name for propagator
  const handlerName = createMemo(() => {
    const sel = primarySelection()
    if (!sel || sel.type !== 'propagator') return ''
    const h = sel.data?.handler
    if (!h) return ''
    if (typeof h === 'string') return h
    if (Array.isArray(h)) return h[0]
    return 'custom'
  })

  // Handler config for propagator
  const handlerConfig = createMemo(() => {
    const sel = primarySelection()
    if (!sel || sel.type !== 'propagator') return {}
    const h = sel.data?.handler
    if (!h || typeof h === 'string') return {}
    if (Array.isArray(h) && h.length > 1) return h[1]
    return {}
  })

  // Display value for cell
  const displayValue = createMemo(() => {
    const sel = primarySelection()
    if (!sel || sel.type !== 'cell') return '—'
    const v = sel.data?.value
    if (v === undefined || v === null) return '—'
    if (typeof v === 'object') {
      if ('value' in v) return JSON.stringify(v.value, null, 2)
      return JSON.stringify(v, null, 2)
    }
    return String(v)
  })

  // Update cell value
  async function updateCellValue() {
    const sel = primarySelection()
    if (!sel || sel.type !== 'cell') return

    const valueStr = cellValue().trim()
    if (!valueStr) return

    setUpdating(true)
    try {
      // Try to parse as JSON, fallback to string
      let value: any
      try {
        value = JSON.parse(valueStr)
      } catch {
        value = valueStr
      }

      await bl.put(`${sel.uri}/value`, {}, value)
      toast.success('Value updated')
      setCellValue('')
      props.onUpdate()
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  // Update propagator config
  async function updatePropagatorConfig(config: any) {
    const sel = primarySelection()
    if (!sel || sel.type !== 'propagator') return

    setUpdating(true)
    try {
      const body = {
        inputs: sel.data?.inputs || [],
        output: sel.data?.output,
        handler: handlerName(),
        handlerConfig: config,
      }

      await bl.put(sel.uri, {}, body)
      toast.success('Propagator updated')
      props.onUpdate()
    } catch (err) {
      toast.error(`Failed to update: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  // Delete selected resource
  async function deleteSelected() {
    const sel = primarySelection()
    if (!sel) return

    if (!confirm(`Delete ${sel.name}?`)) return

    // Handler nodes are local (not persisted), use callback
    if (sel.type === 'handler') {
      props.onHandlerDelete?.(sel.uri)
      toast.success(`Handler "${sel.name}" removed`)
      clearSelection()
      return
    }

    setUpdating(true)
    try {
      await bl.put(`${sel.uri}/kill`, {}, {})
      toast.success(`${sel.name} deleted`)
      clearSelection()
      props.onUpdate()
    } catch (err) {
      toast.error(`Failed to delete: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <aside class="workbench-inspector">
      <div class="inspector-header">
        <h2>Inspector</h2>
        <Show when={hasSelection()}>
          <button class="close-btn" onClick={clearSelection}>
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
        </Show>
      </div>

      <div class="inspector-content">
        {/* Nothing selected */}
        <Show when={!hasSelection()}>
          <div class="inspector-empty">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <h3>No Selection</h3>
            <p>Click on a resource in the graph to inspect it.</p>
          </div>
        </Show>

        {/* Cell selected */}
        <Show when={primarySelection()?.type === 'cell'}>
          <div class="inspector-section">
            <div class="selection-header">
              <span class="type-badge cell">CELL</span>
              <h3>{primarySelection()?.name}</h3>
            </div>

            <div class="field">
              <label>URI</label>
              <code class="uri-display">{primarySelection()?.uri}</code>
            </div>

            <div class="field">
              <label>Lattice</label>
              <span class="lattice-badge">{primarySelection()?.data?.lattice || 'lww'}</span>
            </div>

            <div class="field">
              <label>Current Value</label>
              <pre class="value-display">{displayValue()}</pre>
            </div>

            <div class="field">
              <label>Set New Value</label>
              <div class="input-group">
                <input
                  type="text"
                  value={cellValue()}
                  onInput={(e) => setCellValue(e.currentTarget.value)}
                  placeholder="Enter value (JSON or string)"
                  disabled={updating()}
                  onKeyPress={(e) => e.key === 'Enter' && updateCellValue()}
                />
                <button
                  class="update-btn"
                  onClick={updateCellValue}
                  disabled={updating() || !cellValue().trim()}
                >
                  Set
                </button>
              </div>
            </div>
          </div>
        </Show>

        {/* Propagator selected */}
        <Show when={primarySelection()?.type === 'propagator'}>
          <div class="inspector-section">
            <div class="selection-header">
              <span class="type-badge propagator">PROPAGATOR</span>
              <h3>{primarySelection()?.name}</h3>
            </div>

            <div class="field">
              <label>URI</label>
              <code class="uri-display">{primarySelection()?.uri}</code>
            </div>

            <div class="field">
              <label>Handler</label>
              <span class="handler-badge">{handlerName()}</span>
            </div>

            <Show when={Object.keys(handlerConfig()).length > 0}>
              <div class="field">
                <label>Handler Config</label>
                <ConfigDispatcher
                  handler={handlerName()}
                  config={handlerConfig()}
                  onChange={updatePropagatorConfig}
                />
              </div>
            </Show>

            <div class="field">
              <label>Inputs</label>
              <div class="uri-list">
                <Show when={primarySelection()?.data?.inputs?.length}>
                  {primarySelection()?.data?.inputs?.map((uri: string) => (
                    <code class="uri-item">{uri.split('/').pop()}</code>
                  ))}
                </Show>
                <Show when={!primarySelection()?.data?.inputs?.length}>
                  <span class="empty-text">No inputs</span>
                </Show>
              </div>
            </div>

            <div class="field">
              <label>Output</label>
              <Show when={primarySelection()?.data?.output}>
                <code class="uri-item output">
                  {primarySelection()?.data?.output?.split('/').pop()}
                </code>
              </Show>
              <Show when={!primarySelection()?.data?.output}>
                <span class="empty-text">No output</span>
              </Show>
            </div>
          </div>
        </Show>

        {/* Handler node selected */}
        <Show when={primarySelection()?.type === 'handler'}>
          <div class="inspector-section">
            <div class="selection-header">
              <span class="type-badge handler">HANDLER</span>
              <h3>{primarySelection()?.name}</h3>
            </div>

            <div class="field">
              <label>URI</label>
              <code class="uri-display">{primarySelection()?.uri}</code>
            </div>

            <div class="field">
              <label>Handler Composition</label>
              <p class="help-text">
                Configure the handler for this node. Connect it to cells to create a propagator.
              </p>
              <div class="handler-composer-wrapper">
                <HiccupComposer
                  value={handlerComposition()}
                  onChange={(newHandler) => {
                    setHandlerComposition(newHandler)
                    const sel = primarySelection()
                    if (sel) {
                      props.onHandlerUpdate?.(sel.uri, newHandler)
                    }
                  }}
                />
              </div>
            </div>

            <div class="field">
              <label>Status</label>
              <div class="handler-status">
                <Show
                  when={
                    !primarySelection()?.data?.inputConnections?.length &&
                    !primarySelection()?.data?.outputConnection
                  }
                >
                  <span class="status-badge incomplete">Incomplete - Connect cells to use</span>
                </Show>
                <Show
                  when={
                    primarySelection()?.data?.inputConnections?.length &&
                    !primarySelection()?.data?.outputConnection
                  }
                >
                  <span class="status-badge partial">Has inputs - Needs output cell</span>
                </Show>
                <Show
                  when={
                    !primarySelection()?.data?.inputConnections?.length &&
                    primarySelection()?.data?.outputConnection
                  }
                >
                  <span class="status-badge partial">Has output - Needs input cell</span>
                </Show>
                <Show
                  when={
                    primarySelection()?.data?.inputConnections?.length &&
                    primarySelection()?.data?.outputConnection
                  }
                >
                  <span class="status-badge ready">Ready to promote</span>
                </Show>
              </div>
            </div>
          </div>
        </Show>

        {/* Delete action */}
        <Show when={hasSelection()}>
          <div class="inspector-footer">
            <button class="delete-btn" onClick={deleteSelected} disabled={updating()}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </Show>
      </div>

      <style>{`
        .workbench-inspector {
          width: 380px;
          min-width: 380px;
          background: #161b22;
          border-left: 1px solid #30363d;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .inspector-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #30363d;
        }

        .inspector-header h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .close-btn {
          padding: 4px;
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .close-btn:hover {
          background: #21262d;
          color: #c9d1d9;
        }

        .inspector-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .inspector-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
        }

        .inspector-empty svg {
          color: #30363d;
          margin-bottom: 16px;
        }

        .inspector-empty h3 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #c9d1d9;
        }

        .inspector-empty p {
          margin: 0;
          font-size: 12px;
          color: #8b949e;
        }

        .inspector-section {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .selection-header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .selection-header h3 {
          margin: 0;
          font-size: 16px;
          color: #c9d1d9;
        }

        .type-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
        }

        .type-badge.cell {
          background: #388bfd22;
          color: #58a6ff;
        }

        .type-badge.propagator {
          background: #f0883e22;
          color: #f0883e;
        }

        .type-badge.handler {
          background: #f0883e22;
          color: #f0883e;
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
          padding: 8px;
          background: #0d1117;
          border-radius: 6px;
          font-size: 11px;
          color: #79c0ff;
          word-break: break-all;
        }

        .lattice-badge,
        .handler-badge {
          padding: 6px 10px;
          background: #0d1117;
          border-radius: 6px;
          font-size: 12px;
          font-family: monospace;
          width: fit-content;
        }

        .lattice-badge {
          color: #58a6ff;
        }

        .handler-badge {
          color: #f0883e;
        }

        .value-display {
          padding: 12px;
          background: #0d1117;
          border-radius: 6px;
          font-size: 12px;
          color: #3fb950;
          margin: 0;
          max-height: 120px;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .input-group {
          display: flex;
          gap: 8px;
        }

        .input-group input {
          flex: 1;
          padding: 8px 10px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .input-group input:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .update-btn {
          padding: 8px 16px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
        }

        .update-btn:hover:not(:disabled) {
          background: #2ea043;
        }

        .update-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .uri-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .uri-item {
          padding: 4px 8px;
          background: #0d1117;
          border-radius: 4px;
          font-size: 11px;
          color: #58a6ff;
        }

        .uri-item.output {
          color: #3fb950;
        }

        .empty-text {
          font-size: 12px;
          color: #6e7681;
          font-style: italic;
        }

        .inspector-footer {
          padding: 16px;
          border-top: 1px solid #30363d;
        }

        .delete-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 10px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 13px;
          cursor: pointer;
        }

        .delete-btn:hover:not(:disabled) {
          background: #f8514933;
          color: #f85149;
          border-color: #f85149;
        }

        .delete-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .help-text {
          margin: 0 0 8px 0;
          font-size: 11px;
          color: #8b949e;
          line-height: 1.4;
        }

        .handler-composer-wrapper {
          min-height: 200px;
          border: 1px solid #30363d;
          border-radius: 6px;
          position: relative;
        }

        .handler-status {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.incomplete {
          background: #f0883e22;
          color: #f0883e;
        }

        .status-badge.partial {
          background: #58a6ff22;
          color: #58a6ff;
        }

        .status-badge.ready {
          background: #3fb95022;
          color: #3fb950;
        }
      `}</style>
    </aside>
  )
}

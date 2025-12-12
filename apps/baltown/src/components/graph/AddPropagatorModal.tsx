import { createSignal, createMemo, Show, For } from 'solid-js'
import { useBassline, useResource } from '@bassline/solid'
import { useToast } from '../../context/ToastContext'

interface AddPropagatorModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (propagatorName: string) => void
}

// Simple handler list - most common ones
const SIMPLE_HANDLERS = [
  { value: 'sum', label: 'Sum', description: 'Sum all input values' },
  { value: 'product', label: 'Product', description: 'Multiply all input values' },
  { value: 'min', label: 'Min', description: 'Minimum value' },
  { value: 'max', label: 'Max', description: 'Maximum value' },
  { value: 'average', label: 'Average', description: 'Average of values' },
  { value: 'concat', label: 'Concat', description: 'Concatenate arrays/strings' },
  { value: 'negate', label: 'Negate', description: 'Negate numeric value' },
  { value: 'abs', label: 'Abs', description: 'Absolute value' },
  { value: 'not', label: 'Not', description: 'Logical NOT' },
  { value: 'and', label: 'And', description: 'Logical AND' },
  { value: 'or', label: 'Or', description: 'Logical OR' },
  { value: 'identity', label: 'Identity', description: 'Pass through unchanged' },
  { value: 'pick', label: 'Pick', description: 'Extract object property' },
  { value: 'filter', label: 'Filter', description: 'Filter by predicate' },
  { value: 'map', label: 'Map', description: 'Transform each element' },
]

export default function AddPropagatorModal(props: AddPropagatorModalProps) {
  const bl = useBassline()
  const { toast } = useToast()
  const { data: cellsData } = useResource(() => 'bl:///r/cells')

  const [propagatorName, setPropagatorName] = createSignal('')
  const [handler, setHandler] = createSignal('sum')
  const [inputCells, setInputCells] = createSignal<string[]>([''])
  const [outputCell, setOutputCell] = createSignal('')
  const [creating, setCreating] = createSignal(false)
  const [error, setError] = createSignal('')

  const availableCells = createMemo(() => {
    return cellsData()?.entries?.map((c: any) => c.name) || []
  })

  const addInputCell = () => {
    setInputCells([...inputCells(), ''])
  }

  const removeInputCell = (index: number) => {
    setInputCells(inputCells().filter((_, i) => i !== index))
  }

  const updateInputCell = (index: number, value: string) => {
    const updated = [...inputCells()]
    updated[index] = value
    setInputCells(updated)
  }

  const handleCreate = async () => {
    const name = propagatorName().trim()
    if (!name) {
      toast.error('Propagator name is required')
      return
    }

    // Validate name
    if (!/^[a-z0-9_-]+$/i.test(name)) {
      toast.error('Name must contain only letters, numbers, hyphens, and underscores')
      return
    }

    // Filter out empty input cells
    const inputs = inputCells()
      .filter((c) => c.trim())
      .map((c) => `bl:///r/cells/${c.trim()}`)
    if (inputs.length === 0) {
      toast.error('At least one input cell is required')
      return
    }

    const output = outputCell().trim()
    if (!output) {
      toast.error('Output cell is required')
      return
    }

    setCreating(true)
    setError('')

    try {
      await bl.put(
        `bl:///r/propagators/${name}`,
        {},
        {
          inputs,
          output: `bl:///r/cells/${output}`,
          handler: handler(),
        }
      )
      toast.success(`Propagator "${name}" created`)
      props.onSuccess?.(name)
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create propagator')
      setError(err.message || 'Failed to create propagator')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setPropagatorName('')
    setHandler('sum')
    setInputCells([''])
    setOutputCell('')
    setError('')
    props.onClose()
  }

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={handleClose}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Add Propagator</h2>
            <button class="modal-close" onClick={handleClose}>
              &times;
            </button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Propagator Name</label>
              <input
                type="text"
                class="form-input"
                placeholder="add-numbers"
                value={propagatorName()}
                onInput={(e) => setPropagatorName(e.currentTarget.value)}
                autofocus
              />
            </div>

            <div class="form-group">
              <label class="form-label">Handler</label>
              <select
                class="form-select"
                value={handler()}
                onChange={(e) => setHandler(e.currentTarget.value)}
              >
                {SIMPLE_HANDLERS.map((h) => (
                  <option value={h.value}>{h.label}</option>
                ))}
              </select>
              <p class="form-hint">
                {SIMPLE_HANDLERS.find((h) => h.value === handler())?.description}
              </p>
            </div>

            <div class="form-group">
              <div class="form-label-row">
                <label class="form-label">Input Cells</label>
                <button class="btn-link" onClick={addInputCell}>
                  + Add Input
                </button>
              </div>
              <For each={inputCells()}>
                {(cell, index) => (
                  <div class="input-row">
                    <Show
                      when={availableCells().length > 0}
                      fallback={
                        <input
                          type="text"
                          class="form-input"
                          placeholder="cell-name"
                          value={cell}
                          onInput={(e) => updateInputCell(index(), e.currentTarget.value)}
                        />
                      }
                    >
                      <select
                        class="form-select"
                        value={cell}
                        onChange={(e) => updateInputCell(index(), e.currentTarget.value)}
                      >
                        <option value="">Select a cell...</option>
                        <For each={availableCells()}>
                          {(cellName) => <option value={cellName}>{cellName}</option>}
                        </For>
                      </select>
                    </Show>
                    <Show when={inputCells().length > 1}>
                      <button
                        class="btn-icon btn-danger"
                        onClick={() => removeInputCell(index())}
                        title="Remove input"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </Show>
                  </div>
                )}
              </For>
            </div>

            <div class="form-group">
              <label class="form-label">Output Cell</label>
              <Show
                when={availableCells().length > 0}
                fallback={
                  <input
                    type="text"
                    class="form-input"
                    placeholder="result"
                    value={outputCell()}
                    onInput={(e) => setOutputCell(e.currentTarget.value)}
                  />
                }
              >
                <select
                  class="form-select"
                  value={outputCell()}
                  onChange={(e) => setOutputCell(e.currentTarget.value)}
                >
                  <option value="">Select a cell...</option>
                  <For each={availableCells()}>
                    {(cellName) => <option value={cellName}>{cellName}</option>}
                  </For>
                </select>
              </Show>
              <p class="form-hint">
                Cell to write the result to (will be created if it doesn't exist)
              </p>
            </div>

            <Show when={error()}>
              <div class="error-message">{error()}</div>
            </Show>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" onClick={handleClose} disabled={creating()}>
              Cancel
            </button>
            <button
              class="btn btn-primary"
              onClick={handleCreate}
              disabled={!propagatorName().trim() || creating()}
            >
              {creating() ? 'Creating...' : 'Create Propagator'}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.2s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #30363d;
        }

        .modal-header h2 {
          font-size: 18px;
          font-weight: 600;
          color: #f0f6fc;
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          color: #8b949e;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          line-height: 1;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.15s ease;
        }

        .modal-close:hover {
          background: #30363d;
          color: #f0f6fc;
        }

        .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 20px;
          border-top: 1px solid #30363d;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #f0f6fc;
          margin-bottom: 8px;
        }

        .form-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .form-input, .form-select {
          width: 100%;
          padding: 10px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 14px;
          font-family: inherit;
          transition: border-color 0.15s ease;
        }

        .form-input:focus, .form-select:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .form-select {
          cursor: pointer;
        }

        .form-hint {
          font-size: 12px;
          color: #8b949e;
          margin-top: 6px;
          margin-bottom: 0;
        }

        .input-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
        }

        .input-row:last-child {
          margin-bottom: 0;
        }

        .input-row .form-input,
        .input-row .form-select {
          flex: 1;
        }

        .btn-link {
          background: none;
          border: none;
          color: #58a6ff;
          font-size: 12px;
          cursor: pointer;
          padding: 0;
          font-weight: 500;
        }

        .btn-link:hover {
          text-decoration: underline;
        }

        .btn-icon {
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          padding: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .btn-icon:hover {
          background: #30363d;
          border-color: #484f58;
        }

        .btn-icon.btn-danger:hover {
          background: #f8514933;
          color: #f85149;
          border-color: #f85149;
        }

        .error-message {
          background: #f8514933;
          border: 1px solid #f85149;
          border-radius: 6px;
          padding: 12px;
          color: #f85149;
          font-size: 13px;
          margin-top: 16px;
        }
      `}</style>
    </Show>
  )
}

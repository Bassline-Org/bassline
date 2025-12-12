import { createSignal, Show } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { useToast } from '../../context/ToastContext'
import HiccupComposer, { createEmptyComposition } from '../HiccupComposer'
import { selectionStore, SelectedResource } from '../../stores/selection'

type HiccupNode = string | [string, ...any[]]

interface NewResourceToolsProps {
  onResourceCreated: () => void
  cells: Array<{ uri: string; lattice?: string; value?: any }>
}

type CreateMode = 'none' | 'cell' | 'handler'

/**
 * NewResourceTools - Quick creation buttons for cells and handler compositions
 */
export default function NewResourceTools(props: NewResourceToolsProps) {
  const bl = useBassline()
  const { toast } = useToast()

  const [mode, setMode] = createSignal<CreateMode>('none')
  const [creating, setCreating] = createSignal(false)

  // Cell creation form state
  const [cellName, setCellName] = createSignal('')
  const [cellLattice, setCellLattice] = createSignal('lww')

  // Handler composition state
  const [handlerComposition, setHandlerComposition] =
    createSignal<HiccupNode>(createEmptyComposition())

  // Reset form
  function resetForm() {
    setMode('none')
    setCellName('')
    setCellLattice('lww')
    setHandlerComposition(createEmptyComposition())
  }

  // Use composition - adds it to selection basket for use with "Promote to Propagator"
  function useComposition() {
    const composition = handlerComposition()
    const compositionName =
      typeof composition === 'string'
        ? composition
        : Array.isArray(composition)
          ? composition[0]
          : 'composition'

    // Add to selection as a handler resource
    const resource: SelectedResource = {
      uri: `handler:${compositionName}`,
      type: 'handler',
      name: compositionName,
      data: { handler: composition },
    }
    selectionStore.select(resource)
    toast.success(`Handler "${compositionName}" ready for use`)
    resetForm()
  }

  // Create cell
  async function createCell() {
    const name = cellName().trim()
    if (!name) {
      toast.error('Cell name is required')
      return
    }

    setCreating(true)
    try {
      await bl.put(`bl:///r/cells/${name}`, {}, { lattice: cellLattice() })
      toast.success(`Cell "${name}" created`)
      props.onResourceCreated()
      resetForm()
    } catch (err) {
      toast.error(`Failed to create cell: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div class="new-resource-tools">
      {/* Mode buttons */}
      <Show when={mode() === 'none'}>
        <div class="tool-buttons">
          <button class="tool-btn" onClick={() => setMode('cell')}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            <span>New Cell</span>
          </button>
          <button class="tool-btn" onClick={() => setMode('handler')}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
              <path d="M12 22V15.5M22 8.5L12 15.5 2 8.5" />
            </svg>
            <span>New Handler</span>
          </button>
        </div>
      </Show>

      {/* Cell creation form */}
      <Show when={mode() === 'cell'}>
        <div class="create-form">
          <div class="form-header">
            <h4>New Cell</h4>
            <button class="cancel-btn" onClick={resetForm}>
              Cancel
            </button>
          </div>

          <div class="form-field">
            <label>Name</label>
            <input
              type="text"
              value={cellName()}
              onInput={(e) => setCellName(e.currentTarget.value)}
              placeholder="my-cell"
              disabled={creating()}
            />
          </div>

          <div class="form-field">
            <label>Lattice Type</label>
            <select
              value={cellLattice()}
              onChange={(e) => setCellLattice(e.currentTarget.value)}
              disabled={creating()}
            >
              <option value="lww">lww (Last Writer Wins)</option>
              <option value="counter">counter (Increment Only)</option>
              <option value="maxNumber">maxNumber</option>
              <option value="minNumber">minNumber</option>
              <option value="setUnion">setUnion</option>
              <option value="boolean">boolean</option>
              <option value="object">object (Shallow Merge)</option>
            </select>
          </div>

          <button
            class="create-btn"
            onClick={createCell}
            disabled={creating() || !cellName().trim()}
          >
            {creating() ? 'Creating...' : 'Create Cell'}
          </button>
        </div>
      </Show>

      {/* Handler composition with HiccupComposer */}
      <Show when={mode() === 'handler'}>
        <div class="create-form handler-form">
          <div class="form-header">
            <h4>New Handler Composition</h4>
            <button class="cancel-btn" onClick={resetForm}>
              Cancel
            </button>
          </div>

          <div class="handler-composer-wrapper">
            <HiccupComposer value={handlerComposition()} onChange={setHandlerComposition} />
          </div>

          <div class="handler-actions">
            <button class="use-btn" onClick={useComposition} disabled={creating()}>
              Use Handler
            </button>
            <p class="handler-hint">
              Click "Use Handler" to add this composition to the selection basket, then promote it
              to a propagator.
            </p>
          </div>
        </div>
      </Show>

      <style>{`
        .new-resource-tools {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tool-buttons {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tool-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 8px;
          color: #c9d1d9;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tool-btn:hover {
          background: #30363d;
          border-color: #58a6ff;
        }

        .tool-btn svg {
          color: #58a6ff;
        }

        .create-form {
          padding: 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 8px;
        }

        .form-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .form-header h4 {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .cancel-btn {
          padding: 4px 8px;
          background: none;
          border: none;
          color: #8b949e;
          font-size: 12px;
          cursor: pointer;
        }

        .cancel-btn:hover {
          color: #f85149;
        }

        .cancel-btn.full-width {
          width: 100%;
          padding: 10px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          margin-top: 12px;
        }

        .form-field {
          margin-bottom: 12px;
        }

        .form-field label {
          display: block;
          margin-bottom: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          padding: 8px 10px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .form-field input:focus,
        .form-field select:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .form-field input::placeholder {
          color: #6e7681;
        }

        .create-btn {
          width: 100%;
          padding: 10px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .create-btn:hover:not(:disabled) {
          background: #2ea043;
        }

        .create-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .placeholder-message {
          padding: 16px;
          text-align: center;
        }

        .placeholder-message p {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #8b949e;
        }

        .placeholder-message p:last-child {
          margin-bottom: 0;
        }

        .handler-form {
          max-height: 400px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .handler-composer-wrapper {
          flex: 1;
          overflow-y: auto;
          margin-bottom: 12px;
        }

        .handler-actions {
          border-top: 1px solid #30363d;
          padding-top: 12px;
        }

        .use-btn {
          width: 100%;
          padding: 10px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }

        .use-btn:hover:not(:disabled) {
          background: #2ea043;
        }

        .use-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .handler-hint {
          margin: 8px 0 0 0;
          font-size: 11px;
          color: #8b949e;
          line-height: 1.4;
        }
      `}</style>
    </div>
  )
}

import { Show, createSignal, For } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { selectionStore } from '../../stores/selection'
import { useToast } from '../../context/ToastContext'
import HiccupComposer, { createEmptyComposition } from '../HiccupComposer'

type HiccupNode = string | [string, ...any[]]

interface PromotionActionsProps {
  onResourceCreated: () => void
  cells: Array<{ uri: string; lattice?: string; value?: any }>
}

/**
 * PromotionActions - Context-dependent "promote to..." actions
 *
 * Shows different promotion options based on what's selected:
 * - Handler composition -> Propagator
 * - Multiple cells -> Propagator inputs
 * - Multiple resources -> Recipe
 */
export default function PromotionActions(props: PromotionActionsProps) {
  const bl = useBassline()
  const { selected, clearSelection } = selectionStore
  const { toast } = useToast()

  // Promotion form state
  const [showPropagatorForm, setShowPropagatorForm] = createSignal(false)
  const [propagatorName, setPropagatorName] = createSignal('')
  const [selectedInputs, setSelectedInputs] = createSignal<string[]>([])
  const [selectedOutput, setSelectedOutput] = createSignal('')
  const [creating, setCreating] = createSignal(false)
  const [handlerComposition, setHandlerComposition] =
    createSignal<HiccupNode>(createEmptyComposition())

  // Check if we need to show handler picker (no handler in selection)
  const needsHandlerPicker = () => !getSelectedHandler()

  // Show "Promote to Propagator" for handlers or cells
  const canPromoteToPropagator = () => {
    const sel = selected()
    const hasHandler = sel.some((s) => s.type === 'handler')
    const cellCount = sel.filter((s) => s.type === 'cell').length

    // Show if:
    // 1. A handler is selected (alone or with cells)
    // 2. At least one cell is selected (user can use HiccupComposer for handler)
    return hasHandler || cellCount >= 1
  }

  // Show "Promote to Recipe" for multiple resources
  const canPromoteToRecipe = () => {
    return selected().length >= 2
  }

  // Get handler from selection
  const getSelectedHandler = () => {
    const sel = selected()
    const handlerSelection = sel.find((s) => s.type === 'handler')
    if (handlerSelection?.data?.handler) {
      return handlerSelection.data.handler
    }
    return null
  }

  // Get cells from selection
  const getSelectedCells = () => {
    return selected().filter((s) => s.type === 'cell')
  }

  // Handler for promote to propagator
  function handlePromoteToPropagator() {
    // Pre-fill with selected cells as inputs
    const selectedCells = getSelectedCells()
    if (selectedCells.length > 0) {
      setSelectedInputs(selectedCells.map((c) => c.uri))
    }
    setShowPropagatorForm(true)
  }

  // Toggle input cell selection
  function toggleInput(uri: string) {
    const current = selectedInputs()
    if (current.includes(uri)) {
      setSelectedInputs(current.filter((u) => u !== uri))
    } else {
      setSelectedInputs([...current, uri])
    }
  }

  // Create the propagator
  async function createPropagator() {
    const name = propagatorName().trim()
    if (!name) {
      toast.error('Propagator name is required')
      return
    }

    if (selectedInputs().length === 0) {
      toast.error('At least one input cell is required')
      return
    }

    if (!selectedOutput()) {
      toast.error('An output cell is required')
      return
    }

    // Use selected handler or the composed one
    const handler = getSelectedHandler() || handlerComposition()
    if (!handler || handler === 'identity') {
      toast.error('Please configure a handler')
      return
    }

    setCreating(true)
    try {
      await bl.put(
        `bl:///r/propagators/${name}`,
        {},
        {
          inputs: selectedInputs(),
          output: selectedOutput(),
          handler: handler,
        }
      )

      toast.success(`Propagator "${name}" created!`)
      clearSelection()
      setShowPropagatorForm(false)
      resetForm()
      props.onResourceCreated()
    } catch (err) {
      toast.error(
        `Failed to create propagator: ${err instanceof Error ? err.message : 'Unknown error'}`
      )
    } finally {
      setCreating(false)
    }
  }

  function resetForm() {
    setPropagatorName('')
    setSelectedInputs([])
    setSelectedOutput('')
    setHandlerComposition(createEmptyComposition())
  }

  function cancelForm() {
    setShowPropagatorForm(false)
    resetForm()
  }

  // Handler for promote to recipe
  function handlePromoteToRecipe() {
    toast.info('Promote to Recipe - Coming soon!')
    // TODO: Open recipe extraction wizard
  }

  return (
    <div class="promotion-actions">
      {/* Promote to Propagator button */}
      <Show when={canPromoteToPropagator() && !showPropagatorForm()}>
        <button class="promotion-btn" onClick={handlePromoteToPropagator}>
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
          <span>Promote to Propagator</span>
          <svg
            class="arrow"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </Show>

      {/* Propagator creation form */}
      <Show when={showPropagatorForm()}>
        <div class="propagator-form">
          <div class="form-header">
            <h4>Create Propagator</h4>
            <button class="cancel-btn" onClick={cancelForm}>
              Cancel
            </button>
          </div>

          <div class="form-field">
            <label>Name</label>
            <input
              type="text"
              value={propagatorName()}
              onInput={(e) => setPropagatorName(e.currentTarget.value)}
              placeholder="my-propagator"
              disabled={creating()}
            />
          </div>

          {/* Show selected handler or composer */}
          <div class="form-field">
            <label>Handler</label>
            <Show
              when={getSelectedHandler()}
              fallback={
                <div class="handler-composer-wrapper">
                  <HiccupComposer value={handlerComposition()} onChange={setHandlerComposition} />
                </div>
              }
            >
              <code class="handler-preview">{JSON.stringify(getSelectedHandler())}</code>
            </Show>
          </div>

          <div class="form-field">
            <label>Input Cells</label>
            <div class="cell-selector">
              <For each={props.cells}>
                {(cell) => {
                  const name = cell.uri.split('/').pop() || 'cell'
                  const isSelected = () => selectedInputs().includes(cell.uri)
                  return (
                    <button
                      class={`cell-option ${isSelected() ? 'selected' : ''}`}
                      onClick={() => toggleInput(cell.uri)}
                    >
                      <span class="cell-name">{name}</span>
                      <Show when={isSelected()}>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="3"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </Show>
                    </button>
                  )
                }}
              </For>
            </div>
          </div>

          <div class="form-field">
            <label>Output Cell</label>
            <select
              value={selectedOutput()}
              onChange={(e) => setSelectedOutput(e.currentTarget.value)}
              disabled={creating()}
            >
              <option value="">Select output cell...</option>
              <For each={props.cells}>
                {(cell) => {
                  const name = cell.uri.split('/').pop() || 'cell'
                  return <option value={cell.uri}>{name}</option>
                }}
              </For>
            </select>
          </div>

          <button
            class="create-btn"
            onClick={createPropagator}
            disabled={
              creating() ||
              !propagatorName().trim() ||
              selectedInputs().length === 0 ||
              !selectedOutput()
            }
          >
            {creating() ? 'Creating...' : 'Create Propagator'}
          </button>
        </div>
      </Show>

      <Show when={canPromoteToRecipe()}>
        <button class="promotion-btn" onClick={handlePromoteToRecipe}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span>Promote to Recipe</span>
          <svg
            class="arrow"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </Show>

      <Show when={!canPromoteToPropagator() && !canPromoteToRecipe() && !showPropagatorForm()}>
        <div class="no-promotions">
          <p>Select a handler or multiple cells to see promotion options.</p>
        </div>
      </Show>

      <style>{`
        .promotion-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .promotion-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 14px;
          background: #161b22;
          border: 1px solid #3fb950;
          border-radius: 8px;
          color: #3fb950;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .promotion-btn:hover {
          background: #3fb95011;
        }

        .promotion-btn span {
          flex: 1;
          text-align: left;
        }

        .promotion-btn .arrow {
          opacity: 0.5;
        }

        .promotion-btn:hover .arrow {
          opacity: 1;
          transform: translateX(2px);
        }

        .no-promotions {
          padding: 16px;
          background: #0d1117;
          border-radius: 8px;
          border: 1px solid #30363d;
        }

        .no-promotions p {
          margin: 0;
          font-size: 12px;
          color: #8b949e;
          line-height: 1.5;
        }

        .propagator-form {
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

        .handler-preview {
          display: block;
          padding: 8px;
          background: #161b22;
          border-radius: 6px;
          font-size: 11px;
          color: #79c0ff;
          word-break: break-all;
        }

        .cell-selector {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .cell-option {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 12px;
          cursor: pointer;
        }

        .cell-option:hover {
          border-color: #58a6ff;
        }

        .cell-option.selected {
          background: #388bfd22;
          border-color: #58a6ff;
          color: #58a6ff;
        }

        .cell-option svg {
          color: #3fb950;
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

        .handler-composer-wrapper {
          min-height: 200px;
          border: 1px solid #30363d;
          border-radius: 6px;
          position: relative;
        }
      `}</style>
    </div>
  )
}

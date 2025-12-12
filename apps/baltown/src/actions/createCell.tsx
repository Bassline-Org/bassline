import { createSignal } from 'solid-js'
import type { Action, ActionContext } from './types'

/**
 * Create Cell Action
 *
 * Simple action with a single form step:
 * - Enter cell name
 * - Select lattice type
 * - Create
 */
export function createCellAction(): Action {
  // Internal state
  let ctx: ActionContext | null = null
  const [name, setName] = createSignal('')
  const [lattice, setLattice] = createSignal('lww')
  const [ready, setReady] = createSignal(false)

  return {
    id: 'create-cell',
    name: 'Create Cell',
    description: 'Create a new cell with a lattice',

    icon: () => (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),

    onStart(context) {
      ctx = context
      setName('')
      setLattice('lww')
      setReady(false)
    },

    onCancel() {
      ctx = null
    },

    onClick() {
      // This action doesn't use graph clicks
    },

    onKeyDown(event) {
      if (event.key === 'Enter' && name().trim()) {
        setReady(true)
        ctx?.complete()
      }
    },

    renderOverlay() {
      return (
        <div class="create-cell-overlay">
          <div class="overlay-card">
            <h3>Create Cell</h3>

            <div class="form-field">
              <label>Name</label>
              <input
                type="text"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
                placeholder="my-cell"
                autofocus
              />
            </div>

            <div class="form-field">
              <label>Lattice</label>
              <select value={lattice()} onChange={(e) => setLattice(e.currentTarget.value)}>
                <option value="lww">Last Writer Wins (lww)</option>
                <option value="maxNumber">Max Number</option>
                <option value="minNumber">Min Number</option>
                <option value="setUnion">Set Union</option>
                <option value="counter">Counter</option>
                <option value="boolean">Boolean</option>
              </select>
            </div>

            <div class="form-actions">
              <button class="cancel-btn" onClick={() => ctx?.cancel()}>
                Cancel
              </button>
              <button
                class="create-btn"
                disabled={!name().trim()}
                onClick={() => {
                  setReady(true)
                  ctx?.complete()
                }}
              >
                Create Cell
              </button>
            </div>
          </div>

          <style>{`
            .create-cell-overlay {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
            }

            .create-cell-overlay::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.5);
              pointer-events: none;
            }

            .overlay-card {
              position: relative;
              z-index: 10;
              background: #161b22;
              border: 1px solid #30363d;
              border-radius: 12px;
              padding: 24px;
              min-width: 320px;
              box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
              pointer-events: auto;
            }

            .overlay-card h3 {
              margin: 0 0 20px;
              color: #c9d1d9;
              font-size: 16px;
              font-weight: 600;
            }

            .form-field {
              margin-bottom: 16px;
            }

            .form-field label {
              display: block;
              margin-bottom: 6px;
              font-size: 12px;
              font-weight: 500;
              color: #8b949e;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }

            .form-field input,
            .form-field select {
              width: 100%;
              padding: 10px 12px;
              background: #0d1117;
              border: 1px solid #30363d;
              border-radius: 6px;
              color: #c9d1d9;
              font-size: 14px;
            }

            .form-field input:focus,
            .form-field select:focus {
              outline: none;
              border-color: #58a6ff;
            }

            .form-actions {
              display: flex;
              justify-content: flex-end;
              gap: 8px;
              margin-top: 20px;
            }

            .cancel-btn {
              padding: 8px 16px;
              background: transparent;
              border: 1px solid #30363d;
              border-radius: 6px;
              color: #8b949e;
              font-size: 13px;
              cursor: pointer;
            }

            .cancel-btn:hover {
              color: #c9d1d9;
              border-color: #8b949e;
            }

            .create-btn {
              padding: 8px 16px;
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
          `}</style>
        </div>
      )
    },

    isComplete() {
      return ready() && name().trim().length > 0
    },

    async execute() {
      if (!ctx) return

      const cellName = name().trim()
      const cellLattice = lattice()

      try {
        await ctx.bl.put(`bl:///r/cells/${cellName}`, {}, { lattice: cellLattice })
        ctx.toast.success(`Created cell "${cellName}"`)
        ctx.refresh()
      } catch (err) {
        console.error('Failed to create cell:', err)
        ctx.toast.error(`Failed to create cell: ${err}`)
      }
    },
  }
}

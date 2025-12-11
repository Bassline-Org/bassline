import { createSignal, Show } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { useToast } from '../../context/ToastContext'

interface AddCellModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (cellName: string) => void
}

const LATTICE_TYPES = [
  { value: 'lww', label: 'LWW (Last Write Wins)', description: 'Stores value with timestamp' },
  { value: 'counter', label: 'Counter', description: 'Increment-only counter' },
  { value: 'maxNumber', label: 'Max Number', description: 'Values only increase' },
  { value: 'minNumber', label: 'Min Number', description: 'Values only decrease' },
  { value: 'setUnion', label: 'Set Union', description: 'Accumulates set elements' },
  { value: 'setIntersection', label: 'Set Intersection', description: 'Constrains to common elements' },
  { value: 'boolean', label: 'Boolean', description: 'Once true, stays true' },
  { value: 'object', label: 'Object', description: 'Shallow merge objects' }
]

export default function AddCellModal(props: AddCellModalProps) {
  const bl = useBassline()
  const { toast } = useToast()

  const [cellName, setCellName] = createSignal('')
  const [latticeType, setLatticeType] = createSignal('lww')
  const [creating, setCreating] = createSignal(false)
  const [error, setError] = createSignal('')

  const handleCreate = async () => {
    const name = cellName().trim()
    if (!name) {
      toast.error('Cell name is required')
      return
    }

    // Validate name (alphanumeric, hyphens, underscores)
    if (!/^[a-z0-9_-]+$/i.test(name)) {
      toast.error('Cell name must contain only letters, numbers, hyphens, and underscores')
      return
    }

    setCreating(true)
    setError('')

    try {
      await bl.put(`bl:///r/cells/${name}`, {}, { lattice: latticeType() })
      toast.success(`Cell "${name}" created`)
      props.onSuccess?.(name)
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Failed to create cell')
      setError(err.message || 'Failed to create cell')
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    setCellName('')
    setLatticeType('lww')
    setError('')
    props.onClose()
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !creating()) {
      handleCreate()
    } else if (e.key === 'Escape') {
      handleClose()
    }
  }

  return (
    <Show when={props.isOpen}>
      <div class="modal-overlay" onClick={handleClose}>
        <div class="modal-content" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
          <div class="modal-header">
            <h2>Add Cell</h2>
            <button class="modal-close" onClick={handleClose}>&times;</button>
          </div>

          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Cell Name</label>
              <input
                type="text"
                class="form-input"
                placeholder="counter"
                value={cellName()}
                onInput={(e) => setCellName(e.currentTarget.value)}
                autofocus
              />
              <p class="form-hint">Letters, numbers, hyphens, and underscores only</p>
            </div>

            <div class="form-group">
              <label class="form-label">Lattice Type</label>
              <select
                class="form-select"
                value={latticeType()}
                onChange={(e) => setLatticeType(e.currentTarget.value)}
              >
                {LATTICE_TYPES.map(lt => (
                  <option value={lt.value}>{lt.label}</option>
                ))}
              </select>
              <p class="form-hint">
                {LATTICE_TYPES.find(lt => lt.value === latticeType())?.description}
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
              disabled={!cellName().trim() || creating()}
            >
              {creating() ? 'Creating...' : 'Create Cell'}
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
          max-width: 500px;
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

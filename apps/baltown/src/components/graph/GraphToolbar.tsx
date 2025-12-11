import { Show, createSignal } from 'solid-js'
import AddCellModal from './AddCellModal'
import AddPropagatorModal from './AddPropagatorModal'

interface GraphToolbarProps {
  onAddCell?: (cellName: string) => void
  onAddPropagator?: (propagatorName: string) => void
  onDelete?: () => void
  onAutoLayout?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onFitView?: () => void
  onExport?: () => void
  hasSelection?: boolean
  zoom?: number
}

/**
 * GraphToolbar - Controls for the propagator graph
 */
export default function GraphToolbar(props: GraphToolbarProps) {
  const [showAddCellModal, setShowAddCellModal] = createSignal(false)
  const [showAddPropagatorModal, setShowAddPropagatorModal] = createSignal(false)

  const handleCellCreated = (cellName: string) => {
    setShowAddCellModal(false)
    props.onAddCell?.(cellName)
  }

  const handlePropagatorCreated = (propagatorName: string) => {
    setShowAddPropagatorModal(false)
    props.onAddPropagator?.(propagatorName)
  }

  return (
    <>
      <div class="graph-toolbar">
        <div class="toolbar-group">
          <button
            class="toolbar-btn"
            onClick={() => setShowAddCellModal(true)}
            title="Add Cell"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
            <span>Cell</span>
          </button>

          <button
            class="toolbar-btn"
            onClick={() => setShowAddPropagatorModal(true)}
            title="Add Propagator"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 12h4l3-9 6 18 3-9h4"/>
            </svg>
            <span>Propagator</span>
          </button>
        </div>

      <div class="toolbar-divider" />

      <div class="toolbar-group">
        <button
          class="toolbar-btn"
          onClick={() => props.onAutoLayout?.()}
          title="Auto Layout"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
          </svg>
        </button>

        <button
          class="toolbar-btn"
          onClick={() => props.onFitView?.()}
          title="Fit View"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider" />

      <div class="toolbar-group zoom-controls">
        <button
          class="toolbar-btn"
          onClick={() => props.onZoomOut?.()}
          title="Zoom Out"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35M8 11h6"/>
          </svg>
        </button>

        <span class="zoom-level">{Math.round((props.zoom ?? 1) * 100)}%</span>

        <button
          class="toolbar-btn"
          onClick={() => props.onZoomIn?.()}
          title="Zoom In"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/>
          </svg>
        </button>
      </div>

      <div class="toolbar-divider" />

      <div class="toolbar-group">
        <Show when={props.hasSelection}>
          <button
            class="toolbar-btn danger"
            onClick={() => props.onDelete?.()}
            title="Delete Selected"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        </Show>

        <button
          class="toolbar-btn"
          onClick={() => props.onExport?.()}
          title="Export"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>

      <style>{`
        .graph-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 100;
        }

        .toolbar-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .toolbar-divider {
          width: 1px;
          height: 24px;
          background: #30363d;
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.15s ease;
        }

        .toolbar-btn:hover {
          background: #30363d;
          color: #c9d1d9;
          border-color: #484f58;
        }

        .toolbar-btn.danger:hover {
          background: #f8514933;
          color: #f85149;
          border-color: #f85149;
        }

        .toolbar-btn span {
          display: none;
        }

        @media (min-width: 768px) {
          .toolbar-btn span {
            display: inline;
          }
        }

        .zoom-controls {
          min-width: 100px;
          justify-content: center;
        }

        .zoom-level {
          font-size: 11px;
          color: #8b949e;
          min-width: 40px;
          text-align: center;
        }
      `}</style>
      </div>

      <AddCellModal
        isOpen={showAddCellModal()}
        onClose={() => setShowAddCellModal(false)}
        onSuccess={handleCellCreated}
      />

      <AddPropagatorModal
        isOpen={showAddPropagatorModal()}
        onClose={() => setShowAddPropagatorModal(false)}
        onSuccess={handlePropagatorCreated}
      />
    </>
  )
}

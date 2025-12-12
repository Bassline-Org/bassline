import { createSignal, createResource, createEffect, Show, For, onMount, onCleanup } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { selectionStore, SelectedResource } from '../stores/selection'
import ToolboxPanel from '../components/workbench/ToolboxPanel'
import WorkbenchInspector from '../components/workbench/WorkbenchInspector'
import ActivityStream from '../components/workbench/ActivityStream'
import CytoscapeGraph, { HandlerNodeData } from '../components/graph/CytoscapeGraph'
import { useToast } from '../context/ToastContext'

interface CellData {
  uri: string
  lattice?: string
  value?: any
}

interface PropagatorData {
  uri: string
  inputs: string[]
  output: string
  handler?: string | any[]
}

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  canvasPosition: { x: number; y: number }
}

/**
 * Workbench - The main development environment
 * Three-panel layout: Toolbox (left) | Canvas (center) | Inspector (right)
 * With Activity Stream at the bottom
 */
export default function Workbench() {
  const bl = useBassline()
  const { toast } = useToast()

  // State
  const [activityOpen, setActivityOpen] = createSignal(true)
  const [refreshTrigger, setRefreshTrigger] = createSignal(0)

  // Context menu state
  const [contextMenu, setContextMenu] = createSignal<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    canvasPosition: { x: 0, y: 0 },
  })

  // Handler nodes state (unpromoted handlers living on the canvas)
  const [handlers, setHandlers] = createSignal<HandlerNodeData[]>([])
  let handlerIdCounter = 0

  // Close context menu when clicking outside
  onMount(() => {
    const handleClick = () => {
      if (contextMenu().visible) {
        setContextMenu((prev) => ({ ...prev, visible: false }))
      }
    }
    document.addEventListener('click', handleClick)
    onCleanup(() => document.removeEventListener('click', handleClick))
  })

  // Fetch cells
  const [cellsResponse] = createResource(
    () => refreshTrigger(),
    async () => {
      try {
        const res = await bl.get('bl:///r/cells')
        return res?.body?.entries || []
      } catch {
        return []
      }
    }
  )

  // Fetch propagators
  const [propagatorsResponse] = createResource(
    () => refreshTrigger(),
    async () => {
      try {
        const res = await bl.get('bl:///r/propagators')
        return res?.body?.entries || []
      } catch {
        return []
      }
    }
  )

  // Transform data for graph
  const cells = (): CellData[] => {
    const entries = cellsResponse() || []
    return entries.map((entry: any) => ({
      uri: entry.uri || `bl:///cells/${entry.name}`,
      lattice: entry.lattice,
      value: entry.value,
    }))
  }

  const propagators = (): PropagatorData[] => {
    const entries = propagatorsResponse() || []
    return entries.map((entry: any) => ({
      uri: entry.uri || `bl:///propagators/${entry.name}`,
      inputs: entry.inputs || [],
      output: entry.output || '',
      handler: entry.handler,
    }))
  }

  // Handle node click from graph with modifier key support
  function handleCellClick(uri: string, event?: MouseEvent) {
    const cell = cells().find((c) => c.uri === uri)
    if (cell) {
      const resource = {
        uri,
        type: 'cell' as const,
        name: uri.split('/').pop() || 'cell',
        data: cell,
      }

      // Handle multi-select with modifier keys
      if (event?.shiftKey) {
        selectionStore.addToSelection(resource)
      } else if (event?.metaKey || event?.ctrlKey) {
        selectionStore.toggleSelection(resource)
      } else {
        selectionStore.select(resource)
      }
    }
  }

  function handlePropagatorClick(uri: string, event?: MouseEvent) {
    const prop = propagators().find((p) => p.uri === uri)
    if (prop) {
      const resource = {
        uri,
        type: 'propagator' as const,
        name: uri.split('/').pop() || 'propagator',
        data: prop,
      }

      // Handle multi-select with modifier keys
      if (event?.shiftKey) {
        selectionStore.addToSelection(resource)
      } else if (event?.metaKey || event?.ctrlKey) {
        selectionStore.toggleSelection(resource)
      } else {
        selectionStore.select(resource)
      }
    }
  }

  // Handle handler node click
  function handleHandlerClick(uri: string, event?: MouseEvent) {
    const handler = handlers().find((h) => h.uri === uri)
    if (handler) {
      const resource = {
        uri,
        type: 'handler' as const,
        name: handler.label,
        data: { handler: handler.handler, config: handler.config },
      }

      // Handle multi-select with modifier keys
      if (event?.shiftKey) {
        selectionStore.addToSelection(resource)
      } else if (event?.metaKey || event?.ctrlKey) {
        selectionStore.toggleSelection(resource)
      } else {
        selectionStore.select(resource)
      }
    }
  }

  // Handle right-click on canvas to show context menu
  function handleCanvasContextMenu(
    position: { x: number; y: number },
    screenPosition: { x: number; y: number }
  ) {
    setContextMenu({
      visible: true,
      x: screenPosition.x,
      y: screenPosition.y,
      canvasPosition: position,
    })
  }

  // Create a new handler at the context menu position
  function createHandlerAtPosition() {
    const menu = contextMenu()
    const id = `handler-${Date.now()}-${handlerIdCounter++}`
    const newHandler: HandlerNodeData = {
      id,
      uri: `handler:${id}`,
      label: 'identity',
      handler: 'identity',
      config: {},
      inputConnections: [],
      outputConnection: null,
      position: menu.canvasPosition,
    }

    setHandlers([...handlers(), newHandler])
    setContextMenu((prev) => ({ ...prev, visible: false }))
    toast.info('Handler created. Configure it in the inspector.')

    // Auto-select the new handler
    selectionStore.select({
      uri: newHandler.uri,
      type: 'handler',
      name: newHandler.label,
      data: { handler: newHandler.handler, config: newHandler.config },
    })
  }

  // Create a new cell via the context menu
  async function createCellAtPosition() {
    const menu = contextMenu()
    setContextMenu((prev) => ({ ...prev, visible: false }))

    const name = prompt('Cell name:')
    if (!name) return

    try {
      await bl.put(`bl:///r/cells/${name}`, {}, { lattice: 'lww' })
      toast.success(`Cell "${name}" created`)
      refresh()
    } catch (err) {
      toast.error(`Failed to create cell: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Update a handler's configuration
  function updateHandler(uri: string, updates: Partial<HandlerNodeData>) {
    setHandlers(handlers().map((h) => (h.uri === uri ? { ...h, ...updates } : h)))
  }

  // Remove a handler from the canvas
  function removeHandler(uri: string) {
    setHandlers(handlers().filter((h) => h.uri !== uri))
    if (selectionStore.primarySelection()?.uri === uri) {
      selectionStore.clearSelection()
    }
  }

  // Refresh data
  function refresh() {
    setRefreshTrigger((t) => t + 1)
  }

  // Handle resource creation from toolbox
  function handleResourceCreated() {
    refresh()
  }

  return (
    <div class="workbench">
      {/* Left: Toolbox Panel */}
      <ToolboxPanel onResourceCreated={handleResourceCreated} cells={cells()} />

      {/* Center: Canvas + Activity */}
      <div class="workbench-center">
        <div class="workbench-canvas">
          <CytoscapeGraph
            cells={cells()}
            propagators={propagators()}
            handlers={handlers()}
            onCellClick={handleCellClick}
            onPropagatorClick={handlePropagatorClick}
            onHandlerClick={handleHandlerClick}
            onCanvasContextMenu={handleCanvasContextMenu}
            onRefresh={refresh}
          />
        </div>

        {/* Activity Stream (bottom) */}
        <Show when={activityOpen()}>
          <div class="workbench-activity">
            <div class="activity-header">
              <span>Activity Stream</span>
              <button
                class="activity-toggle"
                onClick={() => setActivityOpen(false)}
                title="Close activity stream"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
            </div>
            <ActivityStream />
          </div>
        </Show>

        {/* Activity toggle when closed */}
        <Show when={!activityOpen()}>
          <button
            class="activity-open-btn"
            onClick={() => setActivityOpen(true)}
            title="Open activity stream"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            <span>Activity</span>
          </button>
        </Show>
      </div>

      {/* Right: Inspector Panel */}
      <WorkbenchInspector
        onUpdate={refresh}
        onHandlerUpdate={(uri, handler) => {
          const handlerName =
            typeof handler === 'string' ? handler : Array.isArray(handler) ? handler[0] : 'handler'
          updateHandler(uri, { handler, label: handlerName })
        }}
        onHandlerDelete={removeHandler}
      />

      {/* Context Menu */}
      <Show when={contextMenu().visible}>
        <div
          class="context-menu"
          style={{
            left: `${contextMenu().x}px`,
            top: `${contextMenu().y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button class="context-menu-item" onClick={createCellAtPosition}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            </svg>
            Create Cell
          </button>
          <button class="context-menu-item" onClick={createHandlerAtPosition}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
            </svg>
            Create Handler
          </button>
          <div class="context-menu-divider" />
          <button
            class="context-menu-item"
            onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
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
            Cancel
          </button>
        </div>
      </Show>

      <style>{`
        .workbench {
          display: flex;
          height: calc(100vh - 56px);
          background: #0d1117;
        }

        .workbench-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .workbench-canvas {
          flex: 1;
          padding: 16px;
          min-height: 0;
        }

        .workbench-canvas .cytoscape-graph-container {
          height: 100%;
        }

        .workbench-activity {
          height: 200px;
          border-top: 1px solid #30363d;
          display: flex;
          flex-direction: column;
        }

        .activity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
          font-size: 12px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .activity-toggle {
          background: none;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .activity-toggle:hover {
          background: #21262d;
          color: #c9d1d9;
        }

        .activity-open-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #161b22;
          border: none;
          border-top: 1px solid #30363d;
          color: #8b949e;
          cursor: pointer;
          font-size: 12px;
        }

        .activity-open-btn:hover {
          background: #21262d;
          color: #c9d1d9;
        }

        /* Context Menu Styles */
        .context-menu {
          position: fixed;
          z-index: 1000;
          min-width: 180px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          padding: 6px;
          animation: context-menu-appear 0.1s ease-out;
        }

        @keyframes context-menu-appear {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
        }

        .context-menu-item:hover {
          background: #21262d;
        }

        .context-menu-item svg {
          color: #8b949e;
        }

        .context-menu-item:hover svg {
          color: #c9d1d9;
        }

        .context-menu-divider {
          height: 1px;
          background: #30363d;
          margin: 6px 0;
        }
      `}</style>
    </div>
  )
}

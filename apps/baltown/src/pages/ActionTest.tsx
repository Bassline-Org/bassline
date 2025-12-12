import { createSignal, createResource, onMount, onCleanup, Show } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { useToast } from '../context/ToastContext'
import { stackStore } from '../stores/stack'
import ActionSidebar from '../components/actions/ActionSidebar'
import ActionGraph from '../components/actions/ActionGraph'
import StackPanel from '../components/actions/StackPanel'
import type { Resource, ActionContext } from '../actions/types'

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

/**
 * ActionTest - Action stack testing page
 *
 * Layout:
 * - Left sidebar: Available actions to cast
 * - Center: Graph with action overlay
 * - Right: Stack panel showing pending actions
 * - Bottom: Status bar
 */
export default function ActionTest() {
  const bl = useBassline()
  const { toast } = useToast()

  // Data refresh trigger
  const [refreshTrigger, setRefreshTrigger] = createSignal(0)

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

  // Transform data
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

  // Convert to Resource format for actions
  const cellResources = (): Resource[] =>
    cells().map((c) => ({
      uri: c.uri,
      type: 'cell' as const,
      name: c.uri.split('/').pop() || 'cell',
      data: c,
    }))

  const propagatorResources = (): Resource[] =>
    propagators().map((p) => ({
      uri: p.uri,
      type: 'propagator' as const,
      name: p.uri.split('/').pop() || 'propagator',
      data: p,
    }))

  // Create action context
  function createActionContext(): ActionContext {
    return {
      bl: {
        get: (uri) => bl.get(uri),
        put: (uri, headers, body) => bl.put(uri, headers, body),
      },
      cells: cellResources(),
      propagators: propagatorResources(),
      toast,
      complete: () => stackStore.completeBuilding(),
      cancel: () => stackStore.cancelBuilding(),
      refresh: () => setRefreshTrigger((t) => t + 1),
    }
  }

  // Global keyboard handler
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space to resolve next (when not building)
      if (e.code === 'Space' && !stackStore.isBuilding() && stackStore.hasItems()) {
        e.preventDefault()
        stackStore.resolveNext()
        return
      }

      // Escape to cancel building
      if (e.key === 'Escape' && stackStore.isBuilding()) {
        stackStore.cancelBuilding()
        return
      }

      // Forward to building action
      if (stackStore.isBuilding()) {
        stackStore.handleKeyDown(e)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    onCleanup(() => document.removeEventListener('keydown', handleKeyDown))
  })

  // Handle graph node click
  function handleNodeClick(resource: Resource, event: MouseEvent) {
    if (stackStore.isBuilding()) {
      stackStore.handleClick(resource, event)
    }
  }

  // Handle stack item click (for meta-actions)
  function handleStackItemClick(item: any) {
    if (stackStore.isBuilding()) {
      stackStore.handleStackItemClick(item)
    }
  }

  return (
    <div class="action-test">
      {/* Left sidebar: Action picker */}
      <ActionSidebar
        onStartAction={(action) => {
          stackStore.startAction(action, createActionContext())
        }}
      />

      {/* Center: Graph + overlay */}
      <div class="action-test-main">
        <ActionGraph
          cells={cells()}
          propagators={propagators()}
          onNodeClick={handleNodeClick}
          overlay={stackStore.renderOverlay()}
        />

        {/* Status bar */}
        <div class="action-status-bar">
          <Show
            when={stackStore.isBuilding()}
            fallback={
              <Show
                when={stackStore.hasItems()}
                fallback={
                  <span class="status-idle">
                    {stackStore.autoResolve()
                      ? 'Auto-resolve ON - Actions execute immediately'
                      : 'Select an action from the sidebar'}
                  </span>
                }
              >
                <span class="status-pending">
                  {stackStore.pendingItems().length} action(s) pending
                  <span class="status-hint">Press Space to resolve</span>
                </span>
              </Show>
            }
          >
            <span class="status-building">
              Building: {stackStore.buildingAction()?.action.name}
            </span>
            <button class="cancel-btn" onClick={() => stackStore.cancelBuilding()}>
              Cancel (Esc)
            </button>
          </Show>
        </div>
      </div>

      {/* Right: Stack panel */}
      <StackPanel
        items={stackStore.stack()}
        buildingItem={stackStore.buildingAction()}
        autoResolve={stackStore.autoResolve()}
        isResolving={stackStore.isResolving()}
        onToggleAutoResolve={() => stackStore.setAutoResolve(!stackStore.autoResolve())}
        onResolveNext={() => stackStore.resolveNext()}
        onResolveAll={() => stackStore.resolveAll()}
        onClearStack={() => stackStore.clearStack()}
        onItemClick={handleStackItemClick}
      />

      <style>{`
        .action-test {
          display: flex;
          height: calc(100vh - 56px);
          background: #0d1117;
        }

        .action-test-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          position: relative;
        }

        .action-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #161b22;
          border-top: 1px solid #30363d;
          color: #c9d1d9;
          font-size: 13px;
        }

        .status-idle {
          color: #8b949e;
        }

        .status-pending {
          color: #58a6ff;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-hint {
          font-size: 11px;
          color: #6e7681;
          background: #21262d;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .status-building {
          font-weight: 600;
          color: #f0883e;
        }

        .cancel-btn {
          padding: 6px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 12px;
          cursor: pointer;
        }

        .cancel-btn:hover {
          background: #30363d;
          border-color: #f85149;
          color: #f85149;
        }
      `}</style>
    </div>
  )
}

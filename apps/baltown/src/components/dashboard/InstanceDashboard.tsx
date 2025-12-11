import { createSignal, createEffect, Show, For, createMemo, onCleanup } from 'solid-js'
import { useLiveResource, useBassline } from '@bassline/solid'
import CellCard from './CellCard'
import PropagatorStatus from './PropagatorStatus'
import FlowDiagram from './FlowDiagram'
import InputPanel from './InputPanel'
import ValueTimeline from './ValueTimeline'
import MetricsSummary from './MetricsSummary'

interface InstanceDashboardProps {
  instanceUri: string
}

interface InstanceData {
  name: string
  recipe: string
  params: Record<string, any>
  cells: Array<{ id: string; uri: string }>
  propagators: Array<{ id: string; uri: string }>
  createdAt?: string
  status?: 'active' | 'stopped' | 'error'
}

/**
 * InstanceDashboard - Complete dashboard for a recipe instance
 *
 * Shows:
 * - Instance status and metrics
 * - Input controls (lattice-aware)
 * - Data flow visualization
 * - Propagator health
 * - Output values
 * - Value history timeline
 */
export default function InstanceDashboard(props: InstanceDashboardProps) {
  const bl = useBassline()
  const [selectedCell, setSelectedCell] = createSignal<string | null>(null)
  const [cellHistory, setCellHistory] = createSignal<{ value: any; timestamp: number }[]>([])
  const [startTime] = createSignal(Date.now())
  const [fireCount, setFireCount] = createSignal(0)
  const [lastActivity, setLastActivity] = createSignal(Date.now())

  // Fetch instance data
  const { data: instanceData, loading, error, isLive } = useLiveResource(() => props.instanceUri)

  // Parse instance
  const instance = createMemo((): InstanceData | null => {
    const d = instanceData()
    if (!d) return null

    const body = d.body ?? d
    return {
      name: body.name ?? props.instanceUri.split('/').pop() ?? 'instance',
      recipe: body.recipe ?? '',
      params: body.params ?? {},
      cells: body.cells ?? [],
      propagators: body.propagators ?? [],
      createdAt: body.createdAt ?? d.headers?.createdAt,
      status: body.status ?? 'active'
    }
  })

  // Extract input and output cells
  const inputCells = createMemo(() => {
    const inst = instance()
    if (!inst) return []

    // For now, treat all cells as potential inputs
    // In a real implementation, you'd analyze the propagator graph
    return inst.cells.map(c => c.uri)
  })

  const outputCells = createMemo(() => {
    const inst = instance()
    if (!inst) return []

    // Find cells that are propagator outputs
    const outputs = new Set<string>()
    inst.propagators.forEach(async p => {
      try {
        const propData = await bl.get(p.uri)
        if (propData.body?.output) {
          outputs.add(propData.body.output)
        }
      } catch {}
    })

    return Array.from(outputs)
  })

  // Calculate metrics
  const metrics = createMemo(() => ({
    cells: instance()?.cells.length ?? 0,
    propagators: instance()?.propagators.length ?? 0,
    totalFires: fireCount(),
    uptime: Date.now() - startTime(),
    lastActivity: lastActivity(),
    liveConnections: isLive() ? 1 : 0
  }))

  // Track cell value changes
  createEffect(() => {
    const cell = selectedCell()
    if (!cell) return

    // Subscribe to cell updates
    const handler = (msg: any) => {
      if (msg.uri === cell) {
        setCellHistory(prev => [
          ...prev.slice(-49),
          { value: msg.body, timestamp: Date.now() }
        ])
        setLastActivity(Date.now())
      }
    }

    // In a real app, you'd set up a WebSocket subscription here
    // For now, we'll just poll periodically
    const interval = setInterval(async () => {
      try {
        const data = await bl.get(cell)
        setCellHistory(prev => {
          const last = prev[prev.length - 1]
          if (!last || JSON.stringify(last.value) !== JSON.stringify(data.body)) {
            return [...prev.slice(-49), { value: data.body, timestamp: Date.now() }]
          }
          return prev
        })
      } catch {}
    }, 1000)

    onCleanup(() => clearInterval(interval))
  })

  // Handle node click in flow diagram
  function handleNodeClick(node: { type: string; uri: string }) {
    if (node.type === 'cell') {
      setSelectedCell(node.uri)
      setCellHistory([])
    }
  }

  return (
    <div class="instance-dashboard">
      <Show when={loading()}>
        <div class="loading-overlay">
          <div class="loading-spinner" />
          <span>Loading instance...</span>
        </div>
      </Show>

      <Show when={error()}>
        <div class="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <h3>Failed to load instance</h3>
          <p>{error()?.message || 'Unknown error'}</p>
        </div>
      </Show>

      <Show when={!loading() && !error() && instance()}>
        {/* Header */}
        <div class="dashboard-header">
          <div class="header-info">
            <div class="instance-title">
              <h2>{instance()!.name}</h2>
              <span class={`status-badge ${instance()!.status}`}>
                {instance()!.status}
              </span>
              <Show when={isLive()}>
                <span class="live-badge">
                  <span class="live-dot" />
                  LIVE
                </span>
              </Show>
            </div>
            <p class="recipe-ref">Recipe: {instance()!.recipe}</p>
          </div>

          <div class="header-actions">
            <button class="action-btn" title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
              </svg>
            </button>
            <button class="action-btn" title="Export">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Metrics */}
        <MetricsSummary metrics={metrics()} />

        {/* Main content grid */}
        <div class="dashboard-grid">
          {/* Left column: Inputs */}
          <div class="grid-column inputs-column">
            <InputPanel
              cellUris={inputCells()}
              title="Input Cells"
            />
          </div>

          {/* Center column: Flow diagram */}
          <div class="grid-column flow-column">
            <h3 class="column-title">Data Flow</h3>
            <FlowDiagram
              cells={instance()!.cells.map(c => ({ uri: c.uri }))}
              propagators={instance()!.propagators.map(p => ({
                uri: p.uri,
                inputs: [],
                output: ''
              }))}
              onNodeClick={handleNodeClick}
            />
          </div>

          {/* Right column: Propagators */}
          <div class="grid-column props-column">
            <h3 class="column-title">Propagators</h3>
            <div class="prop-list">
              <For each={instance()!.propagators}>
                {(prop) => (
                  <PropagatorStatus uri={prop.uri} compact />
                )}
              </For>
            </div>
          </div>
        </div>

        {/* Bottom section: Selected cell timeline */}
        <Show when={selectedCell()}>
          <div class="timeline-section">
            <ValueTimeline
              history={cellHistory()}
              label={`History: ${selectedCell()!.split('/').pop()}`}
              height={80}
            />
          </div>
        </Show>

        {/* Output cells */}
        <Show when={outputCells().length > 0}>
          <div class="outputs-section">
            <h3 class="section-title">Output Values</h3>
            <div class="outputs-grid">
              <For each={outputCells()}>
                {(uri) => (
                  <CellCard
                    uri={uri}
                    showControls={false}
                  />
                )}
              </For>
            </div>
          </div>
        </Show>
      </Show>

      <style>{`
        .instance-dashboard {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 20px;
          min-height: 100%;
        }

        .loading-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 60px;
          color: #8b949e;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #30363d;
          border-top-color: #58a6ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 60px;
          color: #f85149;
          text-align: center;
        }

        .error-state h3 {
          margin: 0;
          font-size: 18px;
        }

        .error-state p {
          margin: 0;
          color: #8b949e;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .instance-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .instance-title h2 {
          margin: 0;
          font-size: 24px;
          color: #c9d1d9;
        }

        .status-badge {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .status-badge.active { background: #23863633; color: #3fb950; }
        .status-badge.stopped { background: #21262d; color: #8b949e; }
        .status-badge.error { background: #f8514933; color: #f85149; }

        .live-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          padding: 3px 8px;
          background: #238636;
          color: white;
          border-radius: 10px;
          font-weight: 600;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          background: white;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .recipe-ref {
          margin: 0;
          font-size: 12px;
          color: #6e7681;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          cursor: pointer;
        }

        .action-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: 250px 1fr 280px;
          gap: 20px;
        }

        @media (max-width: 1200px) {
          .dashboard-grid {
            grid-template-columns: 1fr;
          }
        }

        .grid-column {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .column-title, .section-title {
          margin: 0;
          font-size: 13px;
          font-weight: 600;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .prop-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .timeline-section {
          margin-top: 8px;
        }

        .outputs-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .outputs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }
      `}</style>
    </div>
  )
}

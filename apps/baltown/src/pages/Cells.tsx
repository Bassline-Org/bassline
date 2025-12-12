import { Show, For, createSignal } from 'solid-js'
import { useResource, useBassline } from '@bassline/solid'
import { LatticeVisualizer } from '../components/cells'

export default function Cells() {
  const bl = useBassline()
  const { data: cells, loading, error, refetch } = useResource(() => 'bl:///r/cells')

  const [viewMode, setViewMode] = createSignal<'grid' | 'list'>('grid')
  const [filter, setFilter] = createSignal('')

  // Filter cells by name
  const filteredCells = () => {
    const entries = cells()?.entries || []
    const query = filter().toLowerCase()
    if (!query) return entries
    return entries.filter(
      (cell: any) =>
        cell.name.toLowerCase().includes(query) || cell.lattice?.toLowerCase().includes(query)
    )
  }

  // Group cells by lattice type
  const cellsByLattice = () => {
    const grouped: Record<string, any[]> = {}
    for (const cell of filteredCells()) {
      const lattice = cell.lattice || 'unknown'
      if (!grouped[lattice]) grouped[lattice] = []
      grouped[lattice].push(cell)
    }
    return grouped
  }

  return (
    <div class="cells-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Live Cells</h1>
          <p class="page-subtitle">Real-time view of all cells with lattice-aware controls</p>
        </div>
        <div class="header-actions">
          <input
            type="text"
            class="search-input"
            placeholder="Filter cells..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
          <div class="view-toggle">
            <button
              class={`toggle-btn ${viewMode() === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
            <button
              class={`toggle-btn ${viewMode() === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="4" rx="1" />
                <rect x="3" y="10" width="18" height="4" rx="1" />
                <rect x="3" y="16" width="18" height="4" rx="1" />
              </svg>
            </button>
          </div>
          <button class="btn btn-secondary" onClick={refetch}>
            Refresh
          </button>
        </div>
      </div>

      <Show when={loading()}>
        <div class="empty-state">Loading cells...</div>
      </Show>

      <Show when={error()}>
        <div class="empty-state">
          <h3>Connection Error</h3>
          <p>Make sure the Bassline daemon is running</p>
          <button class="btn btn-secondary" onClick={refetch}>
            Retry
          </button>
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <Show
          when={filteredCells().length > 0}
          fallback={
            <div class="empty-state">
              <h3>No cells found</h3>
              <p>
                {filter() ? 'Try a different search term' : 'Create some cells to see them here'}
              </p>
            </div>
          }
        >
          {/* Stats bar */}
          <div class="cells-stats">
            <span class="stat">{filteredCells().length} cells</span>
            <For each={Object.entries(cellsByLattice())}>
              {([lattice, cells]) => (
                <span class={`stat lattice-${lattice}`}>
                  {cells.length} {lattice}
                </span>
              )}
            </For>
          </div>

          {/* Grid view */}
          <Show when={viewMode() === 'grid'}>
            <div class="cells-grid">
              <For each={filteredCells()}>
                {(cell) => (
                  <div class="cell-card">
                    <div class="cell-header">
                      <span class="cell-name">{cell.name}</span>
                      <Show when={cell.lattice}>
                        <span class={`cell-lattice lattice-${cell.lattice}`}>{cell.lattice}</span>
                      </Show>
                    </div>
                    <div class="cell-content">
                      <LatticeVisualizer uri={`bl:///r/cells/${cell.name}`} showControls={true} />
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* List view - grouped by lattice */}
          <Show when={viewMode() === 'list'}>
            <div class="cells-list">
              <For each={Object.entries(cellsByLattice())}>
                {([lattice, latticeCells]) => (
                  <div class="lattice-group">
                    <h3 class="lattice-group-title">
                      <span class={`lattice-badge lattice-${lattice}`}>{lattice}</span>
                      <span class="lattice-count">{latticeCells.length} cells</span>
                    </h3>
                    <div class="lattice-cells">
                      <For each={latticeCells}>
                        {(cell) => (
                          <div class="cell-row">
                            <span class="cell-name">{cell.name}</span>
                            <div class="cell-visualizer">
                              <LatticeVisualizer
                                uri={`bl:///r/cells/${cell.name}`}
                                compact={true}
                                showControls={true}
                              />
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>

      <style>{`
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .search-input {
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          width: 200px;
        }

        .search-input:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .view-toggle {
          display: flex;
          background: #21262d;
          border-radius: 6px;
          overflow: hidden;
        }

        .toggle-btn {
          padding: 8px 12px;
          background: transparent;
          border: none;
          color: #8b949e;
          cursor: pointer;
        }

        .toggle-btn:hover {
          color: #c9d1d9;
        }

        .toggle-btn.active {
          background: #30363d;
          color: #f0f6fc;
        }

        .cells-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
          padding: 12px 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
        }

        .stat {
          font-size: 13px;
          color: #8b949e;
          padding: 4px 12px;
          background: #21262d;
          border-radius: 16px;
        }

        .stat.lattice-counter { background: #23863633; color: #3fb950; }
        .stat.lattice-maxNumber { background: #1f6feb33; color: #58a6ff; }
        .stat.lattice-minNumber { background: #1f6feb33; color: #58a6ff; }
        .stat.lattice-setUnion { background: #a371f733; color: #a371f7; }
        .stat.lattice-boolean { background: #f8514933; color: #f85149; }
        .stat.lattice-lww { background: #d2992233; color: #d29922; }
        .stat.lattice-object { background: #8b949e33; color: #8b949e; }

        .cells-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
          gap: 20px;
        }

        .cell-card {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 12px;
          overflow: hidden;
        }

        .cell-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid #30363d;
          background: #161b22;
        }

        .cell-name {
          font-weight: 600;
          color: #f0f6fc;
          font-family: monospace;
          font-size: 14px;
        }

        .cell-lattice, .lattice-badge {
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 12px;
          font-weight: 600;
        }

        .lattice-counter { background: #23863633; color: #3fb950; }
        .lattice-maxNumber { background: #1f6feb33; color: #58a6ff; }
        .lattice-minNumber { background: #1f6feb33; color: #58a6ff; }
        .lattice-setUnion { background: #a371f733; color: #a371f7; }
        .lattice-boolean { background: #f8514933; color: #f85149; }
        .lattice-lww { background: #d2992233; color: #d29922; }
        .lattice-object { background: #8b949e33; color: #8b949e; }
        .lattice-unknown { background: #21262d; color: #8b949e; }

        .cell-content {
          padding: 0;
        }

        .cell-content .lattice-visualizer > div {
          border: none;
          border-radius: 0;
        }

        /* List view styles */
        .cells-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .lattice-group {
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 12px;
          overflow: hidden;
        }

        .lattice-group-title {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin: 0;
          background: #161b22;
          border-bottom: 1px solid #30363d;
          font-size: 14px;
          font-weight: 600;
        }

        .lattice-count {
          color: #8b949e;
          font-weight: 400;
          font-size: 12px;
        }

        .lattice-cells {
          padding: 8px;
        }

        .cell-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          border-radius: 8px;
          transition: background 0.15s ease;
        }

        .cell-row:hover {
          background: #161b22;
        }

        .cell-row .cell-name {
          min-width: 150px;
        }

        .cell-visualizer {
          flex: 1;
        }

        .cell-visualizer .lattice-visualizer > div {
          border: none;
          background: transparent;
          padding: 8px;
        }
      `}</style>
    </div>
  )
}

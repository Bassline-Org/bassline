import { For, createMemo } from 'solid-js'

interface ViewTab {
  id: string
  name: string
}

interface ViewTabsProps {
  valType: 'propagator' | 'recipe' | 'handler' | 'cell'
  currentView: string
  onViewChange: (view: string) => void
}

// Default tabs by val type (plain data, no JSX)
const DEFAULT_TABS: Record<string, ViewTab[]> = {
  propagator: [
    { id: 'overview', name: 'Overview' },
    { id: 'source', name: 'Source' },
    { id: 'graph', name: 'Graph' },
    { id: 'usage', name: 'Usage' }
  ],
  recipe: [
    { id: 'overview', name: 'Overview' },
    { id: 'source', name: 'Source' },
    { id: 'instances', name: 'Instances' },
    { id: 'usage', name: 'Usage' }
  ],
  handler: [
    { id: 'overview', name: 'Overview' },
    { id: 'source', name: 'Source' },
    { id: 'usage', name: 'Usage' }
  ],
  cell: [
    { id: 'overview', name: 'Overview' },
    { id: 'source', name: 'Source' },
    { id: 'usage', name: 'Usage' }
  ]
}

// Icon SVG paths by tab id
const ICONS: Record<string, string> = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  source: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  graph: 'M5 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 12h8M12 8v8',
  instances: 'M3 3h18v18H3zM3 9h18M9 21V9',
  usage: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  history: 'M12 12a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2'
}

/**
 * ViewTabs - Tab navigation for different views of a val
 */
export default function ViewTabs(props: ViewTabsProps) {
  const tabs = createMemo(() => {
    return DEFAULT_TABS[props.valType] || DEFAULT_TABS.propagator
  })

  return (
    <div class="view-tabs">
      <For each={tabs()}>
        {(tab) => (
          <button
            class={`view-tab ${props.currentView === tab.id ? 'active' : ''}`}
            onClick={() => props.onViewChange(tab.id)}
          >
            <span class="tab-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d={ICONS[tab.id] || ICONS.overview} />
              </svg>
            </span>
            <span class="tab-name">{tab.name}</span>
          </button>
        )}
      </For>

      <style>{`
        .view-tabs {
          display: flex;
          gap: 2px;
          padding: 4px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .view-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: #8b949e;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .view-tab:hover {
          background: #21262d;
          color: #c9d1d9;
        }

        .view-tab.active {
          background: #21262d;
          color: #c9d1d9;
        }

        .view-tab.active .tab-icon {
          color: #58a6ff;
        }

        .tab-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #6e7681;
        }

        .tab-name {
          font-weight: 500;
        }

        @media (max-width: 600px) {
          .tab-name {
            display: none;
          }

          .view-tab {
            padding: 8px 12px;
          }
        }
      `}</style>
    </div>
  )
}

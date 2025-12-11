import { createSignal, createMemo, Show, For } from 'solid-js'
import { useResource, useBassline } from '@bassline/solid'
import InstanceDashboard from '../dashboard/InstanceDashboard'

interface InstancesViewProps {
  valUri: string
}

interface InstanceEntry {
  name: string
  uri: string
  type: string
  state?: string
  resourceCount: number
  createdAt?: string
}

/**
 * InstancesView - Lists instances of a recipe val and allows viewing details
 */
export default function InstancesView(props: InstancesViewProps) {
  const bl = useBassline()
  const [selectedInstance, setSelectedInstance] = createSignal<string | null>(null)

  // Fetch instances list
  const { data: instancesData, loading, error, refetch } = useResource(
    () => `${props.valUri}/instances`
  )

  const instances = createMemo((): InstanceEntry[] => {
    const data = instancesData()
    if (!data) return []
    return data.entries ?? []
  })

  const hasInstances = createMemo(() => instances().length > 0)

  return (
    <div class="instances-view">
      <Show when={loading()}>
        <div class="loading-state">
          <div class="loading-spinner" />
          <span>Loading instances...</span>
        </div>
      </Show>

      <Show when={error()}>
        <div class="error-state">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <h4>Failed to load instances</h4>
          <p>{error()?.message || 'Unknown error'}</p>
          <button class="btn btn-secondary" onClick={refetch}>Retry</button>
        </div>
      </Show>

      <Show when={!loading() && !error()}>
        <Show when={selectedInstance()} fallback={
          <div class="instances-list-view">
            <div class="list-header">
              <h3>Instances</h3>
              <span class="instance-count">{instances().length} instance{instances().length !== 1 ? 's' : ''}</span>
            </div>

            <Show when={hasInstances()} fallback={
              <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M12 8v8M8 12h8"/>
                </svg>
                <h4>No instances yet</h4>
                <p>Create an instance using the form above to see it here.</p>
              </div>
            }>
              <div class="instances-grid">
                <For each={instances()}>
                  {(instance) => (
                    <button
                      class="instance-card"
                      onClick={() => setSelectedInstance(instance.uri)}
                    >
                      <div class="instance-header">
                        <span class="instance-name">{instance.name}</span>
                        <span class={`state-badge ${instance.state || 'created'}`}>
                          {instance.state || 'created'}
                        </span>
                      </div>
                      <div class="instance-meta">
                        <span class="resource-count">
                          {instance.resourceCount} resource{instance.resourceCount !== 1 ? 's' : ''}
                        </span>
                        <Show when={instance.createdAt}>
                          <span class="created-at">
                            {new Date(instance.createdAt!).toLocaleDateString()}
                          </span>
                        </Show>
                      </div>
                      <div class="view-arrow">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </div>
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        }>
          {/* Instance detail view */}
          <div class="instance-detail-view">
            <button
              class="back-btn"
              onClick={() => setSelectedInstance(null)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              Back to instances
            </button>
            <InstanceDashboard instanceUri={selectedInstance()!} />
          </div>
        </Show>
      </Show>

      <style>{`
        .instances-view {
          min-height: 400px;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px;
          color: #8b949e;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #30363d;
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

        .error-state h4 {
          margin: 0;
          font-size: 16px;
        }

        .error-state p {
          margin: 0;
          color: #8b949e;
          font-size: 13px;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .list-header h3 {
          margin: 0;
          font-size: 16px;
          color: #c9d1d9;
        }

        .instance-count {
          font-size: 12px;
          color: #8b949e;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 60px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          color: #6e7681;
          text-align: center;
        }

        .empty-state h4 {
          margin: 0;
          font-size: 16px;
          color: #8b949e;
        }

        .empty-state p {
          margin: 0;
          font-size: 13px;
        }

        .instances-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 12px;
        }

        .instance-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px;
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .instance-card:hover {
          border-color: #58a6ff;
          background: #1c2128;
        }

        .instance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .instance-name {
          font-size: 14px;
          font-weight: 500;
          color: #c9d1d9;
          font-family: monospace;
        }

        .state-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .state-badge.created { background: #23863633; color: #3fb950; }
        .state-badge.running { background: #58a6ff33; color: #58a6ff; }
        .state-badge.stopped { background: #21262d; color: #8b949e; }
        .state-badge.error { background: #f8514933; color: #f85149; }

        .instance-meta {
          display: flex;
          gap: 12px;
          font-size: 12px;
          color: #8b949e;
        }

        .view-arrow {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #484f58;
          transition: all 0.15s ease;
        }

        .instance-card:hover .view-arrow {
          color: #58a6ff;
          transform: translateY(-50%) translateX(2px);
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          margin-bottom: 16px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #8b949e;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .back-btn:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .btn {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-secondary {
          background: #21262d;
          border: 1px solid #30363d;
          color: #c9d1d9;
        }

        .btn-secondary:hover {
          background: #30363d;
        }
      `}</style>
    </div>
  )
}

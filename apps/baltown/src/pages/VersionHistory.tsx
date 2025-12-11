import { useParams, A } from '@solidjs/router'
import { Show, For, createSignal } from 'solid-js'
import { useResource } from '@bassline/solid'

export default function VersionHistory() {
  const params = useParams()
  const [selectedVersion, setSelectedVersion] = createSignal<number | null>(null)

  const valUri = () => `bl:///r/vals/${params.owner}/${params.name}`
  const versionsUri = () => `bl:///r/vals/${params.owner}/${params.name}/versions`

  const { data: val, loading: valLoading } = useResource(valUri)
  const { data: versions, loading: versionsLoading, error } = useResource(versionsUri)

  // Fetch specific version when selected
  const versionUri = () => selectedVersion() ? `bl:///r/vals/${params.owner}/${params.name}/versions/${selectedVersion()}` : null
  const { data: versionData } = useResource(versionUri)

  return (
    <div class="version-history">
      <div class="page-header">
        <div>
          <A href={`/v/${params.owner}/${params.name}`} class="back-link">
            ← Back to {params.owner}/{params.name}
          </A>
          <h1 class="page-title">Version History</h1>
          <p class="page-subtitle">
            <Show when={val()}>
              {val().name} - {versions()?.entries?.length || 0} versions
            </Show>
          </p>
        </div>
      </div>

      <Show when={versionsLoading()}>
        <div class="empty-state">Loading versions...</div>
      </Show>

      <Show when={error()}>
        <div class="empty-state">
          <h3>Error loading versions</h3>
          <p>{error()?.message}</p>
        </div>
      </Show>

      <Show when={!versionsLoading() && !error()}>
        <div class="version-layout">
          <div class="version-list">
            <Show when={versions()?.entries?.length > 0} fallback={
              <div class="empty-state">No versions found</div>
            }>
              <For each={versions()?.entries}>
                {(version) => (
                  <div
                    class={`version-item ${selectedVersion() === version.version ? 'selected' : ''}`}
                    onClick={() => setSelectedVersion(version.version)}
                  >
                    <div class="version-header">
                      <span class="version-number">v{version.version}</span>
                      <Show when={version.version === val()?.version}>
                        <span class="current-badge">Current</span>
                      </Show>
                    </div>
                    <div class="version-meta">
                      <span class="version-date">
                        {new Date(version.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>

          <div class="version-detail">
            <Show when={selectedVersion() && versionData()} fallback={
              <div class="empty-state">
                <p>Select a version to view its definition</p>
              </div>
            }>
              <div class="card">
                <div class="card-header">
                  <span class="card-title">Version {selectedVersion()} Definition</span>
                </div>
                <pre class="json-preview">{JSON.stringify(versionData()?.definition || versionData(), null, 2)}</pre>
              </div>

              <Show when={selectedVersion() !== val()?.version}>
                <div class="version-actions">
                  <button class="btn btn-secondary" disabled>
                    Restore this version (coming soon)
                  </button>
                </div>
              </Show>
            </Show>
          </div>
        </div>
      </Show>

      <style>{`
        .back-link {
          color: #58a6ff;
          text-decoration: none;
          font-size: 13px;
          display: inline-block;
          margin-bottom: 8px;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        .version-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
        }

        @media (max-width: 768px) {
          .version-layout {
            grid-template-columns: 1fr;
          }
        }

        .version-list {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .version-item {
          padding: 12px 16px;
          border-bottom: 1px solid #30363d;
          cursor: pointer;
          transition: background 0.2s;
        }

        .version-item:last-child {
          border-bottom: none;
        }

        .version-item:hover {
          background: #21262d;
        }

        .version-item.selected {
          background: #1f6feb33;
          border-left: 3px solid #58a6ff;
        }

        .version-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }

        .version-number {
          font-weight: 600;
          color: #f0f6fc;
        }

        .current-badge {
          font-size: 11px;
          padding: 2px 6px;
          background: #238636;
          color: white;
          border-radius: 10px;
        }

        .version-meta {
          font-size: 12px;
          color: #8b949e;
        }

        .version-detail {
          min-height: 300px;
        }

        .version-actions {
          margin-top: 16px;
        }
      `}</style>
    </div>
  )
}

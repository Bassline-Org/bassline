import { createResource, For, Show, createMemo } from 'solid-js'
import { A } from '@solidjs/router'
import { useBassline } from '@bassline/solid'

interface UsageViewProps {
  uri: string
}

interface UsageItem {
  uri: string
  type: string
  name: string
  relationshipType: string
}

/**
 * UsageView - Shows what references this resource (backlinks)
 */
export default function UsageView(props: UsageViewProps) {
  const bl = useBassline()

  // Fetch backlinks
  const [backlinks] = createResource(
    () => props.uri,
    async (uri) => {
      try {
        const response = await bl.get(`bl:///links/to${uri.replace('bl://', '')}`)
        return response.body?.links || response.body || []
      } catch {
        return []
      }
    }
  )

  // Parse backlinks into usage items
  const usageItems = createMemo((): UsageItem[] => {
    const links = backlinks()
    if (!Array.isArray(links)) return []

    return links.map((link: any) => {
      const uri = typeof link === 'string' ? link : link.uri
      const name = uri.split('/').pop() || 'unknown'

      // Determine type from URI
      let type = 'resource'
      if (uri.includes('/propagators/')) type = 'propagator'
      else if (uri.includes('/cells/')) type = 'cell'
      else if (uri.includes('/vals/')) type = 'val'
      else if (uri.includes('/recipes/')) type = 'recipe'
      else if (uri.includes('/handlers/')) type = 'handler'

      return {
        uri,
        type,
        name,
        relationshipType: link.relationship || 'references'
      }
    })
  })

  // Group by type
  const groupedUsage = createMemo(() => {
    const items = usageItems()
    const groups: Record<string, UsageItem[]> = {}

    items.forEach(item => {
      if (!groups[item.type]) groups[item.type] = []
      groups[item.type].push(item)
    })

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  })

  // URI to link path
  function uriToPath(uri: string): string {
    // Convert bl:///vals/owner/name to /v/owner/name
    const match = uri.match(/bl:\/\/\/(?:r\/)?vals\/([^/]+)\/([^/]+)/)
    if (match) return `/v/${match[1]}/${match[2]}`

    // For other URIs, link to explore view
    return `/explore?uri=${encodeURIComponent(uri)}`
  }

  return (
    <div class="usage-view">
      <div class="usage-header">
        <h3>Usage</h3>
        <span class="usage-count">{usageItems().length} references</span>
      </div>

      <Show when={backlinks.loading}>
        <div class="loading-state">
          <div class="loading-spinner" />
          <span>Finding references...</span>
        </div>
      </Show>

      <Show when={!backlinks.loading && usageItems().length === 0}>
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
          </svg>
          <h4>No references found</h4>
          <p>Nothing currently references this resource.</p>
        </div>
      </Show>

      <Show when={!backlinks.loading && usageItems().length > 0}>
        <div class="usage-groups">
          <For each={groupedUsage()}>
            {([type, items]) => (
              <div class="usage-group">
                <div class="group-header">
                  <span class={`type-badge ${type}`}>{type}</span>
                  <span class="group-count">{items.length}</span>
                </div>

                <div class="group-items">
                  <For each={items}>
                    {(item) => (
                      <A href={uriToPath(item.uri)} class="usage-item">
                        <div class="item-icon">
                          <ItemIcon type={item.type} />
                        </div>
                        <div class="item-info">
                          <span class="item-name">{item.name}</span>
                          <span class="item-uri">{item.uri}</span>
                        </div>
                        <span class="item-relationship">{item.relationshipType}</span>
                      </A>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <style>{`
        .usage-view {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          overflow: hidden;
        }

        .usage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #21262d;
          border-bottom: 1px solid #30363d;
        }

        .usage-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #c9d1d9;
        }

        .usage-count {
          font-size: 12px;
          color: #8b949e;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #8b949e;
        }

        .loading-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid #30363d;
          border-top-color: #58a6ff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 40px;
          color: #6e7681;
          text-align: center;
        }

        .empty-state h4 {
          margin: 0;
          font-size: 14px;
          color: #8b949e;
        }

        .empty-state p {
          margin: 0;
          font-size: 12px;
        }

        .usage-groups {
          display: flex;
          flex-direction: column;
        }

        .usage-group {
          border-bottom: 1px solid #21262d;
        }

        .usage-group:last-child {
          border-bottom: none;
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: #0d1117;
        }

        .type-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 10px;
          text-transform: uppercase;
        }

        .type-badge.propagator { background: #f0883e22; color: #f0883e; }
        .type-badge.cell { background: #388bfd22; color: #58a6ff; }
        .type-badge.val { background: #a371f722; color: #a371f7; }
        .type-badge.recipe { background: #3fb95022; color: #3fb950; }
        .type-badge.handler { background: #f778ba22; color: #f778ba; }
        .type-badge.resource { background: #21262d; color: #8b949e; }

        .group-count {
          font-size: 11px;
          color: #6e7681;
        }

        .group-items {
          display: flex;
          flex-direction: column;
        }

        .usage-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .usage-item:hover {
          background: #21262d;
        }

        .item-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #21262d;
          border-radius: 6px;
          color: #8b949e;
        }

        .usage-item:hover .item-icon {
          background: #30363d;
        }

        .item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .item-name {
          font-weight: 500;
          font-size: 13px;
          color: #c9d1d9;
        }

        .item-uri {
          font-size: 11px;
          color: #6e7681;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .item-relationship {
          font-size: 10px;
          color: #6e7681;
          padding: 2px 6px;
          background: #21262d;
          border-radius: 4px;
        }
      `}</style>
    </div>
  )
}

function ItemIcon(props: { type: string }) {
  switch (props.type) {
    case 'propagator':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 12h4l3-9 6 18 3-9h4"/>
        </svg>
      )
    case 'cell':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
      )
    case 'recipe':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
        </svg>
      )
    case 'handler':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      )
  }
}

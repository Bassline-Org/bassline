import { createSignal, createResource, For, Show, onMount, onCleanup } from 'solid-js'
import { useBassline, useWebSocket } from '@bassline/solid'

interface ActivityEntry {
  id: number
  timestamp: string
  uri: string
  type?: string
  operation?: string
}

/**
 * ActivityStream - Real-time activity feed showing plumber events
 */
export default function ActivityStream() {
  const bl = useBassline()
  const [activities, setActivities] = createSignal<ActivityEntry[]>([])
  const [connected, setConnected] = createSignal(false)

  // Fetch initial activity from dashboard
  const [initialActivity] = createResource(async () => {
    try {
      const res = await bl.get('bl:///r/activity')
      return res?.body?.recent || []
    } catch {
      return []
    }
  })

  // Set initial activities
  onMount(() => {
    const initial = initialActivity()
    if (initial?.length) {
      setActivities(
        initial.slice(-20).map((entry: any, i: number) => ({
          id: Date.now() - i,
          timestamp: entry.timestamp || new Date().toISOString(),
          uri: entry.uri || 'unknown',
          type: entry.headers?.type,
          operation: 'PUT',
        }))
      )
    }
  })

  // Format timestamp for display
  function formatTime(ts: string) {
    try {
      const date = new Date(ts)
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    } catch {
      return '--:--:--'
    }
  }

  // Extract resource name from URI
  function getResourceName(uri: string) {
    const parts = uri.split('/')
    return parts[parts.length - 1] || uri
  }

  // Get resource type from URI
  function getResourceType(uri: string): 'cell' | 'propagator' | 'recipe' | 'other' {
    if (uri.includes('/cells/')) return 'cell'
    if (uri.includes('/propagators/')) return 'propagator'
    if (uri.includes('/recipes/')) return 'recipe'
    return 'other'
  }

  return (
    <div class="activity-stream">
      <Show when={activities().length > 0}>
        <div class="activity-list">
          <For each={activities()}>
            {(entry) => {
              const type = getResourceType(entry.uri)
              return (
                <div class="activity-entry">
                  <span class="activity-time">{formatTime(entry.timestamp)}</span>
                  <span class={`activity-type ${type}`}>{type[0].toUpperCase()}</span>
                  <span class="activity-name">{getResourceName(entry.uri)}</span>
                  <Show when={entry.type}>
                    <span class="activity-event">{entry.type?.split('/').pop()}</span>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </Show>

      <Show when={activities().length === 0}>
        <div class="activity-empty">
          <span>No recent activity</span>
        </div>
      </Show>

      <style>{`
        .activity-stream {
          flex: 1;
          overflow-y: auto;
          background: #0d1117;
        }

        .activity-list {
          display: flex;
          flex-direction: column;
        }

        .activity-entry {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          border-bottom: 1px solid #21262d;
          font-size: 12px;
        }

        .activity-entry:hover {
          background: #161b22;
        }

        .activity-time {
          font-family: monospace;
          color: #6e7681;
          flex-shrink: 0;
        }

        .activity-type {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .activity-type.cell {
          background: #388bfd22;
          color: #58a6ff;
        }

        .activity-type.propagator {
          background: #f0883e22;
          color: #f0883e;
        }

        .activity-type.recipe {
          background: #3fb95022;
          color: #3fb950;
        }

        .activity-type.other {
          background: #6e768122;
          color: #8b949e;
        }

        .activity-name {
          flex: 1;
          color: #c9d1d9;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .activity-event {
          padding: 2px 6px;
          background: #21262d;
          border-radius: 4px;
          font-size: 10px;
          color: #8b949e;
          flex-shrink: 0;
        }

        .activity-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          color: #6e7681;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}

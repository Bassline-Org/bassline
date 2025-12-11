import { createSignal, Show, For } from 'solid-js'
import { useBassline } from '@bassline/solid'

interface TagChipsProps {
  uri: string
  value: any[] | Set<any>
  label?: string
  allowAdd?: boolean
  colorMap?: Record<string, string>
}

/**
 * TagChips - Tag/chip display for setUnion lattice
 *
 * Shows set elements as interactive chips with add capability.
 */
export default function TagChips(props: TagChipsProps) {
  const bl = useBassline()
  const [newTag, setNewTag] = createSignal('')
  const [adding, setAdding] = createSignal(false)
  const [recentlyAdded, setRecentlyAdded] = createSignal<string | null>(null)

  // Convert value to array
  const tags = () => {
    const val = props.value
    if (!val) return []
    if (Array.isArray(val)) return val
    if (val instanceof Set) return Array.from(val)
    return []
  }

  // Get color for a tag
  const getTagColor = (tag: string) => {
    if (props.colorMap?.[tag]) return props.colorMap[tag]

    // Generate consistent color from string hash
    let hash = 0
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash)
    }
    const colors = ['#58a6ff', '#3fb950', '#a371f7', '#f85149', '#d29922', '#8b949e']
    return colors[Math.abs(hash) % colors.length]
  }

  // Add a new tag
  async function addTag() {
    const tag = newTag().trim()
    if (!tag) return

    setAdding(true)
    try {
      // For setUnion, we send the element to add (it will be unioned with existing set)
      await bl.put(`${props.uri}/value`, {}, [tag])
      setRecentlyAdded(tag)
      setNewTag('')
      setTimeout(() => setRecentlyAdded(null), 1000)
    } catch (err) {
      console.error('Failed to add tag:', err)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div class="tag-chips">
      <Show when={props.label}>
        <div class="tag-chips-label">{props.label}</div>
      </Show>

      <div class="tag-chips-header">
        <span class="tag-count">{tags().length} items</span>
        <span class="tag-type">setUnion (accumulating)</span>
      </div>

      <Show when={tags().length === 0}>
        <div class="tag-chips-empty">
          No items yet. Add some below.
        </div>
      </Show>

      <div class="tag-chips-list">
        <For each={tags()}>
          {(tag) => (
            <span
              class={`tag-chip ${recentlyAdded() === String(tag) ? 'animate-pop' : ''}`}
              style={{
                '--chip-color': getTagColor(String(tag)),
                background: `${getTagColor(String(tag))}22`,
                border: `1px solid ${getTagColor(String(tag))}44`
              }}
            >
              <span class="tag-text">{String(tag)}</span>
            </span>
          )}
        </For>
      </div>

      <Show when={props.allowAdd !== false}>
        <div class="tag-add">
          <input
            type="text"
            class="tag-input"
            placeholder="Add item..."
            value={newTag()}
            onInput={(e) => setNewTag(e.currentTarget.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
          <button
            class="tag-add-btn"
            onClick={addTag}
            disabled={adding() || !newTag().trim()}
          >
            {adding() ? '...' : 'Add'}
          </button>
        </div>
      </Show>

      <style>{`
        .tag-chips {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 8px;
          padding: 16px;
        }

        .tag-chips-label {
          font-size: 12px;
          color: #8b949e;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .tag-chips-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
          font-size: 12px;
        }

        .tag-count {
          color: #c9d1d9;
          font-weight: 600;
        }

        .tag-type {
          color: #8b949e;
          font-style: italic;
        }

        .tag-chips-empty {
          padding: 20px;
          text-align: center;
          color: #8b949e;
          font-size: 13px;
          background: #0d1117;
          border-radius: 6px;
        }

        .tag-chips-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-height: 32px;
        }

        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 13px;
          color: var(--chip-color);
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .tag-chip:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .tag-chip.animate-pop {
          animation: pop 0.3s ease;
        }

        @keyframes pop {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        .tag-text {
          font-weight: 500;
        }

        .tag-add {
          display: flex;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #30363d;
        }

        .tag-input {
          flex: 1;
          padding: 8px 12px;
          background: #0d1117;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
        }

        .tag-input:focus {
          outline: none;
          border-color: #58a6ff;
        }

        .tag-add-btn {
          padding: 8px 16px;
          background: #238636;
          border: none;
          border-radius: 6px;
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .tag-add-btn:hover:not(:disabled) {
          background: #2ea043;
        }

        .tag-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

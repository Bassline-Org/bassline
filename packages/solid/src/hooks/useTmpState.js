import { createSignal, createEffect } from 'solid-js'
import { useBassline, useLiveResource } from '../index.jsx'

/**
 * Hook for bidirectional sync with tmp/state
 *
 * Creates ephemeral state that syncs with the server. External systems
 * (CLI, Claude, other UIs) can read/write this state and the component
 * will update automatically.
 * @template T
 * @param {string | (() => string)} name - State name (can be reactive accessor)
 * @param {T} [initialValue] - Default value if state doesn't exist
 * @returns {[() => T | undefined, (value: T | ((prev: T) => T)) => void, { loading: () => boolean, error: () => Error | null, synced: () => boolean, reset: () => void }]}
 * @example
 * function EditorPanel() {
 *   const [mode, setMode] = useTmpState('editor/mode', 'edit')
 *
 *   return (
 *     <select value={mode()} onChange={e => setMode(e.target.value)}>
 *       <option value="edit">Edit</option>
 *       <option value="view">View</option>
 *     </select>
 *   )
 * }
 */
export function useTmpState(name, initialValue) {
  const bl = useBassline()
  const uri = () => `bl:///tmp/state/${typeof name === 'function' ? name() : name}`

  // Use existing useLiveResource for subscription
  const { data, loading, error, refetch } = useLiveResource(uri)

  const [localValue, setLocalValue] = createSignal(initialValue)
  const [synced, setSynced] = createSignal(false)
  let initialized = false

  // Sync from server to local
  createEffect(() => {
    const serverData = data()
    if (serverData !== undefined) {
      setLocalValue(() => serverData)
      setSynced(true)
    } else if (!initialized && initialValue !== undefined && !loading()) {
      // Initialize on server if doesn't exist
      initialized = true
      bl.put(uri(), {}, initialValue).then(() => {
        setSynced(true)
        refetch()
      })
    }
  })

  const set = (valueOrFn) => {
    const prev = localValue()
    const newValue = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn
    setLocalValue(() => newValue)
    setSynced(false)
    bl.put(uri(), {}, newValue)
      .then(() => setSynced(true))
      .catch((err) => console.error('useTmpState write error:', err))
  }

  const reset = () => {
    if (initialValue !== undefined) set(initialValue)
  }

  return [localValue, set, { loading, error, synced, reset }]
}

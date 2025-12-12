import { useState, useEffect, useCallback, useRef } from 'react'
import { useBassline, useLiveResource } from '../index.jsx'

/**
 * Hook for bidirectional sync with tmp/state
 *
 * Creates ephemeral state that syncs with the server. External systems
 * (CLI, Claude, other UIs) can read/write this state and the component
 * will update automatically.
 * @template T
 * @param {string} name - State name (can include slashes like 'editor/selection')
 * @param {T} [initialValue] - Default value if state doesn't exist
 * @returns {[T | undefined, (value: T | ((prev: T) => T)) => void, { loading: boolean, error: Error | null, synced: boolean, reset: () => void }]}
 * @example
 * function EditorPanel() {
 *   const [mode, setMode] = useTmpState('editor/mode', 'edit')
 *
 *   // External systems can control via:
 *   // await bl.put('bl:///tmp/state/editor/mode', {}, 'view')
 *
 *   return (
 *     <select value={mode} onChange={e => setMode(e.target.value)}>
 *       <option value="edit">Edit</option>
 *       <option value="view">View</option>
 *     </select>
 *   )
 * }
 */
export function useTmpState(name, initialValue) {
  const bl = useBassline()
  const uri = `bl:///tmp/state/${name}`

  // Use existing useLiveResource for subscription
  const { data, loading, error, refetch } = useLiveResource(uri)

  const [localValue, setLocalValue] = useState(initialValue)
  const [synced, setSynced] = useState(false)
  const initialized = useRef(false)

  // Sync from server to local
  useEffect(() => {
    if (data?.body !== undefined) {
      setLocalValue(data.body)
      setSynced(true)
    } else if (!initialized.current && initialValue !== undefined && !loading) {
      // Initialize on server if doesn't exist
      initialized.current = true
      bl.put(uri, {}, initialValue).then(() => {
        setSynced(true)
        refetch()
      })
    }
  }, [data, loading, bl, uri, initialValue, refetch])

  const set = useCallback(
    (valueOrFn) => {
      setLocalValue((prev) => {
        const newValue = typeof valueOrFn === 'function' ? valueOrFn(prev) : valueOrFn
        setSynced(false)
        bl.put(uri, {}, newValue)
          .then(() => setSynced(true))
          .catch((err) => console.error('useTmpState write error:', err))
        return newValue
      })
    },
    [bl, uri]
  )

  const reset = useCallback(() => {
    if (initialValue !== undefined) set(initialValue)
  }, [set, initialValue])

  return [localValue, set, { loading, error, synced, reset }]
}

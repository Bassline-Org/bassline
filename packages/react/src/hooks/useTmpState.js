import { useState, useEffect, useCallback, useRef } from 'react'
import { useBassline, useLiveResource, usePlumberRule } from '../index.jsx'

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

// TODO: Not a real UUID
const randomUUID = () => Math.random().toString(36).substring(2, 15)

export function useTmpState(name = randomUUID(), initialValue) {
  const bl = useBassline()
  const uri = `bl:///tmp/state/${name}`
  const [value, setValue] = useState(null)

  usePlumberRule(`${name}-from-tmp-state`, { port: uri })

  useEffect(() => {
    return () => {}
  }, [])

  const set = useCallback(
    (value) => {
      bl.put(`${uri}/value`, {}, value)
    },
    [bl, uri]
  )

  return [value, set]
}

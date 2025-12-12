import { onCleanup } from 'solid-js'
import { useBassline } from '../index.jsx'
import { useTmpState } from './useTmpState.js'
import { usePlumberRule } from './usePlumberRule.js'

/**
 * Hook for bidirectional sync with a Bassline cell
 *
 * Creates a tmp/state proxy with two plumber rules that bridge to the cell:
 * - Rule 1: cell-updates → tmp/state (cell changes sync to UI)
 * - Rule 2: tmp-state-changed → cell (UI changes sync to cell)
 * @template T
 * @param {string | (() => string)} cellName - Name of the cell (can be reactive)
 * @param {object} [options] - Options
 * @param {string} [options.proxyName] - Custom tmp/state name
 * @returns {[() => T | undefined, (value: T | ((prev: T) => T)) => void, { loading: () => boolean, error: () => Error | null, synced: () => boolean }]}
 * @example
 * function Counter() {
 *   const [count, setCount, { synced }] = useCell('counter')
 *
 *   return (
 *     <div>
 *       <span>{count() ?? 0}</span>
 *       {!synced() && <span class="syncing">...</span>}
 *       <button onClick={() => setCount((c) => (c ?? 0) + 1)}>+</button>
 *     </div>
 *   )
 * }
 */
export function useCell(cellName, options = {}) {
  const bl = useBassline()
  const getCellName = () => (typeof cellName === 'function' ? cellName() : cellName)
  const proxyName = options.proxyName || `_cell/${getCellName()}`
  const proxyUri = `bl:///tmp/state/${proxyName}`
  const cellUri = `bl:///cells/${getCellName()}`
  const cellValueUri = `${cellUri}/value`

  // Rule: cell changes → tmp/state proxy (reads)
  usePlumberRule(
    `${proxyName}-from-cell`,
    { port: 'cell-updates', body: { source: cellUri } },
    proxyUri
  )

  // Rule: tmp/state proxy changes → cell (writes)
  usePlumberRule(
    `${proxyName}-to-cell`,
    { port: 'tmp-state-changed', body: { uri: proxyUri } },
    cellValueUri
  )

  // Use useTmpState for the actual subscription and setter
  const [value, setValue, meta] = useTmpState(proxyName)

  // Cleanup proxy on unmount
  onCleanup(() => {
    bl.put(`${proxyUri}/delete`, {}, {}).catch((err) =>
      console.error('useCell cleanup error:', err)
    )
  })

  return [value, setValue, meta]
}

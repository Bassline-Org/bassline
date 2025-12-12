import { useState, useEffect } from 'react'
import { useBassline } from '../index.jsx'

/**
 * Hook to create and manage a plumber rule tied to component lifecycle
 *
 * Creates a rule on mount that forwards matching messages to a destination.
 * The rule is automatically killed when the component unmounts.
 * @param {string} ruleName - Unique name for the rule
 * @param {object} match - Pattern to match messages
 * @param {string} to - Destination URI to forward matching messages
 * @returns {{ error: Error | null }}
 * @example
 * // Forward all timer ticks to a tmp/state cell
 * function Dashboard() {
 *   usePlumberRule(
 *     'dashboard-timer',
 *     { port: 'timer-tick' },
 *     'bl:///tmp/state/dashboard/lastTick'
 *   )
 *
 *   const [lastTick] = useTmpState('dashboard/lastTick')
 *   return <p>Last tick: {lastTick?.time}</p>
 * }
 * @example
 * // Forward specific cell updates to a tmp/state cell
 * usePlumberRule(
 *   'counter-watcher',
 *   { port: 'cell-updates', body: { source: 'bl:///cells/counter' } },
 *   'bl:///tmp/state/counter-value'
 * )
 */
export function usePlumberRule(ruleName, match, to) {
  const bl = useBassline()
  const ruleUri = `bl:///plumb/rules/${ruleName}`
  const [error, setError] = useState(null)

  useEffect(() => {
    // Create rule on mount
    bl.put(ruleUri, {}, { match, to }).catch((err) => {
      console.error('usePlumberRule create error:', err)
      setError(err)
    })

    return () => {
      // Kill rule on unmount
      bl.put(`${ruleUri}/kill`, {}, {}).catch((err) =>
        console.error('usePlumberRule kill error:', err)
      )
    }
  }, [bl, ruleUri, to, JSON.stringify(match)])

  return { error }
}

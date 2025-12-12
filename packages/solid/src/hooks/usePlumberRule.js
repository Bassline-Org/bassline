import { createSignal, onCleanup } from 'solid-js'
import { useBassline } from '../index.jsx'

/**
 * Hook to create and manage a plumber rule tied to component lifecycle
 *
 * Creates a rule on mount that forwards matching messages to a destination.
 * The rule is automatically killed when the component unmounts.
 * @param {string} ruleName - Unique name for the rule
 * @param {object} match - Pattern to match messages
 * @param {string} to - Destination URI to forward matching messages
 * @returns {{ error: () => Error | null }}
 * @example
 * function Dashboard() {
 *   usePlumberRule(
 *     'dashboard-timer',
 *     { port: 'timer-tick' },
 *     'bl:///tmp/state/dashboard/lastTick'
 *   )
 *
 *   const [lastTick] = useTmpState('dashboard/lastTick')
 *   return <p>Last tick: {lastTick()?.time}</p>
 * }
 */
export function usePlumberRule(ruleName, match, to) {
  const bl = useBassline()
  const ruleUri = `bl:///plumb/rules/${ruleName}`
  const [error, setError] = createSignal(null)

  // Create rule immediately
  bl.put(ruleUri, {}, { match, to }).catch((err) => {
    console.error('usePlumberRule create error:', err)
    setError(err)
  })

  // Kill rule on cleanup
  onCleanup(() => {
    bl.put(`${ruleUri}/kill`, {}, {}).catch((err) =>
      console.error('usePlumberRule kill error:', err)
    )
  })

  return { error }
}

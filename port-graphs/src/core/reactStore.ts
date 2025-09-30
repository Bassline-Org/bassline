/**
 * React-aware store for integrating gadgets with React state management
 *
 * This store notifies React when state updates occur, enabling automatic
 * re-renders without manual subscription management.
 */

import { Store } from './context';

/**
 * Creates a store that notifies React on state updates
 *
 * @param initial - Initial state value
 * @param notifyReact - Callback to trigger React re-render
 * @returns Store that integrates with React's state system
 *
 * @example
 * ```typescript
 * const [listeners] = useState(() => new Set<() => void>());
 * const notify = () => listeners.forEach(fn => fn());
 *
 * const store = reactStore(0, notify);
 * const gadget = realize(maxProto, store);
 *
 * // In component:
 * useSyncExternalStore(
 *   (onStoreChange) => {
 *     listeners.add(onStoreChange);
 *     return () => listeners.delete(onStoreChange);
 *   },
 *   () => gadget.current()
 * );
 * ```
 */
export function reactStore<T>(
  initial: T,
  notifyReact: () => void
): Store<T> {
  let state = initial;
  return {
    current: () => state,
    update: (newState: T) => {
      state = newState;
      notifyReact(); // Trigger React re-render via listener notification
    }
  } as const satisfies Store<T>;
}

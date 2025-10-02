/**
 * useGadget - Subscribe to an existing gadget's state
 *
 * Use this hook when you have a gadget defined outside the component
 * (module-level, passed as prop, or from context) and need to subscribe
 * to its changes within a React component.
 *
 * @param gadget - Any gadget that implements Valued<T> protocol
 * @returns Tuple of [currentValue, gadget] - value for rendering, gadget for operations
 *
 * @example
 * ```tsx
 * // Module-level gadget
 * const sharedCounter = cells.max(0)
 *
 * function Component() {
 *   const [count, counter] = useGadget(sharedCounter)
 *   return (
 *     <button onClick={() => counter.receive(count + 1)}>
 *       Count: {count}
 *     </button>
 *   )
 * }
 * ```
 */

import { useSyncExternalStore } from 'react';
import type { Implements } from 'port-graphs';
import { Valued } from 'port-graphs/protocols';

export function useGadget<T, G extends Implements<Valued<T>>>(
  gadget: G
): readonly [T, G] {
  const value = useSyncExternalStore(
    (callback) => {
      // Subscribe using gadget's .tap() method
      // Note: We tap the effects and call callback on { changed }
      const cleanup = gadget.tap(({ changed }) => {
        if (changed !== undefined) {
          callback();
        }
      });
      return cleanup;
    },
    () => gadget.current()
  );

  return [value, gadget] as const;
}
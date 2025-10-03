/**
 * useLocalGadget - Create a component-local gadget
 *
 * Use this hook when you need a gadget that exists only within a single component.
 * The gadget is created once on mount and automatically cleaned up on unmount.
 *
 * @param factory - Function that creates the gadget (called once on mount)
 * @returns Tuple of [currentValue, gadget] - value for rendering, gadget for operations
 *
 * @example
 * ```tsx
 * function Component() {
 *   const [count, counter] = useLocalGadget(() => cells.max(0))
 *   const [name, nameCell] = useLocalGadget(() => cells.ordinal('Alice'))
 *
 *   return (
 *     <div>
 *       <button onClick={() => counter.receive(count + 1)}>
 *         Count: {count}
 *       </button>
 *       <input
 *         value={name[1]}
 *         onChange={e => nameCell.receive([name[0] + 1, e.target.value])}
 *       />
 *     </div>
 *   )
 * }
 * ```
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { Implements } from '@bassline/core';
import { Valued } from '@bassline/core/protocols';

export function useLocalGadget<T, G>(
  factory: () => G & Implements<Valued<T>>
): readonly [T, G & Implements<Valued<T>>] {
  // Create gadget once on mount
  const gadget = useMemo(factory, []);

  // Subscribe to changes
  const value = useSyncExternalStore(
    (callback) => {
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

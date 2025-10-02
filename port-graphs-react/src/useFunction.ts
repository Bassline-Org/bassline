/**
 * useFunction - Create a component-local function gadget
 *
 * Use this hook when you need a reactive function (transform, partial, fallible)
 * that exists within a component. Function gadgets can be called, composed with
 * fanOut(), and observed for results.
 *
 * @param factory - Function that creates the function gadget (called once on mount)
 * @returns Tuple of [result, func] - computed result for rendering, function for operations
 *
 * @example
 * ```tsx
 * function Pipeline() {
 *   const [doubled, doubler] = useFunction(() => fn.map((x: number) => x * 2))
 *   const [result, consumer] = useFunction(() => fn.map((x: number) => x + 1))
 *
 *   // Wire them together
 *   useEffect(() => {
 *     return doubler.fanOut().to(consumer).build()
 *   }, [doubler, consumer])
 *
 *   return (
 *     <div>
 *       <button onClick={() => doubler.call(10)}>Process 10</button>
 *       <div>Doubled: {doubled}</div>
 *       <div>Result: {result}</div>
 *     </div>
 *   )
 * }
 * ```
 */

import { useMemo, useSyncExternalStore } from 'react';
import type { SweetFunction } from 'port-graphs';

export function useFunction<I, O>(
  factory: () => SweetFunction<I, O>
): readonly [O | undefined, SweetFunction<I, O>] {
  // Create function gadget once on mount
  const func = useMemo(factory, []);

  // Subscribe to computed results
  const result = useSyncExternalStore(
    (callback) => {
      const cleanup = func.whenComputed(() => callback());
      return cleanup;
    },
    // @ts-ignore TODO: fix this
    () => func.current()?.result
  );

  return [result, func] as const;
}

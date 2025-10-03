/**
 * useDerive - Create a derived/computed value from multiple sources
 *
 * This hook wraps the derive() function from @bassline/core sugar, allowing you to
 * create reactive computations that automatically update when any source changes.
 *
 * The derive() function requires gadgets as sources (not just values), which is why
 * this hook takes gadgets and not values.
 *
 * @param sources - Record of source gadgets { key: gadget }
 * @param compute - Function that computes the result from source values
 * @returns Tuple of [computedValue, derivedFunction] - value for rendering, function for operations
 *
 * @example
 * ```tsx
 * function Form() {
 *   const [a, cellA] = useLocalGadget(() => cells.max(0))
 *   const [b, cellB] = useLocalGadget(() => cells.max(0))
 *
 *   // Derive sum from multiple sources
 *   const [sum, sumFunc] = useDerive(
 *     { a: cellA, b: cellB },
 *     ({ a, b }) => a + b
 *   )
 *
 *   return (
 *     <div>
 *       <input type="number" value={a} onChange={e => cellA.receive(+e.target.value)} />
 *       <input type="number" value={b} onChange={e => cellB.receive(+e.target.value)} />
 *       <div>Sum: {sum}</div>
 *     </div>
 *   )
 * }
 * ```
 */

import { useMemo, useSyncExternalStore, useEffect, useRef, useState } from 'react';
import { derive, deriveFrom } from '@bassline/core';
import type { Cleanup, Implements, SweetFunction } from '@bassline/core';
import { Valued } from '@bassline/core/protocols';

export function useDerive<
  Arg,
  Source extends Implements<Valued<Arg>> & SweetFunction<Arg, R>,
  R
>(
  source: Source,
  compute: (arg: Arg) => R
) {
  const [derivedFunc, cleanup] = useMemo(() => derive(source, compute), [source, compute])
  const result = useSyncExternalStore(
    (callback) => {
      const cleanup = derivedFunc.whenComputed(res => {
        callback()
      });
      return cleanup;
    },
    () => derivedFunc.current()
  );
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  return [result, derivedFunc] as const;
}

export function useDerived<
  Args extends Readonly<Record<string, unknown>>,
  Sources extends { [key in keyof Args]: Implements<Valued<Args[key]>> },
  R
>(
  sources: Sources,
  compute: (args: Args) => R
) {
  // Create the derived function and wiring once
  const [derivedFunc, cleanup] = useMemo(
    () => deriveFrom(sources, compute),
    [sources, compute]
  );

  // Subscribe to computed results
  const getSnapshot = () => {
    const state = derivedFunc.current();
    return state.result;
  };

  const result = useSyncExternalStore(
    (callback) => {
      const cleanup = derivedFunc.whenComputed((res) => {
        console.log('computed', res)
        callback()
      });
      return cleanup;
    },
    getSnapshot
  );

  // Cleanup wiring on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  return [result, derivedFunc] as const;
}
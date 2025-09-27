/**
 * React hook for using a map of gadgets with automatic state management.
 *
 * Takes a map of gadgets and returns a map with the same keys, where each
 * value contains { state, send, gadget } for that gadget.
 */

import type { Gadget, StateOf, InputOf, Tappable } from 'port-graphs';
import { useGadget } from './useGadget';

type GadgetMapResult<M> = {
  [K in keyof M]: M[K] extends Gadget<infer S> & Tappable<infer S>
  ? {
    state: StateOf<S>;
    send: (input: InputOf<S>) => void;
    gadget: M[K];
  }
  : never;
};

/**
 * React hook for using a map of typed gadgets.
 *
 * @example
 * const gadgets = {
 *   primary: maxCell(0),
 *   secondary: maxCell(0),
 *   controller: sliderGadget(0, 0, 100)
 * };
 *
 * const g = useGadgetMap(gadgets);
 * // g.primary.state - current state
 * // g.primary.send - send function
 * // g.primary.gadget - original gadget
 *
 * @param gadgetMap - An object containing gadgets
 * @returns An object with the same keys, each containing state, send, and gadget
 */
export function useGadgetMap<M extends Record<string, any>>(
  gadgetMap: M
): GadgetMapResult<M> {
  const result = {} as GadgetMapResult<M>;

  for (const key in gadgetMap) {
    const gadget = gadgetMap[key];
    const [state, send, gadgetRef] = useGadget(gadget);

    result[key] = {
      state,
      send,
      gadget: gadgetRef
    } as GadgetMapResult<M>[typeof key];
  }

  return result;
}
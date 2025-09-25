/**
 * Type-safe semantic extensions for typed gadgets
 *
 * Simple tap extension for observing effects
 */

import type { ExtractSpec, GadgetEffects, GadgetSpec, PartialSpec, TypedGadget } from '../core/types';

/**
 * Tappable interface for gadgets with tap method
 */
export type ExtractEffect<G> =
  G extends TypedGadget<infer S> ? S['effects']
  : G extends GadgetSpec<infer S, infer I, infer A, infer E> ? E
  : G extends GadgetEffects
  ? G
  : never;

export interface Tappable<T = unknown> {
  tap: (fn: (effect: ExtractEffect<T>) => void, keys?: (keyof ExtractEffect<T>)[]) => () => void;
}

export interface TappableGadget<Spec extends PartialSpec> extends TypedGadget<Spec> {
  tap: (fn: (effect: Spec['effects']) => void, keys?: (keyof Spec['effects'])[]) => () => void;
}

/**
 * Tappable extension - adds tap method while preserving types
 */
export function withTaps<G extends TypedGadget<any>>(
  gadget: G
) {
  type Spec = ExtractSpec<typeof gadget>;
  const taps = new Set<(effect: Spec['effects']) => void>();
  const originalEmit = gadget.emit;

  gadget.emit = (effect: Spec['effects']) => {
    originalEmit(effect);
    taps.forEach(tap => tap(effect));
  };

  return Object.assign(gadget, {
    tap: (fn: (effect: Spec['effects']) => void, keys: (keyof Spec['effects'])[] = []) => {
      let tapFn = fn;
      if (keys.length > 0) {
        tapFn = (effect) => {
          if (keys.every(key => effect[key] !== undefined)) {
            fn(effect);
          }
        };
      }
      taps.add(tapFn);
      return () => { taps.delete(tapFn); }
    }
  })
}
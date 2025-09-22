/**
 * Type-safe semantic extensions for typed gadgets
 *
 * Simple tap extension for observing effects
 */

import type { ExtractSpec, GadgetSpec, TypedGadget } from '../core/types';

/**
 * Tappable interface for gadgets with tap method
 */
export interface Tappable<Effect = unknown> {
  tap: (fn: (effect: Effect) => void) => () => void;
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
    tap: (fn: (effect: Spec['effects']) => void) => {
      taps.add(fn);
      return () => taps.delete(fn);
    }
  })
}
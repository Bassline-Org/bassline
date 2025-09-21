/**
 * Type-safe semantic extensions for typed gadgets
 *
 * Simple tap extension for observing effects
 */

import type { ExtractSpec, Gadgetish, GadgetSpec, TypedGadget } from '../core/types';

/**
 * Tappable extension - adds tap method while preserving types
 */
export function withTaps<G, Spec extends ExtractSpec<G>>(
  gadget: Gadgetish<G>
) {
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
  });
}
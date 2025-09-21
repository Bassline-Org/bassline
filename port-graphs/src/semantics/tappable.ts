/**
 * Tappable type for backwards compatibility
 */

import type { TypedGadget, GadgetSpec } from '../core/types';

/**
 * A gadget with a tap method for subscribing to effects
 */
export interface Tappable<Effect = unknown> {
  tap: (fn: (effect: Effect) => void) => () => void;
}

/**
 * Type guard to check if a gadget is tappable
 */
export function isTappable<Spec extends GadgetSpec>(
  gadget: TypedGadget<Spec>
): gadget is TypedGadget<Spec> & Tappable<Spec['effects']> {
  return 'tap' in gadget && typeof gadget.tap === 'function';
}
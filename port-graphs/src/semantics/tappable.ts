/**
 * Tappable type utilities
 */

import type { TypedGadget, GadgetSpec } from '../core/types';
import type { Tappable } from './typed-extensions';

/**
 * Type guard to check if a gadget is tappable
 */
export function isTappable<Spec extends GadgetSpec>(
  gadget: TypedGadget<Spec>
): gadget is TypedGadget<Spec> & Tappable<Spec['effects']> {
  return 'tap' in gadget && typeof gadget.tap === 'function';
}
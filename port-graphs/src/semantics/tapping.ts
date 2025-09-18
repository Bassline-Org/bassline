import { addGadgetExtensions, extensions, Gadget } from "../core";
import { maxCell } from "../patterns/cells";


/**
 * Tapping semantic - adds multi-tap capability to any gadget
 *
 * Allows multiple observers to tap into a gadget's effect stream
 * without modifying the core protocol.
 */

export interface Tappable extends Gadget {
  tap: (fn: (effect: Parameters<Gadget['emit']>[0]) => void) => () => void;
}

export function isTappable(gadget: Gadget): typeof gadget & Tappable | null {
  if ('tap' in gadget) {
    return gadget as typeof gadget & Tappable;
  } else {
    return null;
  }
}

export function withTaps<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
) {
  // If the gadget is already tappable, return it
  if (isTappable(gadget)) {
    return gadget as typeof gadget & Tappable;
  }

  const taps = new Set<(effect: Effect) => void>();
  const originalEmit = gadget.emit;

  gadget.emit = (effect: Effect) => {
    originalEmit(effect);
    taps.forEach(tap => tap(effect));
  };

  return Object.assign(gadget, {
    tap: (fn: (effect: Parameters<typeof gadget['emit']>[0]) => void) => {
      taps.add(fn);
      return () => taps.delete(fn);
    }
  }) as typeof gadget & Tappable;
}
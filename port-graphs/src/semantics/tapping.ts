import { Gadget } from "../core";

/**
 * Tapping semantic - adds multi-tap capability to any gadget
 *
 * Allows multiple observers to tap into a gadget's effect stream
 * without modifying the core protocol.
 */

export interface Tappable<State = any, Incoming = any, Effect = any> extends Gadget<State, Incoming, Effect> {
  tap: (fn: (effect: Effect) => void) => () => void;
}

export function isTappable<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
): gadget is Tappable<State, Incoming, Effect> {
  return 'tap' in gadget;
}

export function withTaps<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
): Tappable<State, Incoming, Effect> {
  // If the gadget is already tappable, return it
  if (isTappable(gadget)) {
    return gadget;
  }

  const taps = new Set<(effect: Effect) => void>();
  const originalEmit = gadget.emit;

  gadget.emit = (effect: Effect) => {
    originalEmit(effect);
    taps.forEach(tap => tap(effect));
  };

  return Object.assign(gadget, {
    tap: (fn: (effect: Effect) => void) => {
      taps.add(fn);
      return () => taps.delete(fn);
    }
  });
}
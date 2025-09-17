import { Gadget } from "../core";

/**
 * Tapping semantic - adds multi-tap capability to any gadget
 *
 * Allows multiple observers to tap into a gadget's effect stream
 * without modifying the core protocol.
 */

export interface Tappable {
  tap: (fn: (effect: any) => void) => () => void;
}

export function withTaps<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
): Gadget<State, Incoming, Effect> & Tappable {
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
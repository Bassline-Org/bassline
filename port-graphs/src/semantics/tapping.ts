import { Gadget } from "../core";
import { maxCell } from "../patterns/cells";

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

const fooCell = maxCell(0);
const barCell = withTaps(maxCell(0));

const cleanup = barCell.tap((effect) => {
  if (effect && 'changed' in effect) {
    fooCell.receive(effect.changed);
  }
});

barCell.receive(10);

console.log('fooCell current', fooCell.current());
console.log('barCell current', barCell.current());

cleanup();

barCell.receive(20);

console.log('fooCell current', fooCell.current());
console.log('barCell current', barCell.current());
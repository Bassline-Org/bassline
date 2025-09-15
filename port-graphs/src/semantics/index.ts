import { Gadget } from "../core";

/**
 * Extends a gadget's emit function to add additional behavior
 * Useful for adding logging, routing, or other side effects
 */
export function extendGadget<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
) {
  return function extend(emit: (effect: Effect) => void) {
    const oldEmit = gadget.emit;
    gadget.emit = (effect) => {
      emit(effect);
      oldEmit(effect);
    };
    return extend;
  };
}
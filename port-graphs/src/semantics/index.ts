import { Gadget } from "../old/core";

/**
 * Extends a gadget's emit function to add additional behavior
 * Useful for adding logging, routing, or other side effects
 */
interface GadgetExtension<State, Effect> {
  emit: (effect: Effect) => void;
  update: (state: State) => void;
  current: () => State;
}

export function replaceSemantics<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>,
  extensions: GadgetExtension<State, Effect>
) {
  const { emit, update, current } = extensions;
  gadget.emit = emit;
  gadget.update = update;
  gadget.current = current;
  return gadget;
}

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

export { withEvents } from './events';
export { withTaps, type Tappable, isTappable } from './tapping';
export { withTaps as withTypedTaps } from './typed-extensions';
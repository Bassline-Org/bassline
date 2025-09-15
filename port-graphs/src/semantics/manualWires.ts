import { Gadget } from "../core";

/**
 * Wire utilities for connecting gadgets mechanically
 */
export const wires = {
  /**
   * Creates a directed connection from one gadget to another
   * When from emits a 'changed' effect, to receives the value
   */
  directed: <FromState, ToIncoming>(
    from: Gadget<FromState, any, any>,
    to: Gadget<any, ToIncoming, any>
  ) => {
    const oldEmit = from.emit;
    from.emit = (effect: any) => {
      // Check if it's a changed effect and route the value
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        to.receive(effect.changed as ToIncoming);
      }
      oldEmit(effect);
    };
  },

  /**
   * Creates a bidirectional connection between two gadgets
   * Changed effects flow both ways
   */
  bi: <State1, State2>(
    gadget1: Gadget<State1, State2, any>,
    gadget2: Gadget<State2, State1, any>
  ) => {
    const emit1 = gadget1.emit;
    gadget1.emit = (effect: any) => {
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        gadget2.receive(effect.changed as State1);
      }
      emit1(effect);
    };

    const emit2 = gadget2.emit;
    gadget2.emit = (effect: any) => {
      if (effect && typeof effect === 'object' && 'changed' in effect) {
        gadget1.receive(effect.changed as State2);
      }
      emit2(effect);
    };
  },

  /**
   * Routes effects directly as data to another gadget
   * Meta-wire for effect-consuming gadgets
   */
  effectDirected: <FromEffect, ToIncoming>(
    from: Gadget<any, any, FromEffect>,
    to: Gadget<any, ToIncoming, any>
  ) => {
    const oldEmit = from.emit;
    from.emit = (effect) => {
      to.receive(effect as unknown as ToIncoming);
      oldEmit(effect);
    };
  }
};
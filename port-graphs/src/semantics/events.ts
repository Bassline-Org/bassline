import { Gadget } from "../core";
import { extendGadget } from "./index";

/**
 * Event-based semantics for gadgets
 *
 * Replaces the default emit/update/current with event-based versions,
 * allowing gadgets to dispatch and listen to events.
 */
export interface EventEmitting {
  emitter: EventTarget;
}

export function withEvents<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
): Gadget<State, Incoming, Effect> & EventEmitting {
  const emitter = new EventTarget();
  extendGadget(gadget)((event) => {
    emitter.dispatchEvent(new CustomEvent('effect', { detail: event }));
  });
  return {
    ...gadget,
    emitter,
  }
}
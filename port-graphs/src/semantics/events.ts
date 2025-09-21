import { Gadget } from "../old/core";
import { extendGadget } from "./index";

/**
 * Event-based semantics for gadgets
 *
 * Replaces the default emit/update/current with event-based versions,
 * allowing gadgets to dispatch and listen to events.
 */
export interface EventEmittingGadget extends Gadget {
  emitter: EventTarget;
}

export function isEventEmittingGadget(gadget: Gadget): gadget is EventEmittingGadget {
  return 'emitter' in gadget;
}

export function withEvents<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
): EventEmittingGadget {
  if (isEventEmittingGadget(gadget)) {
    return gadget;
  }
  const emitter = new EventTarget();
  extendGadget(gadget)((event) => {
    emitter.dispatchEvent(new CustomEvent('effect', { detail: event }));
  });
  return {
    ...gadget,
    emitter,
  }
}
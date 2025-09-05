/**
 * Minimal event-based gadget and action
 * 
 * Semantic: Event-driven propagation using browser/node EventTarget
 * Dependencies: EventTarget API (browser native or Node polyfill)
 */

import { Gadget } from "./core";
import { Action } from "./patterns";

/**
 * A gadget that's also an EventTarget
 * 
 * This is a commonly used pattern - just the minimal combination
 * of Gadget interface with EventTarget capabilities.
 */
export class EventfulGadget<T = unknown> extends EventTarget implements Gadget<T> {
  private protocol?: (this: EventfulGadget<T>, data: T) => void;
  
  constructor(public readonly id: string = '') {
    super();
  }
  
  receive(data: T): void {
    this.protocol?.call(this, data);
  }
  
  use(protocol: (this: EventfulGadget<T>, data: T) => void): this {
    this.protocol = protocol;
    return this;
  }
  
  emit(eventName: string, data: any): void {
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
}

/**
 * Simple event emit action
 * 
 * Assumes gadget has EventTarget methods (addEventListener, dispatchEvent)
 * This is just one way to do events - could also use EventEmitter, custom observers, etc.
 */
export const emitEvent = <T>(eventName: string = 'propagate'): Action<T, EventfulGadget<T>> =>
  (value, gadget) => {
    if ('dispatchEvent' in gadget) {
      gadget.dispatchEvent(new CustomEvent(eventName, { detail: value }));
    }
  };

/**
 * Wire two gadgets using events
 */
export function wireEvents(from: any, to: any, eventName: string = 'propagate'): void {
  if ('addEventListener' in from) {
    from.addEventListener(eventName, (e: Event) => {
      to.receive((e as CustomEvent).detail);
    });
  }
}
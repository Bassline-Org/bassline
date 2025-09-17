import { Gadget } from "../../core";
import { Tappable } from "../../semantics";

/**
 * Context composition utilities
 *
 * Helpers for combining and managing context gadgets
 */

/**
 * Pipeline - chain contexts together sequentially
 * Each context's output flows to the next context's input
 */
export function pipeline(...contexts: Gadget[]): Gadget {
  if (contexts.length === 0) {
    throw new Error('Pipeline requires at least one context');
  }

  // Wire each context to the next
  for (let i = 0; i < contexts.length - 1; i++) {
    const current = contexts[i]!;
    const next = contexts[i + 1]!;

    // Override emit to send to next context
    const originalEmit = current.emit;
    current.emit = (effect) => {
      originalEmit(effect);  // Still call original for any taps
      next.receive({ data: effect });
    };
  }

  // Return first context as entry point
  return contexts[0]!;
}

/**
 * Mount a context to a source gadget
 * Returns cleanup function
 */
export function mount(source: Gadget & Tappable, context: Gadget): () => void {
  context.receive({ mount: { source } });
  return () => context.receive({ unmount: { source } });
}

/**
 * Connect two gadgets directly
 * Source's effects flow to target's receive
 */
export function connect(source: Gadget & Tappable, target: Gadget): () => void {
  return source.tap((effect) => target.receive(effect));
}

/**
 * Fork - send effects to multiple contexts in parallel
 */
export function fork(...contexts: Gadget[]): Gadget {
  return {
    current: () => ({}),
    update: () => {},
    receive: (data) => {
      contexts.forEach(context => context.receive(data));
    },
    emit: (effect) => {
      // All contexts emit independently
      contexts.forEach(context => context.emit(effect));
    }
  };
}

/**
 * Merge - combine effects from multiple sources
 */
export function merge(...sources: (Gadget & Tappable)[]): Gadget & Tappable {
  const mergedGadget: Gadget & Tappable = {
    current: () => ({}),
    update: () => {},
    receive: () => {},
    emit: () => {},
    tap: (fn) => {
      const cleanups = sources.map(source => source.tap(fn));
      return () => cleanups.forEach(cleanup => cleanup());
    }
  };

  return mergedGadget;
}
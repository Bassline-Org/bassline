/**
 * Common gadget patterns with injectable actions
 * 
 * These factories create gadgets following the Apply/Consider/Act protocol
 * while allowing custom action semantics to be injected.
 */

import _ from "lodash";
import { protocol, Gadget } from "./core";

/**
 * Action function type - defines how a gadget acts on its decision
 * @param value The value to act upon
 * @param gadget The gadget performing the action
 */
export type Action<T, G extends Gadget = Gadget> = (value: T, gadget: G) => void;

/**
 * Creates a stateful gadget that accumulates values via a merge function
 * 
 * Semantic: Accumulation with change detection
 * Dependencies: None (pure TypeScript)
 * 
 * @param merge Function to merge old and new values (should be associative, commutative, idempotent)
 * @param initial Initial state value
 * @param act Action to perform when state changes
 * @returns Protocol function for a gadget
 * 
 * @example
 * // Event-emitting cell
 * const sumCell = cell(
 *   (old, incoming) => old + incoming, 
 *   0,
 *   (value, gadget) => gadget.emit('changed', value)
 * );
 */
export function cell<T, G extends Gadget<T> = Gadget<T>>(
  merge: (oldValue: T, incoming: T) => T,
  initial: T,
  act: Action<T, G>
): (this: G, data: T) => void {
  let state = initial;
  
  return protocol<G, T, T, T>(
    // APPLY: Merge incoming data with current state
    (data) => {
      const newState = merge(state, data);
      state = newState;
      return newState;
    },
    // CONSIDER: Has the state actually changed?
    (result) => {
      // Using !== for reference equality check
      // For deep equality, caller should ensure merge returns same reference
      return ! _.isEqual(result,initial) && result !== undefined ? result : null;
    },
    // ACT: Perform the injected action
    act
  );
}

/**
 * Creates a stateless transformation gadget
 * 
 * Semantic: Pure transformation with nullable results
 * Dependencies: None (pure TypeScript)
 * 
 * @param transform Function to transform input (returns null to signal no output)
 * @param act Action to perform when transformation produces a value
 * @returns Protocol function for a gadget
 * 
 * @example
 * // Double function that only processes positive numbers
 * const doubler = fn(
 *   (x: number) => x > 0 ? x * 2 : null,
 *   (value, gadget) => console.log('Doubled:', value)
 * );
 */
export function fn<TIn, TOut, G extends Gadget<TIn> = Gadget<TIn>>(
  transform: (input: TIn) => TOut | null,
  act: Action<TOut, G>
): (this: G, data: TIn) => void {
  return protocol<G, TIn, TOut, TOut>(
    // APPLY: Transform the input
    transform,
    // CONSIDER: Is there a result to propagate?
    (result) => result,
    // ACT: Perform the injected action
    act
  );
}

/**
 * Common action helpers that can be composed or used directly
 * Each returns an Action function matching the Action<T, G> type
 */
export const actions = {
  /**
   * No-op action - useful for testing or observation-only gadgets
   * 
   * Semantic: Explicitly do nothing
   * Dependencies: None
   */
  none: <T>(): Action<T> => 
    () => {},

  /**
   * Console logging action
   * 
   * Semantic: Side effect for debugging/observation
   * Dependencies: console (browser/node environment)
   */
  log: <T>(label?: string): Action<T> => 
    (value) => console.log(label || 'Gadget acted:', value),

  /**
   * Direct gadget-to-gadget connection
   * 
   * Semantic: Immediate propagation without events
   * Dependencies: Target gadget must exist
   */
  direct: <T>(target: Gadget<T>): Action<T> => 
    (value) => target.receive(value),

  /**
   * Compose multiple actions sequentially
   * 
   * Semantic: Perform multiple actions in order
   * Dependencies: All composed actions' dependencies
   */
  compose: <T, G extends Gadget = Gadget>(...acts: Action<T, G>[]): Action<T, G> =>
    (value, gadget) => acts.forEach(act => act(value, gadget)),

  /**
   * Conditional action based on predicate
   * 
   * Semantic: Conditional execution
   * Dependencies: Predicate function and wrapped action's dependencies
   */
  when: <T, G extends Gadget = Gadget>(
    predicate: (value: T) => boolean,
    act: Action<T, G>
  ): Action<T, G> =>
    (value, gadget) => predicate(value) ? act(value, gadget) : undefined,

  /**
   * Buffer values and act on batches
   * 
   * Semantic: Batching for efficiency
   * Dependencies: Timeout (browser/node environment)
   * 
   * Note: Creates stateful closure - each call creates new buffer
   */
  batch: <T, G extends Gadget = Gadget>(
    size: number,
    act: Action<T[], G>
  ): Action<T, G> => {
    let buffer: T[] = [];
    return (value, gadget) => {
      buffer.push(value);
      if (buffer.length >= size) {
        act(buffer, gadget);
        buffer = [];
      }
    };
  },

  /**
   * Transform value before acting
   * 
   * Semantic: Value transformation in action phase
   * Dependencies: None
   */
  map: <TIn, TOut, G extends Gadget = Gadget>(
    transform: (value: TIn) => TOut,
    act: Action<TOut, G>
  ): Action<TIn, G> =>
    (value, gadget) => act(transform(value), gadget),

  /**
   * Emit as tagged value for semantic routing
   * 
   * Semantic: Wrap value with semantic tag
   * Dependencies: Target gadget accepts TaggedValue
   */
  taggedEmit: <T, G extends Gadget = Gadget>(
    tag: string,
    target: Gadget<{ tag: string; value: T }>
  ): Action<T, G> =>
    (value) => target.receive({ tag, value })
};
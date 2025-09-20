/**
 * Gadget Family Pattern
 *
 * A family is just a gadget that stores other gadgets and lazily creates them.
 * This allows for dynamic gadget creation while keeping everything within
 * the universal protocol.
 */

import { createGadget, Gadget } from '../core';
import { changed, noop } from '../effects';

/**
 * Family gadget state - a map of key to gadget
 */
type FamilyState<K extends string | number, G> = {
  gadgets: Map<K, G>;
  factory: (key: K) => G;
};

/**
 * Family gadget incoming messages
 */
type FamilyIncoming<K> =
  | { get: K }
  | { delete: K }
  | { clear: true };

/**
 * Family gadget effects
 */
type FamilyEffect<K, G> =
  | { created: { key: K; gadget: G } }
  | { existing: { key: K; gadget: G } }
  | { deleted: K }
  | { cleared: true };

/**
 * Creates a family gadget that manages a collection of gadgets.
 * Gadgets are created lazily when first requested.
 *
 * @param factory - Function that creates a gadget for a given key
 * @returns A gadget that manages other gadgets
 *
 * @example
 * // Create a family of counter gadgets
 * const counterFamily = createFamily((id: string) => maxCell(0));
 *
 * // Request a gadget from the family
 * counterFamily.receive({ get: 'counter-1' });
 * // Effect: { created: { key: 'counter-1', gadget: <gadget> } }
 *
 * // Request same gadget again
 * counterFamily.receive({ get: 'counter-1' });
 * // Effect: { existing: { key: 'counter-1', gadget: <gadget> } }
 */
export function createFamily<K extends string | number, State, Incoming = any, Effect = any>(
  factory: (key: K) => Gadget<State, Incoming, Effect>
): Gadget<FamilyState<K, Gadget<State, Incoming, Effect>>, FamilyIncoming<K>, FamilyEffect<K, Gadget<State, Incoming, Effect>>> {
  return createGadget<
    FamilyState<K, Gadget<State, Incoming, Effect>>,
    FamilyIncoming<K>,
    FamilyEffect<K, Gadget<State, Incoming, Effect>>
  >(
    (current, incoming) => {
      if ('get' in incoming) {
        const existing = current.gadgets.get(incoming.get);
        if (existing) {
          return { action: 'return', context: { key: incoming.get, gadget: existing } };
        } else {
          return { action: 'create', context: { key: incoming.get } };
        }
      }

      if ('delete' in incoming) {
        if (current.gadgets.has(incoming.delete)) {
          return { action: 'delete', context: { key: incoming.delete } };
        }
        return null;
      }

      if ('clear' in incoming && incoming.clear) {
        if (current.gadgets.size > 0) {
          return { action: 'clear', context: {} };
        }
        return null;
      }

      return null;
    },
    {
      'create': (gadget, context) => {
        const key = context.key as K;
        const newGadget = gadget.current().factory(key);
        const newGadgets = new Map(gadget.current().gadgets);
        newGadgets.set(key, newGadget);
        gadget.update({ ...gadget.current(), gadgets: newGadgets });
        return { created: { key, gadget: newGadget } };
      },

      'return': (_gadget, context) => {
        return { existing: { key: context.key as K, gadget: context.gadget } };
      },

      'delete': (gadget, context) => {
        const key = context.key as K;
        const newGadgets = new Map(gadget.current().gadgets);
        newGadgets.delete(key);
        gadget.update({ ...gadget.current(), gadgets: newGadgets });
        return { deleted: key };
      },

      'clear': (gadget) => {
        gadget.update({ ...gadget.current(), gadgets: new Map() });
        return { cleared: true };
      }
    }
  )({ gadgets: new Map(), factory });
}

/**
 * Type helper for extracting the gadget type from a family
 */
export type FamilyGadgetType<F> = F extends Gadget<
  FamilyState<any, infer G>,
  any,
  any
> ? G : never;

/**
 * Type helper for extracting the key type from a family
 */
export type FamilyKeyType<F> = F extends Gadget<
  FamilyState<infer K, any>,
  any,
  any
> ? K : never;
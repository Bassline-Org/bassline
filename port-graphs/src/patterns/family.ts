/**
 * Typed Family Pattern for TypedGadget
 *
 * A family is a gadget that manages other gadgets, creating them lazily
 * when requested. This typed version works with TypedGadget and GadgetSpec.
 */

import { defGadget } from '../core/typed';
import type { TypedGadget, GadgetSpec } from '../core/types';
import { type CommandSpec } from './specs';

/**
 * Family gadget state - stores gadgets by key
 */
export type FamilyState<K extends string, Spec extends GadgetSpec> = {
  gadgets: Map<K, TypedGadget<Spec>>;
  factory: () => TypedGadget<Spec>;
};

/**
 * Family commands
 */
export type FamilyCommands<K extends string> =
  | { get: K }
  | { delete: K }
  | { clear: {} };

/**
 * Family spec
 */
export type FamilySpec<K extends string, Spec extends GadgetSpec> = CommandSpec<
  FamilyState<K, Spec>,
  FamilyCommands<K>,
  {
    get: K;
    delete: K;
    clear: {};
    ignore: {};
  },
  {
    created: { key: K; gadget: TypedGadget<Spec> };
    existing: { key: K; gadget: TypedGadget<Spec> };
    deleted: K;
    cleared: {};
    noop: {};
  }
>;

/**
 * Creates a typed family gadget that manages TypedGadgets
 */
export function createTypedFamily<K extends string, Spec extends GadgetSpec>(
  factory: () => TypedGadget<Spec>
): TypedGadget<FamilySpec<K, Spec>> {
  return defGadget<FamilySpec<K, Spec>>(
    (state, command) => {
      if ('get' in command) {
        const existing = state.gadgets.get(command.get);
        if (existing) {
          return { get: command.get };
        }
        return { get: command.get };
      }

      if ('delete' in command) {
        if (state.gadgets.has(command.delete)) {
          return { delete: command.delete };
        }
        return { ignore: {} };
      }

      if ('clear' in command) {
        if (state.gadgets.size > 0) {
          return { clear: {} };
        }
        return { ignore: {} };
      }

      return { ignore: {} };
    },
    {
      get: (gadget, key) => {
        const state = gadget.current();
        const existing = state.gadgets.get(key);

        if (existing) {
          return { existing: { key, gadget: existing } };
        }

        // Create new gadget
        const newGadget = state.factory();
        const newGadgets = new Map(state.gadgets);
        newGadgets.set(key, newGadget);
        gadget.update({ ...state, gadgets: newGadgets });

        return { created: { key, gadget: newGadget } };
      },

      delete: (gadget, key) => {
        const state = gadget.current();
        const newGadgets = new Map(state.gadgets);
        newGadgets.delete(key);
        gadget.update({ ...state, gadgets: newGadgets });
        return { deleted: key };
      },

      clear: (gadget) => {
        const state = gadget.current();
        gadget.update({ ...state, gadgets: new Map() });
        return { cleared: {} };
      },

      ignore: () => ({ noop: {} })
    }
  )({ gadgets: new Map(), factory });
}
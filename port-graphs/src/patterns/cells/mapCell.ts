/**
 * Map cell for storing key-value pairs using JavaScript Map
 *
 * Useful for storing dynamic collections of gadgets or other values
 * where you need fast lookup by key.
 */

import { createGadget } from "../../core";
import { changed, noop } from "../../effects";

type MapUpdate<K, V> = {
  set?: Array<[K, V]>;
  delete?: K[];
  clear?: boolean;
};

/**
 * Creates a cell that manages a Map
 */
export const mapCell = <K = any, V = any>() =>
  createGadget<Map<K, V>, MapUpdate<K, V>>(
    (_current, update) => {
      if (!update) return null;

      if (update.clear) {
        return { action: 'clear' };
      }
      if (update.set && update.set.length > 0) {
        return { action: 'set', context: { entries: update.set } };
      }
      if (update.delete && update.delete.length > 0) {
        return { action: 'delete', context: { keys: update.delete } };
      }
      return null;
    },
    {
      'clear': (gadget) => {
        const newMap = new Map<K, V>();
        gadget.update(newMap);
        return changed(newMap);
      },
      'set': (gadget, { entries }) => {
        const newMap = new Map(gadget.current());
        for (const [key, value] of entries) {
          newMap.set(key, value);
        }
        gadget.update(newMap);
        return changed(newMap);
      },
      'delete': (gadget, { keys }) => {
        const newMap = new Map(gadget.current());
        for (const key of keys) {
          newMap.delete(key);
        }
        gadget.update(newMap);
        return changed(newMap);
      }
    }
  );
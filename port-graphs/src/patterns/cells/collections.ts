import { createGadget } from "../../core";
import { changed, noop } from "../../effects";
import _ from "lodash";

/**
 * Collection cell patterns for managing lists, sets, and indexed data
 */

type ItemWithId = { id: string; [key: string]: any };

type CollectionChange<T extends ItemWithId> =
  | { type: 'add'; item: T }
  | { type: 'replace'; id: string; item: T }
  | { type: 'remove'; id: string }
  | { type: 'clear' }
  | { type: 'batch'; changes: CollectionChange<T>[] };

/**
 * Aggregator cell that manages a collection of items by id
 * Supports add, replace, remove operations
 */
export const aggregatorCell = <T extends ItemWithId>() =>
  createGadget<T[], CollectionChange<T> | CollectionChange<T>[]>(
    (current, incoming) => {
      const changes = Array.isArray(incoming) ? incoming : [incoming];
      return { action: 'update', context: { current, changes } };
    },
    {
      'update': (gadget, { current, changes }) => {
        let updated = [...current];

        for (const change of changes) {
          switch (change.type) {
            case 'add':
              if (!updated.find(x => x.id === change.item.id)) {
                updated.push(change.item);
              }
              break;
            case 'replace':
              const index = updated.findIndex(x => x.id === change.id);
              if (index >= 0) {
                updated[index] = change.item;
              } else {
                updated.push(change.item);
              }
              break;
            case 'remove':
              updated = updated.filter(x => x.id !== change.id);
              break;
            case 'clear':
              updated = [];
              break;
            case 'batch':
              // Recursive handling of batch changes
              for (const batchChange of change.changes) {
                gadget.receive(batchChange);
              }
              return noop();
          }
        }

        if (!_.isEqual(current, updated)) {
          gadget.update(updated);
          return changed(updated);
        }
        return noop();
      }
    }
  );

/**
 * List cell for ordered collections with positional operations
 */
export const listCell = <T>() =>
  createGadget<T[], { op: 'append' | 'prepend' | 'insert' | 'remove' | 'clear'; value?: T; index?: number }>(
    (current, incoming) => {
      return { action: incoming.op, context: { current, value: incoming.value, index: incoming.index } };
    },
    {
      'append': (gadget, { current, value }) => {
        if (value === undefined) return noop();
        const updated = [...current, value];
        gadget.update(updated);
        return changed(updated);
      },
      'prepend': (gadget, { current, value }) => {
        if (value === undefined) return noop();
        const updated = [value, ...current];
        gadget.update(updated);
        return changed(updated);
      },
      'insert': (gadget, { current, value, index }) => {
        if (value === undefined || index === undefined) return noop();
        const updated = [...current];
        updated.splice(index, 0, value);
        gadget.update(updated);
        return changed(updated);
      },
      'remove': (gadget, { current, index }) => {
        if (index === undefined || index < 0 || index >= current.length) return noop();
        const updated = current.filter((_: T, i: number) => i !== index);
        gadget.update(updated);
        return changed(updated);
      },
      'clear': (gadget) => {
        gadget.update([]);
        return changed([]);
      }
    }
  );

/**
 * Index cell for key-value storage with merge strategies
 */
export const indexCell = <V>() =>
  createGadget<Record<string, V>, Record<string, V | undefined>>(
    (current, incoming) => {
      const hasChanges = Object.entries(incoming).some(([key, value]) =>
        value === undefined ? key in current : current[key] !== value
      );

      if (!hasChanges) return null;
      return { action: 'merge', context: { current, incoming } };
    },
    {
      'merge': (gadget, { current, incoming }) => {
        const updated = { ...current };

        for (const [key, value] of Object.entries(incoming)) {
          if (value === undefined) {
            delete updated[key];
          } else {
            updated[key] = value;
          }
        }

        gadget.update(updated);
        return changed(updated);
      }
    }
  );

/**
 * Set cell for unique value collections
 */
export const setCell = <T>() =>
  createGadget<Set<T>, { op: 'add' | 'remove' | 'clear' | 'union'; values: T | T[] | Set<T> }>(
    (current, incoming) => {
      return { action: incoming.op, context: { current, values: incoming.values } };
    },
    {
      'add': (gadget, { current, values }) => {
        const updated = new Set<T>(current);
        const items: T[] = Array.isArray(values) ? values : values instanceof Set ? Array.from(values) : [values as T];
        let hasChanges = false;

        for (const item of items) {
          if (!updated.has(item)) {
            updated.add(item);
            hasChanges = true;
          }
        }

        if (hasChanges) {
          gadget.update(updated);
          return changed(updated as NonNullable<Set<T>>);
        }
        return noop();
      },
      'remove': (gadget, { current, values }) => {
        const updated = new Set<T>(current);
        const items: T[] = Array.isArray(values) ? values : values instanceof Set ? Array.from(values) : [values as T];
        let hasChanges = false;

        for (const item of items) {
          if (updated.delete(item)) {
            hasChanges = true;
          }
        }

        if (hasChanges) {
          gadget.update(updated);
          return changed(updated as NonNullable<Set<T>>);
        }
        return noop();
      },
      'clear': (gadget) => {
        const empty = new Set<T>();
        gadget.update(empty);
        return changed(empty);
      },
      'union': (gadget, { current, values }) => {
        const other = values instanceof Set ? values : new Set(Array.isArray(values) ? values : [values]);
        const updated = new Set<T>([...Array.from(current), ...Array.from(other)]);

        if (updated.size !== current.size) {
          gadget.update(updated);
          return changed(updated as NonNullable<Set<T>>);
        }
        return noop();
      }
    }
  );
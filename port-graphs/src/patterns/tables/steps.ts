import _ from 'lodash';

// ================================================
// Table Utilities
// ================================================

type TableChanges<K extends PropertyKey, V> = {
  added: Record<K, V>;
  removed: Record<K, V>;
  hasChanges: boolean;
};

const getTableChanges = <K extends PropertyKey, V>(
  state: Record<K, V>,
  input: Partial<Record<K, V | null>>
): TableChanges<K, V> => {
  const added = {} as Record<K, V>;
  const removed = {} as Record<K, V>;
  for (const key in input) {
    const value = input[key];
    if (value === null) {
      if (state[key] !== undefined) removed[key] = state[key];
    } else if (state[key] !== value) {
      added[key] = value as V;
    }
  }
  return {
    added,
    removed,
    hasChanges: Object.keys(added).length > 0 || Object.keys(removed).length > 0
  };
};

// ================================================
// Table Steps
// ================================================

// Last-write-wins table
export const lastTableStep = <K extends PropertyKey, V>() =>
  (state: Record<K, V>, input: Partial<Record<K, V | null>>) => {
    const { added, removed, hasChanges } = getTableChanges(state, input);
    if (!hasChanges) return { ignore: {} } as const;

    const next = { ...state };
    for (const key in removed) delete next[key];
    for (const key in added) next[key] = added[key];

    return { merge: next, added, removed, changed: next } as const;
  };

// First-write-wins table
export const firstTableStep = <K extends PropertyKey, V>() =>
  (state: Record<K, V>, input: Partial<Record<K, V | null>>) => {
    const { added, removed, hasChanges } = getTableChanges(state, input);
    if (!hasChanges) return { ignore: {} } as const;

    const next = { ...state };
    const actualAdded = {} as Record<K, V>;

    for (const key in removed) delete next[key];
    for (const key in added) {
      if (next[key] === undefined) {
        next[key] = added[key];
        actualAdded[key] = added[key];
      }
    }

    return { merge: next, added: actualAdded, removed, changed: next } as const;
  };

// Union table (monotonic set union per key)
export const unionTableStep = <K extends PropertyKey, V>() =>
  (state: Record<K, Set<V>>, input: Partial<Record<K, Set<V> | null>>) => {
    const added = {} as Record<K, Set<V>>;
    const removed = {} as Record<K, Set<V>>;

    for (const key in input) {
      const value = input[key];
      if (value === null) {
        if (state[key] !== undefined) removed[key] = state[key];
      } else if (value !== undefined) {
        const stateValue = state[key] ?? new Set<V>();
        const union = stateValue.union(value);
        if (union.size !== stateValue.size) {
          added[key] = value;
        }
      }
    }

    const hasChanges = Object.keys(added).length > 0 || Object.keys(removed).length > 0;
    if (!hasChanges) return { ignore: {} } as const;

    const next = { ...state };
    for (const key in removed) {
      next[key] = next[key].difference(removed[key]);
    }
    for (const key in added) {
      next[key] = (next[key] ?? new Set<V>()).union(added[key]);
    }

    return { merge: next, added, removed, changed: next } as const;
  };

// Family table step (manages collection of gadgets)
export type FamilyCommand<K extends PropertyKey, InputType> =
  | ['send', Record<K, InputType>]
  | ['create', K[]]
  | ['delete', K[]]
  | ['clear', true];

export const familyTableStep = <K extends PropertyKey, G>(factory: () => G) =>
  (state: Record<K, G>, input: FamilyCommand<K, unknown>) => {
    const [action, context] = input;

    switch (action) {
      case 'send': {
        const sends = context as Record<K, unknown>;
        return { send: sends } as const;
      }
      case 'create': {
        const keys = context as K[];
        const added = {} as Record<K, G>;
        for (const key of keys) {
          if (state[key] === undefined) {
            added[key] = factory();
          }
        }
        if (Object.keys(added).length === 0) return { ignore: {} } as const;
        return { merge: { ...state, ...added }, added } as const;
      }
      case 'delete': {
        const keys = context as K[];
        const removed = {} as Record<K, G>;
        for (const key of keys) {
          if (state[key] !== undefined) {
            removed[key] = state[key];
          }
        }
        if (Object.keys(removed).length === 0) return { ignore: {} } as const;
        const next = { ...state };
        for (const key in removed) delete next[key];
        return { merge: next, removed } as const;
      }
      case 'clear': {
        if (Object.keys(state).length === 0) return { ignore: {} } as const;
        return { merge: {} as Record<K, G>, removed: state } as const;
      }
      default:
        return { ignore: {} } as const;
    }
  };
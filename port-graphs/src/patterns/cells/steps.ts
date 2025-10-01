export type Actions<T> = {
  merge?: T,
  ignore?: {},
  contradiction?: { current: T, incoming: T }
}

const merge = <T>(toMerge: T) => ({ merge: toMerge } as const);
const ignore = () => ({ ignore: {} } as const);
const contradiction = <T>(current: T, incoming: T) => ({ contradiction: { current, incoming } } as const);

// @goose: A semilattice ordered by the >= relation
export const maxStep = (a: number, b: number) =>
  b >= a ? merge(b) : ignore();

// @goose: Monotonically decreasing numbers
export const minStep = (a: number, b: number) =>
  b <= a ? merge(b) : ignore();

// ================================================
// Generic Cell Steps
// ================================================

// @goose: Always take new value
export const lastStep = <T>() => (a: T, b: T) => merge(b);

// @goose: Never change after first value
export const firstStep = <T>() => (a: T, b: T) => ignore();

// @goose: Ordinal versioning (for [version, value] tuples)
export const ordinalStep = <T>() => (a: [number, T], b: [number, T]) =>
  b[0] > a[0] ? merge(b) : ignore();

// ================================================
// Set Cell Steps
// ================================================

// @goose: A semilattice ordered by isSubsetOf relation
export const unionStep = <T>() => (a: Set<T>, b: Set<T>) => b.isSubsetOf(a) ? ignore() : merge(a.union(b));

// @goose: A semilattice ordered by intersection
export const intersectionStep = <T>() => (a: Set<T>, b: Set<T>) => {
  const intersection = a.intersection(b);
  if (intersection.size === 0) {
    return contradiction(a, b);
  }
  if (intersection.size === a.size) {
    return ignore();
  }
  return merge(intersection);
};

// ================================================
// Registry Cell Step
// ================================================

// @goose: Actions specific to registry operations
export type RegistryActions<T> =
  | { registered: { id: string; state: Map<string, T> } }
  | { unregistered: { id: string; state: Map<string, T> } }
  | { ignore: {} };

// @goose: Registry table that stores key-value pairs
// Implements the Registry<T> protocol
export const registryStep = <T>() => (
  state: Map<string, T>,
  input: { register: { id: string; value: T } } | { unregister: string }
): RegistryActions<T> => {
  if ('register' in input) {
    const { id, value } = input.register;
    const newMap = new Map(state);
    newMap.set(id, value);
    return { registered: { id, state: newMap } };
  }

  if ('unregister' in input) {
    const id = input.unregister;
    if (!state.has(id)) {
      return { ignore: {} }; // Can't unregister what doesn't exist
    }
    const newMap = new Map(state);
    newMap.delete(id);
    return { unregistered: { id, state: newMap } };
  }

  return { ignore: {} };
};
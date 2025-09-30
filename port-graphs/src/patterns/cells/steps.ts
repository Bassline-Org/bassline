import { cellStep, type CellEffects } from '../../core/context';

// ================================================
// Numeric Cell Steps
// ================================================

// @goose: A semilattice ordered by the >= relation
export const maxStep = (a: number, b: number) =>
  b >= a ? { merge: b } as const : { ignore: {} } as const;

// @goose: Monotonically decreasing numbers
export const minStep = (a: number, b: number) =>
  b <= a ? { merge: b } as const : { ignore: {} } as const;

// ================================================
// Generic Cell Steps
// ================================================

// @goose: Always take new value
export const lastStep = <T>() => (a: T, b: T) =>
  ({ merge: b } as const);

// @goose: Never change after first value
export const firstStep = <T>() => (a: T, b: T) =>
  ({ ignore: {} } as const);

// @goose: Ordinal versioning (for [version, value] tuples)
export const ordinalStep = <T>() => (a: [number, T], b: [number, T]) =>
  b[0] > a[0] ? { merge: b } as const : { ignore: {} } as const;

// ================================================
// Set Cell Steps
// ================================================

// @goose: A semilattice ordered by isSubsetOf relation
export const unionStep = <T>() => (a: Set<T>, b: Set<T>) => b.isSubsetOf(a) ? { ignore: {} } as const : { merge: a.union(b) } as const;

// @goose: A semilattice ordered by intersection
export const intersectionStep = <T>() => (a: Set<T>, b: Set<T>) => {
  const intersection = a.intersection(b);
  if (intersection.size === 0) {
    return { contradiction: { current: a, incoming: b } } as const;
  }
  if (intersection.size === a.size) {
    return { ignore: {} } as const;
  }
  return { merge: intersection } as const;
};

// ================================================
// Counter Step (Custom Logic)
// ================================================

export type CounterInput = {
  increment?: number;
  decrement?: number;
  reset?: boolean
};

export type CounterEffects = {
  merge?: number;
  changed?: number;
  overflow?: number;
  underflow?: number;
  ignore?: {}
};

export const counterStep = (initial: number, min: number, max: number) =>
  (state: number, input: CounterInput): CounterEffects => {
    if (input.reset) {
      return { merge: initial, changed: initial };
    }
    if (input.increment !== undefined) {
      const next = state + input.increment;
      if (next > max) {
        return { merge: max, changed: max, overflow: max };
      }
      return { merge: next, changed: next };
    }
    if (input.decrement !== undefined) {
      const next = state - input.decrement;
      if (next < min) {
        return { merge: min, changed: min, underflow: min };
      }
      return { merge: next, changed: next };
    }
    return { ignore: {} };
  };
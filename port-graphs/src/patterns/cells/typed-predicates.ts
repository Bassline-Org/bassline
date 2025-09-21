/**
 * Predicate cells using the typed pattern approach
 *
 * Predicates form a lattice where only values passing the predicate are accepted.
 * This is ACI because the merge operation is "keep if valid" which is idempotent.
 */

import { defGadget } from '../../core/typed';
import type { CellSpec } from '../specs';

/**
 * Predicate cell - only accepts values that pass the predicate test
 * Forms a lattice where merge is "first valid value wins" (monotonic)
 * Once it has a value, it never changes
 */
export type PredicateCell<T> = CellSpec<boolean, T, boolean>;

export const predicateCell = <T>(
  predicate: (value: T) => boolean,
) => () => {
  return defGadget<PredicateCell<T>>(
    (state, input) => {
      if (state) {
        return { ignore: {} };
      }

      // Only accept input if it passes the predicate
      if (predicate(input)) {
        return { merge: true };
      }

      return { ignore: {} };
    },
    {
      merge: (gadget, value) => {
        gadget.update(value);
        return { changed: value };
      },
      ignore: () => ({ noop: {} })
    }
  )(false);
};

// Common type predicates as convenience functions
export const isNumber = (x: unknown): x is number => typeof x === 'number' && !isNaN(x);
export const isString = (x: unknown): x is string => typeof x === 'string';
export const isBoolean = (x: unknown): x is boolean => typeof x === 'boolean';
export const isArray = (x: unknown): x is unknown[] => Array.isArray(x);
export const isObject = (x: unknown): x is object => typeof x === 'object' && x !== null && !Array.isArray(x);
export const isFunction = (x: unknown): x is Function => typeof x === 'function';
export const isNull = (x: unknown): x is null => x === null;
export const isUndefined = (x: unknown): x is undefined => x === undefined;
export const isSymbol = (x: unknown): x is symbol => typeof x === 'symbol';

// Predicate cell factories using the type guards
export const numberCell = (initial?: number) => predicateCell(isNumber);
export const stringCell = (initial?: string) => predicateCell(isString);
export const booleanCell = (initial?: boolean) => predicateCell(isBoolean);
export const arrayCell = <T>(initial?: T[]) => predicateCell(isArray);
export const objectCell = (initial?: object) => predicateCell(isObject);
export const functionCell = (initial?: Function) => predicateCell(isFunction);
export const nullCell = () => predicateCell(isNull);
export const symbolCell = (initial?: symbol) => predicateCell(isSymbol);

// Range predicates for numbers
export const rangeCell = (min: number, max: number) =>
  predicateCell((x: number) => x >= min && x <= max);

export const positiveCell = () =>
  predicateCell((x: number) => x > 0);

export const negativeCell = () =>
  predicateCell((x: number) => x < 0);

// String predicates
export const nonEmptyStringCell = () =>
  predicateCell((x: string) => x.length > 0);

export const patternCell = (pattern: RegExp) =>
  predicateCell((x: string) => pattern.test(x));
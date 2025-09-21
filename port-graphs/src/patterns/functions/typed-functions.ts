/**
 * Function gadget implementations using the typed pattern approach
 */

import * as _ from 'lodash';
import { defGadget } from '../../core/typed';
import type { FunctionSpec } from '../specs';

/**
 * Creates a typed function gadget that computes when all required arguments are present
 */
export function typedFn<
  Args extends Record<string, unknown>,
  Result
>(
  compute: (args: Args) => Result,
  requiredKeys: (keyof Args)[]
) {
  type Spec = FunctionSpec<Args, Result>;

  return (initialArgs?: Partial<Args>) => {
    return defGadget<Spec>(
      (state, input) => {
        // If input is empty, ignore
        if (_.isEmpty(input)) {
          return { ignore: {} };
        }

        // Merge incoming with current args (excluding result)
        const currentArgs = _.omit(state, 'result') as Args;
        const merged = { ...currentArgs, ...input } as Args;

        // Check if we have all required keys
        const hasAll = requiredKeys.every(key => merged[key] !== undefined);

        if (!hasAll) {
          // Still accumulating
          return { accumulate: input };
        }

        // Check if args actually changed
        const argsChanged = !_.isEqual(
          _.pick(merged, requiredKeys),
          _.pick(currentArgs, requiredKeys)
        );

        if (!argsChanged && state.result !== undefined) {
          return { ignore: {} };
        }

        // Ready to compute
        return { compute: merged };
      },
      {
        compute: (gadget, args) => {
          const result = compute(args);
          gadget.update({ ...args, result } as Args & { result?: Result });
          return { changed: { result, args } };
        },
        accumulate: (gadget, partial) => {
          const current = gadget.current();
          gadget.update({ ...current, ...partial });
          return { noop: {} };
        },
        ignore: () => ({ noop: {} })
      }
    )(initialArgs as Args & { result?: Result });
  };
}

/**
 * Binary function helper
 */
export function binary<A, B, R>(
  fn: (a: A, b: B) => R
) {
  return typedFn<{ a: A; b: B }, R>(
    args => fn(args.a, args.b),
    ['a', 'b']
  );
}

/**
 * Unary function helper
 */
export function unary<A, R>(
  fn: (a: A) => R
) {
  return typedFn<{ value: A }, R>(
    args => fn(args.value),
    ['value']
  );
}

/**
 * Common math functions
 */
export const adder = binary<number, number, number>((a, b) => a + b);
export const multiplier = binary<number, number, number>((a, b) => a * b);
export const divider = binary<number, number, number>((a, b) => a / b);
export const subtractor = binary<number, number, number>((a, b) => a - b);

export const square = unary<number, number>(x => x * x);
export const sqrt = unary<number, number>(x => Math.sqrt(x));
export const negate = unary<number, number>(x => -x);

/**
 * String functions
 */
export const concat = binary<string, string, string>((a, b) => a + b);
export const uppercase = unary<string, string>(s => s.toUpperCase());
export const lowercase = unary<string, string>(s => s.toLowerCase());

/**
 * Boolean functions
 */
export const and = binary<boolean, boolean, boolean>((a, b) => a && b);
export const or = binary<boolean, boolean, boolean>((a, b) => a || b);
export const not = unary<boolean, boolean>(x => !x);

/**
 * Comparison functions
 */
export const equals = binary<any, any, boolean>((a, b) => a === b);
export const lessThan = binary<number, number, boolean>((a, b) => a < b);
export const greaterThan = binary<number, number, boolean>((a, b) => a > b);

/**
 * Array functions
 */
export const arrayLength = unary<any[], number>(arr => arr.length);
export const arrayFirst = unary<any[], any>(arr => arr[0]);
export const arrayLast = unary<any[], any>(arr => arr[arr.length - 1]);

/**
 * Ternary function example
 */
export const conditional = typedFn<
  { condition: boolean; ifTrue: any; ifFalse: any },
  any
>(
  args => args.condition ? args.ifTrue : args.ifFalse,
  ['condition', 'ifTrue', 'ifFalse']
);


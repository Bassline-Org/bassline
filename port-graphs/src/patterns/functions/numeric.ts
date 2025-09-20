import _ from "lodash";
import { createGadget } from "../../core";
import { changed, noop } from "../../effects";

/**
 * Creates a function gadget that computes when all arguments are present
 * Uses map-based arguments for natural partial binding
 */
export function createFn<TArgs extends Record<string, any>, TResult>(
  compute: (args: TArgs) => TResult,
  requiredKeys: (keyof TArgs)[]
) {
  type State = TArgs & { result?: TResult };

  return (initial: Partial<TArgs>) => {
    return createGadget<State, Partial<TArgs>>(
      (current, incoming) => {
        // If incoming is empty, just return noop
        if (_.isEmpty(_.omitBy(incoming, _.isNil))) {
          return { action: 'noop' };
        }

        // Merge incoming arguments with current
        const merged = { ..._.pick(current, requiredKeys), ..._.omitBy(incoming, _.isNil) } as TArgs;

        // Check if we have all required keys
        const hasAllKeys = requiredKeys.every(key => merged[key] !== undefined);

        if (!hasAllKeys) {
          // Just accumulate arguments, don't compute yet
          return { action: 'accumulate', context: { merged } };
        }

        // Check if arguments actually changed
        const argsChanged = !requiredKeys.every(key => merged[key] === current[key]);
        if (!argsChanged) {
          return null; // No change, don't compute
        }

        return { action: 'compute', context: { merged } };
      },
      {
        'noop': () => noop(),
        'accumulate': (gadget, { merged }) => {
          gadget.update(merged as State);
          return noop();
        },
        'compute': (gadget, { merged }) => {
          const result = compute(merged);
          const currentResult = gadget.current().result;
          const newState = { ...merged, result } as State;
          gadget.update(newState);

          if (_.isEqual(result, currentResult)) {
            return noop();
          } else {
            return changed({ result, args: merged });
          }
        }
      }
    )({ ...initial, result: undefined } as State);
  };
}

/**
 * Creates a unary function gadget (single input)
 */
export function unary<A, R>(fn: (a: A) => R) {
  type Args = { value: A };

  return createFn<Args, R>(
    (args) => fn(args.value),
    ['value']
  );
}

/**
 * Creates a binary function gadget
 */
export function binary<A, B, R>(fn: (a: A, b: B) => R) {
  type Args = { a: A; b: B };

  return createFn<Args, R>(
    (args) => fn(args.a, args.b),
    ['a', 'b']
  );
}

/**
 * Creates a ternary function gadget (three inputs)
 */
export function ternary<A, B, C, R>(fn: (a: A, b: B, c: C) => R) {
  type Args = { a: A; b: B; c: C };

  return createFn<Args, R>(
    (args) => fn(args.a, args.b, args.c),
    ['a', 'b', 'c']
  );
}

/**
 * Creates a selector gadget - transforms a single source
 * This is just a unary function with clearer semantics
 */
export function selector<T, R>(select: (source: T) => R) {
  return unary(select);
}

/**
 * Creates a derived gadget that combines multiple sources
 * This is a more semantic name for multi-input functions
 */
export function derived<Args extends Record<string, any>, R>(
  compute: (args: Args) => R,
  requiredKeys: (keyof Args)[]
) {
  return createFn(compute, requiredKeys);
}

// Standard arithmetic functions
export const adder = binary<number, number, number>((a, b) => a + b);
export const subtractor = binary<number, number, number>((a, b) => a - b);
export const multiplier = binary<number, number, number>((a, b) => a * b);
export const divider = binary<number, number, number>((a, b) => a / b);
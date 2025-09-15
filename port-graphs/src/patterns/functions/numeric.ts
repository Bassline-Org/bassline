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
        // Merge incoming arguments with current
        const merged = { ...current, ..._.omitBy(incoming, _.isNil) } as TArgs;

        // Check if we have all required keys
        const hasAllKeys = requiredKeys.every(key => merged[key] !== undefined);

        if (!hasAllKeys) {
          // Just accumulate arguments, don't compute yet
          return { action: 'accumulate', context: { merged } };
        }

        // We have all keys, compute the result
        const result = compute(merged);

        // Check if result changed
        if (_.isEqual(result, current.result)) {
          return null; // No change
        }

        return { action: 'compute', context: { merged, result } };
      },
      {
        'accumulate': (gadget, { merged }) => {
          gadget.update(merged as State);
          return noop();
        },
        'compute': (gadget, { merged, result }) => {
          const newState = { ...merged, result } as State;
          gadget.update(newState);
          return changed({ result, args: merged });
        }
      }
    )({ ...initial, result: undefined } as State);
  };
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

// Standard arithmetic functions
export const adder = binary<number, number, number>((a, b) => a + b);
export const subtractor = binary<number, number, number>((a, b) => a - b);
export const multiplier = binary<number, number, number>((a, b) => a * b);
export const divider = binary<number, number, number>((a, b) => a / b);
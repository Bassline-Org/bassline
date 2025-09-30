import _ from 'lodash';

// ================================================
// Function Gadget Types
// ================================================

type FnArgs<T> = T extends (args: infer Args) => unknown
  ? Args extends Record<string, unknown> ? Args : never
  : never;

type FnResult<T> = T extends (args: unknown) => infer Result ? Result : never;

export type FnRecord<Fn> = FnArgs<Fn> & { result: FnResult<Fn> };

// ================================================
// Function Step
// ================================================

export const fnStep = <Compute extends (args: unknown) => unknown>(
  compute: Compute,
  requiredKeys: (keyof FnArgs<Compute>)[]
) => (state: FnRecord<Compute>, input: Partial<FnArgs<Compute>>) => {
  if (_.isEmpty(input)) return { ignore: {} } as const;

  const merged = { ...state, ...input };
  if (_.isEqual(merged, state)) return { ignore: {} } as const;

  const hasAll = requiredKeys.length === 0 ||
    requiredKeys.every(k => merged[k] !== undefined);

  if (!hasAll) {
    // Accumulate partial args
    return { merge: merged, noop: {} } as const;
  }

  // Compute result
  const args = requiredKeys.length > 0
    ? _.pick(merged, requiredKeys)
    : _.omit(merged, 'result');

  const result = compute(args as FnArgs<Compute>);
  const newState = { ...args, result } as FnRecord<Compute>;

  return { merge: newState, changed: newState, computed: result } as const;
};
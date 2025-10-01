// ================================================
// Function Step Actions
// ================================================

/**
 * Actions for function gadgets.
 * - compute: Ready to execute function with given input
 * - accumulate: Store partial arguments (for PartialFunction)
 */
export type FunctionActions<Input> = {
  compute?: Input;
  accumulate?: Input;
};

// ================================================
// Step Helpers
// ================================================

const compute = <T>(input: T) => ({ compute: input } as const);
const accumulate = <T>(input: T) => ({ accumulate: input } as const);

// ================================================
// Transform Steps
// ================================================

/**
 * Step for simple transformations - always ready to compute.
 *
 * State: Out | undefined (cached result)
 * Input: In (the value to transform)
 * Actions: { compute: In }
 *
 * @example
 * ```typescript
 * const step = transformStep<number>();
 * const proto = protoGadget(step).handler(transformHandler(x => x * 2));
 * ```
 */
export const transformStep = <In, Out>(_state: Out, input: In) => compute(input);

// ================================================
// Partial Application Steps
// ================================================

/**
 * Step for partial function application.
 * Accumulates arguments until all required keys are present, then computes.
 *
 * State: Partial<Args> (accumulated arguments)
 * Input: Partial<Args> (new arguments to merge)
 * Actions: { compute: Args } | { accumulate: Partial<Args> }
 *
 * @example
 * ```typescript
 * type Args = { x: number; y: number };
 * const step = partialStep<Args>(['x', 'y']);
 *
 * step({}, { x: 5 });        // → { accumulate: { x: 5 } }
 * step({ x: 5 }, { y: 3 });  // → { compute: { x: 5, y: 3 } }
 * ```
 */
export const partialStep = <Args extends Record<string, any>>(
  requiredKeys: (keyof Args)[]
) => (state: Partial<Args>, input: Partial<Args>) => {
  // Merge new input with accumulated state
  const merged = { ...state, ...input };

  // Check if we have all required keys
  const hasAll = requiredKeys.every(k => k in merged && merged[k] !== undefined);

  if (hasAll) {
    return compute(merged as Args);
  } else {
    return accumulate(merged);
  }
};

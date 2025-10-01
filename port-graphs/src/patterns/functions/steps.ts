// ================================================
// Function Step Actions
// ================================================

/**
 * Universal action shape for function gadgets.
 * Steps decide what to update and what to emit.
 * Handler mechanically executes these instructions.
 */
export type FunctionActions<S, Out> = {
  updateState?: S;      // If present, update state to this value
  emitComputed?: Out;   // If present, emit { computed: Out }
  emitFailed?: {        // If present, emit { failed: {...} }
    input: any;
    error: string;
  };
};

// ================================================
// Transform Steps
// ================================================

/**
 * Step for simple transformations - runs function immediately.
 *
 * State: Out | undefined (last result)
 * Input: In (the value to transform)
 * Actions: { updateState: Out, emitComputed: Out }
 *
 * Function execution happens HERE in the step.
 *
 * @example
 * ```typescript
 * const step = transformStep((x: number) => x * 2);
 * const actions = step(undefined, 5);
 * // → { updateState: 10, emitComputed: 10 }
 * ```
 */
export const transformStep = <In, Out>(fn: (input: In) => Out) =>
  (_state: Out | undefined, input: In): FunctionActions<Out, Out> => {
    const result = fn(input);  // RUN FUNCTION HERE
    return {
      updateState: result,
      emitComputed: result
    };
  };

// ================================================
// Partial Application Steps
// ================================================

/**
 * State type for partial application gadgets.
 * Stores both accumulated arguments AND the last computed result.
 */
export type PartialState<Args extends Record<string, any>, Out> = {
  args: Partial<Args>;  // Accumulated arguments so far
  result?: Out;         // Last computed result (if any)
};

/**
 * Step for partial function application.
 * Accumulates arguments, runs function when all required keys present.
 *
 * State: { args: Partial<Args>, result?: Out }
 * Input: Partial<Args> (new arguments to merge)
 * Actions:
 *   - When not ready: { updateState: { args: merged, result: old } }
 *   - When ready: { updateState: { args, result }, emitComputed: result }
 *
 * Function execution happens HERE when all required keys present.
 *
 * @example
 * ```typescript
 * type Args = { x: number; y: number };
 * const step = partialStep((args: Args) => args.x + args.y, ['x', 'y']);
 *
 * // First input - not ready yet
 * step({ args: {}, result: undefined }, { x: 5 });
 * // → { updateState: { args: { x: 5 }, result: undefined } }
 *
 * // Second input - ready, compute!
 * step({ args: { x: 5 }, result: undefined }, { y: 3 });
 * // → { updateState: { args: { x: 5, y: 3 }, result: 8 }, emitComputed: 8 }
 * ```
 */
export const partialStep = <Args extends Record<string, any>, Out>(
  fn: (args: Args) => Out,
  requiredKeys: (keyof Args)[]
) => (
  state: PartialState<Args, Out>,
  input: Partial<Args>
): FunctionActions<PartialState<Args, Out>, Out> => {
  // Merge new input with accumulated args
  const merged = { ...state.args, ...input };

  // Check if we have all required keys
  const hasAll = requiredKeys.every(k => k in merged && merged[k] !== undefined);

  if (hasAll) {
    // All args present - RUN FUNCTION HERE
    const result = fn(merged as Args);
    return {
      updateState: { args: merged as Args, result },
      emitComputed: result
    };
  } else {
    // Still accumulating - update args but don't emit
    return {
      updateState: { args: merged, result: state.result }
    };
  }
};

// ================================================
// Fallible Transform Steps
// ================================================

/**
 * Step for fallible transformations - wraps function in try/catch.
 *
 * State: Out | undefined (last successful result)
 * Input: In (the value to transform)
 * Actions:
 *   - Success: { updateState: Out, emitComputed: Out }
 *   - Failure: { emitFailed: { input, error } }
 *
 * Function execution and error handling happen HERE in the step.
 *
 * @example
 * ```typescript
 * const step = fallibleStep(JSON.parse);
 *
 * // Success
 * step(undefined, '{"x": 1}');
 * // → { updateState: {x: 1}, emitComputed: {x: 1} }
 *
 * // Failure
 * step({x: 1}, 'bad json');
 * // → { emitFailed: { input: 'bad json', error: '...' } }
 * // Note: state unchanged on failure
 * ```
 */
export const fallibleStep = <In, Out>(fn: (input: In) => Out) =>
  (_state: Out | undefined, input: In): FunctionActions<Out, Out> => {
    try {
      const result = fn(input);  // RUN FUNCTION HERE
      return {
        updateState: result,
        emitComputed: result
      };
    } catch (e) {
      // On error: don't update state, just emit failed effect
      return {
        emitFailed: {
          input,
          error: e instanceof Error ? e.message : String(e)
        }
      };
    }
  };

// ================================================
// Requester Steps (Async Operations)
// ================================================

/**
 * State type for requester gadgets.
 * Tracks both the last request and last successful response.
 */
export type RequesterState<Req, Res> = {
  lastRequest?: Req;
  lastResponse?: Res;
};

/**
 * Action type for requester gadgets.
 * Unlike FunctionActions, this spawns async operations.
 */
export type RequesterActions<Req, Res> = {
  executeRequest: {
    request: Req;
    fn: (req: Req) => Promise<Res>;
  };
  updateState?: RequesterState<Req, Res>;
};

/**
 * Step for async request/response operations.
 *
 * State: { lastRequest?: Req, lastResponse?: Res }
 * Input: Req (the request to execute)
 * Actions: { executeRequest: { request, fn }, updateState }
 *
 * The handler will execute the async function and emit:
 * 1. Immediately: { requested: Req }
 * 2. Later: { responded: Res } OR { failed: { request, error } }
 *
 * This follows the fire-and-forget philosophy - no timing guarantees.
 *
 * @example
 * ```typescript
 * const fetchUser = requesterStep(async (id: number) => {
 *   const response = await fetch(`/users/${id}`);
 *   return response.json();
 * });
 *
 * const actions = fetchUser({ lastRequest: undefined, lastResponse: undefined }, 123);
 * // → { executeRequest: { request: 123, fn }, updateState: { lastRequest: 123 } }
 * ```
 */
export const requesterStep = <Req, Res>(fn: (req: Req) => Promise<Res>) =>
  (state: RequesterState<Req, Res>, input: Req): RequesterActions<Req, Res> => {
    return {
      executeRequest: {
        request: input,
        fn
      },
      updateState: {
        lastRequest: input,
        lastResponse: state.lastResponse  // Keep last response
      }
    };
  };

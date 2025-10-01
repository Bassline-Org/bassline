import { HandlerContext } from '../../core/context';
import type { FunctionActions, RequesterActions, RequesterState } from './steps';

// ================================================
// Universal Function Handler
// ================================================

/**
 * Universal handler for all function gadget types.
 *
 * This handler is purely mechanical - it executes instructions from the step:
 * - If actions.updateState is present, update state
 * - If actions.emitComputed is present, emit { computed }
 * - If actions.emitFailed is present, emit { failed }
 *
 * The step contains all the domain logic (running functions, error handling).
 * The handler just mechanically executes those decisions.
 *
 * Works for:
 * - Simple transforms (transformStep)
 * - Partial application (partialStep)
 * - Fallible transforms (fallibleStep)
 *
 * @example
 * ```typescript
 * // Same handler for all function types!
 * const transform = protoGadget(transformStep(fn)).handler(functionHandler);
 * const partial = protoGadget(partialStep(fn, keys)).handler(functionHandler);
 * const fallible = protoGadget(fallibleStep(fn)).handler(functionHandler);
 * ```
 */
export function functionHandler<S, Out>(
  g: HandlerContext<S>,
  actions: FunctionActions<S, Out>
): {
  computed?: Out
  failed?: { input: any; error: string }
} | {} {
  // Update state if specified
  if (actions.updateState !== undefined) {
    g.update(actions.updateState);
  }

  // Emit computed effect if specified
  if (actions.emitComputed !== undefined) {
    return { computed: actions.emitComputed };
  }

  // Emit failed effect if specified
  if (actions.emitFailed) {
    return { failed: actions.emitFailed };
  }

  // No effects to emit
  return {};
}

// ================================================
// Requester Handler (Async Operations)
// ================================================

/**
 * Handler for async request/response operations.
 *
 * This handler:
 * 1. Updates state with the request immediately
 * 2. Returns { requested } effect immediately
 * 3. Spawns async operation (fire-and-forget!)
 * 4. When async completes, calls emit() directly with { responded } or { failed }
 *
 * The async operation has no timing or delivery guarantees - this follows
 * the fire-and-forget philosophy. The async code can call emit() because
 * it captures the gadget reference (even though the type says HandlerContext,
 * the actual value includes emit).
 *
 * @example
 * ```typescript
 * const fetcher = protoGadget(requesterStep(fetchUser)).handler(requesterHandler);
 * const gadget = withTaps(quick(fetcher, { lastRequest: undefined, lastResponse: undefined }));
 *
 * gadget.tap(({ requested, responded, failed }) => {
 *   if (requested) console.log('Started:', requested);
 *   if (responded) console.log('Got:', responded);
 *   if (failed) console.error('Failed:', failed);
 * });
 *
 * gadget.receive(123);  // → Immediately: { requested: 123 }
 *                       // → Later: { responded: {...} } or { failed: {...} }
 * ```
 */
export function requesterHandler<Req, Res>(
  g: HandlerContext<RequesterState<Req, Res>>,
  actions: RequesterActions<Req, Res>
): {
  requested?: Req;
  responded?: Res;
  failed?: { request: Req; error: string };
} {
  if ('executeRequest' in actions && actions.executeRequest) {
    const { request, fn } = actions.executeRequest;

    // Update state immediately
    if (actions.updateState !== undefined) {
      g.update(actions.updateState);
    }

    // Cast to access emit() - the actual value is the full gadget
    // even though the type says HandlerContext<S> (just Store<S>)
    const gadget = g as any;

    // Spawn async operation (fire-and-forget!)
    fn(request)
      .then(response => {
        // Update state with response
        gadget.update({
          lastRequest: request,
          lastResponse: response
        });
        // Emit responded effect
        gadget.emit({ responded: response });
      })
      .catch(error => {
        // Don't update state on failure
        // Just emit failed effect
        gadget.emit({
          failed: {
            request,
            error: error instanceof Error ? error.message : String(error)
          }
        });
      });

    // Return immediate effect
    return { requested: request };
  }

  return {};
}

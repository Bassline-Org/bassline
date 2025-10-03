import { HandlerContext } from '../../core/context';
import type { FunctionActions } from './steps';

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

import { HandlerContext } from '../../core/context';
import type { FunctionActions } from './steps';

// ================================================
// Function Handlers
// ================================================

/**
 * Handler for simple transformations.
 * Executes the function and emits { computed: Out }.
 *
 * Takes the function as configuration, returns a handler.
 *
 * @example
 * ```typescript
 * const handler = transformHandler((x: number) => x * 2);
 * const proto = protoGadget(transformStep()).handler(handler);
 * ```
 */
export function transformHandler<In, Out>(
  fn: (input: In) => Out
) {
  return (
    g: HandlerContext<Out>,
    actions: FunctionActions<In>
  ): { computed?: Out } => {
    if (actions.compute !== undefined) {
      const result = fn(actions.compute);
      g.update(result);
      return { computed: result } as const;
    }
    return {};
  };
}

/**
 * Handler for partial function application.
 * Accumulates arguments or computes when all required keys present.
 *
 * Takes the function as configuration, returns a handler.
 *
 * @example
 * ```typescript
 * const handler = partialHandler((args: { x: number; y: number }) => args.x + args.y);
 * const proto = protoGadget(partialStep(['x', 'y'])).handler(handler);
 * ```
 */
export function partialHandler<Args extends Record<string, any>, Out>(
  fn: (args: Args) => Out
) {
  return (
    g: HandlerContext<Partial<Args>>,
    actions: FunctionActions<Args | Partial<Args>>
  ): { computed: Out } | {} => {
    if (actions.compute !== undefined) {
      // We have all required args, compute the result
      const result = fn(actions.compute as Args);
      g.update(actions.compute as Args);
      return { computed: result };
    }
    if (actions.accumulate !== undefined) {
      // Still accumulating args, update state but don't emit
      g.update(actions.accumulate as Partial<Args>);
      return {};
    }
    return {};
  };
}

/**
 * Handler for fallible transformations.
 * Wraps function execution in try/catch, emits { computed } or { failed }.
 *
 * Takes the function as configuration, returns a handler.
 *
 * @example
 * ```typescript
 * const handler = fallibleHandler(JSON.parse);
 * const proto = protoGadget(transformStep()).handler(handler);
 * ```
 */
export function fallibleHandler<In, Out>(
  fn: (input: In) => Out
) {
  return (
    g: HandlerContext<Out>,
    actions: FunctionActions<In>
  ): {
    computed?: Out,
    failed?: { input: In; error: string }
  } => {
    if (actions.compute !== undefined) {
      try {
        const result = fn(actions.compute);
        g.update(result);
        return { computed: result };
      } catch (e) {
        return {
          failed: {
            input: actions.compute,
            error: e instanceof Error ? e.message : String(e)
          }
        };
      }
    }
    return {};
  };
}

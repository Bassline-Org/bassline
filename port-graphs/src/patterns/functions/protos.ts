import { protoGadget } from '../../core/context';
import { transformStep, partialStep } from './steps';
import { transformHandler, partialHandler, fallibleHandler } from './handlers';

// ================================================
// Function Proto-Gadgets
// ================================================

/**
 * Proto-gadget for simple transformations.
 *
 * Implements: Transform<In, Out>
 *
 * @example
 * ```typescript
 * const double = quick(transformProto((x: number) => x * 2), undefined);
 *
 * double.receive(5);
 * console.log(double.current());  // 10
 * ```
 */
export const transformProto = <In, Out>(fn: (input: In) => Out) =>
  protoGadget(transformStep<In, Out>).handler(transformHandler(fn));

/**
 * Proto-gadget for partial function application.
 *
 * Implements: PartialFunction<Args, Out>
 *
 * Accumulates arguments until all required keys are present, then computes.
 *
 * @example
 * ```typescript
 * type Args = { x: number; y: number };
 * const add = quick(
 *   partialProto((args: Args) => args.x + args.y, ['x', 'y']),
 *   {}
 * );
 *
 * add.receive({ x: 5 });  // Accumulates
 * add.receive({ y: 3 });  // Computes: 8
 * console.log(add.current());  // { x: 5, y: 3 }
 * ```
 */
export const partialProto = <Args extends Record<string, any>, Out>(
  fn: (args: Args) => Out,
  requiredKeys: (keyof Args)[]
) => protoGadget(partialStep<Args>(requiredKeys)).handler(partialHandler(fn));

/**
 * Proto-gadget for fallible transformations.
 *
 * Implements: FallibleTransform<In, Out>
 *
 * Wraps function execution in try/catch, emits { computed } or { failed }.
 *
 * @example
 * ```typescript
 * const parse = withTaps(quick(fallibleProto(JSON.parse), undefined));
 *
 * parse.tap(({ computed, failed }) => {
 *   if (computed) console.log('Parsed:', computed);
 *   if (failed) console.error('Failed:', failed.error);
 * });
 *
 * parse.receive('{"x": 1}');  // → { computed: {x: 1} }
 * parse.receive('bad json');  // → { failed: {...} }
 * ```
 */
export const fallibleProto = <In, Out>(fn: (input: In) => Out) =>
  protoGadget(transformStep<In, Out>).handler(fallibleHandler(fn));

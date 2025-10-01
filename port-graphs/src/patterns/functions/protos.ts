import { protoGadget } from '../../core/context';
import {
  transformStep,
  partialStep,
  fallibleStep,
  requesterStep,
  type PartialState,
  type RequesterState
} from './steps';
import { functionHandler, requesterHandler } from './handlers';

// ================================================
// Function Proto-Gadgets
// ================================================

/**
 * Proto-gadget for simple transformations.
 *
 * Implements: Transform<In, Out>
 *
 * State: Out | undefined (last result)
 * Uses universal functionHandler.
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
  protoGadget(transformStep(fn)).handler(functionHandler);

/**
 * Proto-gadget for partial function application.
 *
 * Implements: PartialFunction<Args, Out>
 *
 * State: { args: Partial<Args>, result?: Out }
 * Accumulates arguments until all required keys present, then computes.
 * Uses universal functionHandler.
 *
 * @example
 * ```typescript
 * type Args = { x: number; y: number };
 * const add = quick(
 *   partialProto((args: Args) => args.x + args.y, ['x', 'y']),
 *   { args: {}, result: undefined }
 * );
 *
 * add.receive({ x: 5 });  // Accumulates
 * console.log(add.current());  // { args: { x: 5 }, result: undefined }
 *
 * add.receive({ y: 3 });  // Computes: 8
 * console.log(add.current());  // { args: { x: 5, y: 3 }, result: 8 }
 * ```
 */
export const partialProto = <Args extends Record<string, any>, Out>(
  fn: (args: Args) => Out,
  requiredKeys: (keyof Args)[]
) => protoGadget(partialStep(fn, requiredKeys)).handler(functionHandler<PartialState<Args, Out>, Out>);

/**
 * Proto-gadget for fallible transformations.
 *
 * Implements: FallibleTransform<In, Out>
 *
 * State: Out | undefined (last successful result)
 * Wraps function execution in try/catch, emits { computed } or { failed }.
 * Uses universal functionHandler.
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
  protoGadget(fallibleStep(fn)).handler(functionHandler);

/**
 * Proto-gadget for async request/response operations.
 *
 * Implements: Requester<Req, Res>
 *
 * State: { lastRequest?: Req, lastResponse?: Res }
 * Executes async function and emits three possible effects:
 * - { requested: Req } - immediately when request starts
 * - { responded: Res } - when async operation succeeds
 * - { failed: { request, error } } - when async operation fails
 *
 * Uses requesterHandler which spawns async operations (fire-and-forget).
 * No timing or delivery guarantees - follows bassline philosophy.
 *
 * @example
 * ```typescript
 * const fetchUser = withTaps(quick(
 *   requesterProto(async (id: number) => {
 *     const res = await fetch(`/api/users/${id}`);
 *     return res.json();
 *   }),
 *   { lastRequest: undefined, lastResponse: undefined }
 * ));
 *
 * fetchUser.tap(({ requested, responded, failed }) => {
 *   if (requested) console.log('Fetching user:', requested);
 *   if (responded) console.log('Got user:', responded);
 *   if (failed) console.error('Failed:', failed.error);
 * });
 *
 * fetchUser.receive(123);
 * // → Immediately: { requested: 123 }
 * // → Later: { responded: {...} } or { failed: {...} }
 * ```
 */
export const requesterProto = <Req, Res>(fn: (req: Req) => Promise<Res>) =>
  protoGadget(requesterStep(fn)).handler(requesterHandler<Req, Res>);

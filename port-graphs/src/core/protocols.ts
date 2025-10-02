// ================================================
// Standard Behavioral Protocols
// ================================================
//
// Protocols define behavioral contracts for gadgets.
// A gadget implements a protocol by accepting the specified inputs
// and emitting the specified effects.
//
// Use these protocols to constrain generic functions and enable
// behavioral polymorphism - write code that works with ANY gadget
// implementing a particular protocol.

import { ProtocolShape } from './context';

/**
 * A gadget that holds and emits value changes.
 *
 * Examples: cells (max, min, last), sliders, counters, toggles
 *
 * @example
 * ```typescript
 * function mirror<T>(
 *   source: Implements<Valued<T>>,
 *   target: Implements<Valued<T>>
 * ) {
 *   source.tap(({ changed }) => {
 *     if (changed !== undefined) target.receive(changed);
 *   });
 * }
 * ```
 */
export interface Valued<T> extends ProtocolShape<T, { changed: T }> { }

/**
 * A gadget that can be cleared/reset to an initial state.
 *
 * Examples: text inputs, counters, accumulators, caches
 *
 * @example
 * ```typescript
 * function clearAll(gadgets: Implements<Clearable>[]) {
 *   gadgets.forEach(g => g.receive({ clear: {} }));
 * }
 * ```
 */
export interface Clearable extends ProtocolShape<{ clear: {} }, { cleared: {} }> { }

/**
 * A gadget that can fail or produce errors.
 *
 * Examples: validators, network requests, parsers, file I/O
 *
 * @example
 * ```typescript
 * function logErrors(gadget: Implements<Fallible>) {
 *   gadget.tap(({ error }) => {
 *     if (error) console.error(error);
 *   });
 * }
 * ```
 */
export interface Fallible extends ProtocolShape<never, { error: string }> { }

/**
 * A gadget that validates input against rules.
 *
 * Examples: form validators, type checkers, constraint checkers
 *
 * @example
 * ```typescript
 * function onlyValid<T>(
 *   validator: Implements<Validator<T>>,
 *   onValid: (value: T) => void
 * ) {
 *   validator.tap(({ validated }) => {
 *     if (validated !== undefined) onValid(validated);
 *   });
 * }
 * ```
 */
export interface Validator<T> extends ProtocolShape<
    T,
    { validated: T } | { invalid: { value: T; reason: string } }
> { }

/**
 * A gadget that aggregates multiple inputs into a result.
 *
 * Examples: sum, average, min/max, union, intersection
 *
 * @example
 * ```typescript
 * function sumValues(
 *   numbers: Implements<Valued<number>>[],
 *   aggregator: Implements<Aggregator<number, number>>
 * ) {
 *   const values = numbers.map(n => n.current());
 *   aggregator.receive(values);
 * }
 * ```
 */
export interface Aggregator<T, R = T> extends ProtocolShape<
    T[],
    { aggregated: R }
> { }

/**
 * A gadget that includes timestamps with changes.
 *
 * Examples: temporal cells, event logs, time series, audit trails
 *
 * @example
 * ```typescript
 * function trackHistory<T>(
 *   source: Implements<Temporal<T>>
 * ): Array<{ value: T; time: number }> {
 *   const history: Array<{ value: T; time: number }> = [];
 *   source.tap(({ changed, timestamp }) => {
 *     if (changed !== undefined && timestamp !== undefined) {
 *       history.push({ value: changed, time: timestamp });
 *     }
 *   });
 *   return history;
 * }
 * ```
 */
export interface Temporal<T> extends ProtocolShape<
    T,
    { changed: T; timestamp: number }
> { }

/**
 * A gadget that manages a collection of items.
 *
 * Examples: lists, sets, maps, registries, queues
 *
 * @example
 * ```typescript
 * function addAll<T>(
 *   collection: Implements<Collection<T>>,
 *   items: T[]
 * ) {
 *   items.forEach(item => {
 *     collection.receive({ add: item });
 *   });
 * }
 * ```
 */
export interface Collection<T> extends ProtocolShape<
    | { add: T }
    | { remove: T }
    | { clear: {} },
    | { added: T }
    | { removed: T }
    | { cleared: {} }
> { }

/**
 * A gadget that can be enabled/disabled.
 *
 * Examples: UI controls, feature flags, circuit breakers, switches
 *
 * @example
 * ```typescript
 * function disableWhenError(
 *   control: Implements<Toggleable>,
 *   errorSource: Emits<{ error: string }>
 * ) {
 *   errorSource.tap(({ error }) => {
 *     if (error) control.receive({ disable: {} });
 *   });
 * }
 * ```
 */
export interface Toggleable extends ProtocolShape<
    | { enable: {} }
    | { disable: {} },
    | { enabled: {} }
    | { disabled: {} }
> { }

/**
 * A gadget that manages network topology (connections between things).
 *
 * Examples: basslines, routers, message buses, graph managers
 *
 * @example
 * ```typescript
 * function wireAll(
 *   topology: Implements<Topology>,
 *   connections: Array<{ from: string; to: string }>
 * ) {
 *   connections.forEach(conn => {
 *     topology.receive({ connect: conn });
 *   });
 * }
 * ```
 */
export interface Topology extends ProtocolShape<
    | { connect: { from: string; to: string } }
    | { disconnect: string },
    | { connected: { from: string; to: string } }
    | { disconnected: string }
> { }

/**
 * A gadget that manages a registry of named items.
 *
 * Examples: namespace managers, instance registries, symbol tables, lookups
 *
 * @example
 * ```typescript
 * function registerAll<T>(
 *   registry: Implements<Registry<T>>,
 *   items: Map<string, T>
 * ) {
 *   items.forEach((value, id) => {
 *     registry.receive({ register: { id, value } });
 *   });
 * }
 * ```
 */
export interface Registry<T> extends ProtocolShape<
    | { register: { id: string; value: T } }
    | { unregister: string },
    | { registered: { id: string } }
    | { unregistered: string }
> { }

/**
 * A gadget that transforms input to output synchronously.
 *
 * Examples: map, filter, parse, format, compute
 *
 * @example
 * ```typescript
 * function chain<A, B, C>(
 *   first: Implements<Transform<A, B>>,
 *   second: Implements<Transform<B, C>>
 * ) {
 *   first.tap(({ computed }) => {
 *     if (computed !== undefined) second.receive(computed);
 *   });
 * }
 * ```
 */
export interface Transform<In, Out> extends ProtocolShape<
    In,
    { computed: Out }
> { }

/**
 * A gadget that accepts partial arguments and computes when all required keys are present.
 *
 * Examples: multi-arg functions, builders, form submission
 *
 * @example
 * ```typescript
 * function curry<Args extends Record<string, any>, Out>(
 *   fn: Implements<PartialFunction<Args, Out>>,
 *   fixedArgs: Partial<Args>
 * ) {
 *   fn.receive(fixedArgs);  // Pre-apply some arguments
 *   return fn;
 * }
 * ```
 */
export interface PartialFunction<Args extends Record<string, any>, Out> extends ProtocolShape<
    Partial<Args>,
    { computed: Out }
> { }

/**
 * A gadget that can fail during transformation.
 *
 * Examples: parsers, validators, type coercions, network calls
 *
 * @example
 * ```typescript
 * function withFallback<In, Out>(
 *   primary: Implements<FallibleTransform<In, Out>>,
 *   fallback: (input: In) => Out
 * ) {
 *   primary.tap((effects) => {
 *     if ('failed' in effects && effects.failed) {
 *       const result = fallback(effects.failed.input);
 *       // Use result somehow
 *     }
 *   });
 * }
 * ```
 */
export interface FallibleTransform<In, Out> extends ProtocolShape<
    In,
    | { computed: Out }
    | { failed: { input: In; error: string } }
> { }

export interface Table<K extends string, V> extends ProtocolShape<
    Record<K, V>,
    { added: Record<K, V> } | { changed: Record<K, V> }
> { }
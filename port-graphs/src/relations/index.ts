/**
 * Relations for wiring gadgets together
 *
 * These helpers describe how effects flow from source gadgets to target gadgets.
 * They're just wiring patterns - no new gadget types, just clean ways to connect.
 */

import type { Gadget, Tappable, EffectsOf, InputOf } from '../core/typed';

/**
 * Extract a specific effect field and send it as input to a target gadget.
 *
 * @example
 * ```typescript
 * const a = withTaps(maxCell(0));
 * const b = withTaps(maxCell(0));
 * extract(a, 'changed', b);  // When a emits {changed: value}, b receives value
 * ```
 */
export function extract<S1, S2, K extends keyof EffectsOf<S1>>(
  source: Gadget<S1> & Tappable<S1>,
  field: K,
  target: Gadget<S2>
): { cleanup: () => void } {
  const cleanup = source.tap(effect => {
    if (field in effect && effect[field] !== undefined) {
      // We need to cast here because TypeScript can't prove the relationship
      // between EffectsOf<S1>[K] and InputOf<S2> at this level of abstraction
      target.receive(effect[field] as InputOf<S2>);
    }
  });

  return { cleanup };
}

/**
 * Extract a field, transform it, then send to target.
 *
 * @example
 * ```typescript
 * const a = withTaps(maxCell(0));
 * const b = withTaps(maxCell(0));
 * transform(a, 'changed', x => x * 2, b);  // a's value * 2 → b
 * ```
 */
export function transform<S1, S2, K extends keyof EffectsOf<S1>>(
  source: Gadget<S1> & Tappable<S1>,
  field: K,
  fn: (value: EffectsOf<S1>[K]) => InputOf<S2> | undefined,
  target: Gadget<S2>
): { cleanup: () => void } {
  const cleanup = source.tap(effect => {
    if (field in effect && effect[field] !== undefined) {
      const transformed = fn(effect[field]);
      if (transformed !== undefined) {
        target.receive(transformed);
      }
    }
  });

  return { cleanup };
}

/**
 * Source specification for combine - either a gadget (defaults to 'changed')
 * or a tuple of [gadget, field] for explicit field selection.
 */
type SourceSpec<S> =
  | (Gadget<S> & Tappable<S>)
  | readonly [Gadget<S> & Tappable<S>, keyof EffectsOf<S>];

/**
 * Extract the gadget type from a SourceSpec
 */
type GadgetFromSpec<Spec> = Spec extends readonly [infer G, any] ? G : Spec;

/**
 * Extract the field name from a SourceSpec (defaults to 'changed')
 */
type FieldFromSpec<Spec> = Spec extends readonly [Gadget<infer S> & Tappable<infer S>, infer K]
  ? K extends keyof EffectsOf<S> ? K : 'changed'
  : 'changed';

/**
 * Wire multiple sources to a target gadget's named inputs.
 * Particularly useful with fn gadgets that expect named arguments.
 *
 * @example
 * ```typescript
 * const sum = withTaps(fn(
 *   ({x, y}: {x: number, y: number}) => x + y,
 *   ['x', 'y']
 * ));
 *
 * combine({
 *   x: sensor1,  // sensor1.changed → {x: value}
 *   y: [sensor2, 'computed']  // sensor2.computed → {y: value}
 * }, sum);
 * ```
 */
export function combine<
  Sources extends Record<keyof InputOf<Target>, SourceSpec<any>>,
  Target
>(
  sources: Sources,
  target: Gadget<Target>
): { cleanup: () => void } {
  const cleanups: (() => void)[] = [];

  for (const [key, source] of Object.entries(sources)) {
    // Determine gadget and field from source spec
    const [gadget, field] = Array.isArray(source)
      ? source
      : [source, 'changed' as const];

    // Type-safe tap with proper field extraction
    const cleanup = (gadget as Tappable<any>).tap((effect: any) => {
      if (field in effect && effect[field] !== undefined) {
        // Send as partial input with the key
        target.receive({ [key]: effect[field] } as InputOf<Target>);
      }
    });

    cleanups.push(cleanup);
  }

  return {
    cleanup: () => cleanups.forEach(c => c())
  };
}

/**
 * Helper to wire multiple relations at once and get a single cleanup.
 *
 * @example
 * ```typescript
 * const flow = relations([
 *   () => extract(a, 'changed', b),
 *   () => transform(b, 'changed', x => x * 2, c),
 *   () => combine({x: a, y: b}, sum)
 * ]);
 *
 * // Later: flow.cleanup() to disconnect everything
 * ```
 */
export function relations(
  relationFns: Array<() => { cleanup: () => void }>
): { cleanup: () => void } {
  const cleanups = relationFns.map(fn => fn().cleanup);

  return {
    cleanup: () => cleanups.forEach(c => c())
  };
}
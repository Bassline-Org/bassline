/**
 * Relations for wiring gadgets together
 *
 * These helpers describe how effects flow from source gadgets to target gadgets.
 * They're just wiring patterns - no new gadget types, just clean ways to connect.
 */

import type { Gadget, Tappable, EffectsOf, InputOf, Effects } from '../core/typed';

// Type helpers for cleaner combiner signatures

/** Keys from the target's inputs that haven't been wired yet */
type AvailableKeys<Target, Wired> = Exclude<keyof InputOf<Target>, Wired>;

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
 * Wire multiple sources to a target gadget's named inputs.
 * Particularly useful with fn gadgets that expect named arguments.
 *
 * Sources can be:
 * - A gadget (defaults to extracting 'changed' effect)
 * - A tuple of [gadget, field] for explicit field selection
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

/**
 * Builder for wiring multiple gadgets to a target gadget's inputs.
 * Provides type-safe, fluent API with autocomplete.
 */
export class Combiner<Target, Wired extends keyof InputOf<Target> = never> {
  private cleanups: (() => void)[] = [];
  private wiredKeys = new Set<string>();

  constructor(private targetGadget: Gadget<Target>) { }

  /**
   * Wire a source gadget to a specific input key.
   * Defaults to extracting the 'changed' effect.
   * The source must have a 'changed' effect that matches the target input type.
   */
  wire<K extends AvailableKeys<Target, Wired>, S extends Effects<{ changed: InputOf<Target>[K] }>>(
    key: K,
    source: Gadget<S> & Tappable<S>
  ): Combiner<Target, Wired | K>;

  /**
   * Wire a source gadget to a specific input key, extracting a specific effect field.
   */
  wire<K extends AvailableKeys<Target, Wired>, S>(
    key: K,
    source: Gadget<S> & Tappable<S>,
    field: keyof EffectsOf<S>
  ): Combiner<Target, Wired | K>;

  /**
   * Wire a source gadget to a specific input key with transformation.
   */
  wire<K extends AvailableKeys<Target, Wired>, S, F extends keyof EffectsOf<S>>(
    key: K,
    source: Gadget<S> & Tappable<S>,
    field: F,
    transform: (value: EffectsOf<S>[F]) => InputOf<Target>[K]
  ): Combiner<Target, Wired | K>;

  // Implementation
  wire<K extends AvailableKeys<Target, Wired>>(
    key: K,
    source: any,
    field: string = 'changed',
    transform?: (value: unknown) => unknown
  ): Combiner<Target, Wired | K> {
    if (this.wiredKeys.has(key as string)) {
      throw new Error(`Key "${String(key)}" is already wired`);
    }

    const cleanup = source.tap((effect: any) => {
      if (typeof effect === 'object' &&
        effect !== null &&
        field in effect) {
        const value = effect[field];
        if (value !== undefined) {
          const finalValue = transform ? transform(value) : value;
          if (finalValue !== undefined) {
            this.targetGadget.receive({ [key]: finalValue } as InputOf<Target>);
          }
        }
      }
    });

    this.cleanups.push(cleanup);
    this.wiredKeys.add(key as string);

    return this as any;
  }

  /**
   * Build the final wiring and return cleanup function.
   * This method provides compile-time checking that all required inputs are wired.
   */
  build(): { cleanup: () => void } {
    return {
      cleanup: () => this.cleanups.forEach(c => c())
    };
  }
}

/**
 * Create a combiner for wiring gadgets to a target.
 * Provides type-safe builder pattern with excellent autocomplete.
 *
 * @example
 * ```typescript
 * const sum = fn(({x, y}: {x: number, y: number}) => x + y, ['x', 'y']);
 *
 * // Basic usage - TypeScript knows 'x' and 'y' are required
 * combiner(sum)
 *   .wire('x', sensor1)      // After this, only 'y' is available
 *   .wire('y', sensor2)      // After this, no more keys available
 *   .build();
 *
 * // With field extraction
 * combiner(sum)
 *   .wire('x', sensor1, 'value')     // Extract 'value' field
 *   .wire('y', sensor2, 'computed')  // Extract 'computed' field
 *   .build();
 *
 * // With transformation
 * combiner(sum)
 *   .wire('x', sensor1, 'changed', x => x * 2)  // Double the value
 *   .wire('y', sensor2)
 *   .build();
 * ```
 */
export function combiner<Target>(
  targetGadget: Gadget<Target>
): Combiner<Target, never> {
  return new Combiner(targetGadget);
}


/**
 * Helper to wire multiple relations at once and get a single cleanup.
 *
 * @example
 * ```typescript
 * const flow = relations([
 *   () => extract(a, 'changed', b),
 *   () => transform(b, 'changed', x => x * 2, c),
 *   () => combiner(sum).wire('x', a).wire('y', b).build()
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
/**
 * Declarative component for wiring gadgets together.
 *
 * This component provides a JSX-based syntax for creating gadget relations,
 * making wiring more readable and declarative in React components.
 */

import { useEffect } from 'react';
import type { Gadget, Tappable, EffectsOf, InputOf } from 'port-graphs';
import { extract, transform } from 'port-graphs';

/**
 * Props for the Wire component.
 * Supports three modes:
 * 1. Simple forwarding: from -> to
 * 2. Field extraction: from -> field -> to
 * 3. Transformation: from -> field -> transform -> to
 */
export interface WireProps<
  S1,
  S2,
  F extends keyof EffectsOf<S1>
> {
  /** Source gadget to wire from */
  from: Gadget<S1> & Tappable<S1>;
  /** Target gadget to wire to */
  to: Gadget<S2>;
  /** Optional field to extract from source effects (defaults to 'changed') */
  field?: F;
  /** Optional transformation function */
  transform?: (value: EffectsOf<S1>[F]) => InputOf<S2> | undefined;
}

/**
 * Wire component for declarative gadget connections.
 *
 * This component creates a relation between two gadgets and automatically
 * cleans up when unmounted.
 *
 * @example
 * ```tsx
 * // Simple forwarding
 * <Wire from={source} to={target} />
 *
 * // Field extraction
 * <Wire from={source} field="computed" to={target} />
 *
 * // With transformation
 * <Wire
 *   from={slider}
 *   field="changed"
 *   transform={value => value * 2}
 *   to={display}
 * />
 *
 * // Multiple wires
 * <>
 *   <Wire from={a} to={b} />
 *   <Wire from={b} to={c} />
 *   <Wire from={c} transform={x => x + 1} to={d} />
 * </>
 * ```
 */
export function Wire<
  S1,
  S2,
  F extends keyof EffectsOf<S1>
>({
  from,
  to,
  field = 'changed' as F,
  transform: transformFn
}: WireProps<S1, S2, F>) {
  useEffect(() => {
    let cleanup: () => void;

    if (transformFn) {
      // Use transform when transformation function is provided
      const relation = transform(from, field, transformFn, to);
      cleanup = relation.cleanup;
    } else {
      // Use extract for simple field forwarding
      const relation = extract(from, field, to);
      cleanup = relation.cleanup;
    }

    return cleanup;
  }, [from, to, field, transformFn]);

  // This component doesn't render anything
  return null;
}
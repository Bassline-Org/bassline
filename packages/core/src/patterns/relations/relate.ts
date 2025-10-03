/**
 * Bidirectional Constraint Relations
 *
 * Wire two gadgets with bidirectional constraints that propagate changes
 * in both directions. Like (a+b=c) and (c-a=b), data flows through
 * constraint functions to keep gadgets synchronized.
 *
 * Idempotent gadgets prevent infinite loops - sending the same value
 * multiple times is a no-op, so bidirectional loops naturally converge.
 */

import _ from 'lodash';
import { Accepts, Emit, Emits, Handles, quick, Receive, Step, Store, Tappable, withTaps, type Implements } from '../../core/context';
import type { Valued } from '../../core/protocols';
import { firstTableProto, intersectionProto, lastProto, maxProto, unionProto } from '../cells';
import { onChange, onComputed } from '../taps';
import { FunctionActions, partialProto, PartialState } from '../functions';

/**
 * Wire two Valued gadgets bidirectionally with constraint functions
 *
 * When gadgetA changes → compute forward(a) → send to gadgetB
 * When gadgetB changes → compute backward(b) → send to gadgetA
 *
 * Requires idempotent gadgets to prevent infinite loops.
 * If A and B use ACI cells (intersection, union, last, etc.),
 * the bidirectional loop will converge to a fixed point.
 *
 * @param gadgetA - First gadget (must implement Valued<A>)
 * @param gadgetB - Second gadget (must implement Valued<B>)
 * @param constraint - Bidirectional transformation functions
 * @returns Cleanup function that removes both taps
 *
 * @example
 * ```typescript
 * // Addition constraint: a + b = c
 * const a = withTaps(lastCell(3));
 * const b = withTaps(lastCell(5));
 * const c = withTaps(lastCell(8));
 *
 * relate(a, c, {
 *   forward: (a) => a + b.current(),  // a + b = c
 *   backward: (c) => c - b.current()  // c - b = a
 * });
 *
 * a.receive(4);  // c updates to 9
 * c.receive(10); // a updates to 5
 * ```
 */
export function related<A, B>(
  gadgetA: Implements<Valued<A>>,
  gadgetB: Implements<Valued<B>>,
  constraint: {
    forward: (a: A) => B;
    backward: (b: B) => A;
  }
): () => void {
  const cleanupA = forward(gadgetA, gadgetB, constraint.forward);
  const cleanupB = forward(gadgetB, gadgetA, constraint.backward);
  return () => {
    cleanupA();
    cleanupB();
  };
}

/**
 * Wire gadget A to gadget B unidirectionally
 *
 * When gadgetA changes → compute transform(a) → send to gadgetB
 *
 * This is just one direction of relate(). Useful when you only need
 * one-way synchronization (e.g., derived views).
 *
 * @param source - Source gadget (must implement Valued<A>)
 * @param target - Target gadget (must implement Valued<B>)
 * @param transform - Transformation function from A to B
 * @returns Cleanup function that removes the tap
 *
 * @example
 * ```typescript
 * const count = withTaps(lastCell(5));
 * const doubled = withTaps(lastCell(10));
 *
 * forward(count, doubled, (n) => n * 2);
 *
 * count.receive(7);  // doubled becomes 14
 * ```
 */
export function forward<A, B>(
  source: Implements<Valued<A>>,
  target: Implements<Valued<B>>,
  transform: (a: A) => B
): () => void {
  return source.tap(({ changed }) => {
    if (changed !== undefined) {
      const newB = transform(changed);
      target.receive(newB);
    }
  });
}

export function computes<A, B>(source: Emits<{ computed: A }>, target: Accepts<B>, transform?: (a: A) => B) {
  return source.tap(({ computed }) => {
    if (computed !== undefined) {
      target.receive(transform ? transform(computed) : computed as B);
    }
  });
}

export function contributes<K extends string, T>(target: Accepts<Partial<Record<K, T>>>, sources: Record<K, Implements<Valued<T>>>) {
  const cleanups: (() => void)[] = [];
  for (const key in sources) {
    const source = sources[key];
    const cleanup = onChange(source, (changed) => target.receive({ [key]: changed } as Partial<Record<K, T>>));
    cleanups.push(cleanup);
  }
  return () => {
    cleanups.forEach(cleanup => cleanup());
  };
}

export function same<T>(source: Implements<Valued<T>>, target: Implements<Valued<T>>) {
  return related(source, target, {
    forward: (a) => a,
    backward: (b) => b,
  });
}
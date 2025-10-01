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

import type { Implements } from '../../core/context';
import type { Valued } from '../../core/protocols';

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
export function relate<A, B>(
  gadgetA: Implements<Valued<A>>,
  gadgetB: Implements<Valued<B>>,
  constraint: {
    forward: (a: A) => B;
    backward: (b: B) => A;
  }
): () => void {
  // Track if we're currently propagating to prevent immediate echo
  let propagating = false;

  // Forward: A changes → update B
  const cleanupA = gadgetA.tap(({ changed }) => {
    if (changed !== undefined && !propagating) {
      propagating = true;
      try {
        const newB = constraint.forward(changed);
        gadgetB.receive(newB);
      } finally {
        propagating = false;
      }
    }
  });

  // Backward: B changes → update A
  const cleanupB = gadgetB.tap(({ changed }) => {
    if (changed !== undefined && !propagating) {
      propagating = true;
      try {
        const newA = constraint.backward(changed);
        gadgetA.receive(newA);
      } finally {
        propagating = false;
      }
    }
  });

  // Return combined cleanup
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

/**
 * Wire multiple source gadgets to a target using a combining function
 *
 * When any source changes → compute combine(sources) → send to target
 *
 * @param sources - Array of source gadgets
 * @param target - Target gadget
 * @param combine - Function that combines all source values
 * @returns Cleanup function that removes all taps
 *
 * @example
 * ```typescript
 * const a = withTaps(lastCell(3));
 * const b = withTaps(lastCell(5));
 * const sum = withTaps(lastCell(0));
 *
 * combine([a, b], sum, (sources) => {
 *   return sources[0].current() + sources[1].current();
 * });
 *
 * a.receive(4);  // sum becomes 9
 * b.receive(6);  // sum becomes 10
 * ```
 */
export function combine<T, R>(
  sources: Implements<Valued<T>>[],
  target: Implements<Valued<R>>,
  combiner: (sources: Implements<Valued<T>>[]) => R
): () => void {
  const cleanups = sources.map(source =>
    source.tap(() => {
      const result = combiner(sources);
      target.receive(result);
    })
  );

  return () => {
    cleanups.forEach(cleanup => cleanup());
  };
}

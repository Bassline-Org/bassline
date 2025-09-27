/**
 * React hook for managing gadget relations with automatic cleanup.
 *
 * This hook simplifies wiring gadgets together in React components by:
 * - Automatically cleaning up relations on unmount
 * - Supporting the relations module's builder patterns
 * - Working seamlessly with useGadgetMap
 */

import { useEffect } from 'react';

/**
 * Hook that manages gadget relations with automatic cleanup.
 *
 * Takes an array of relation factory functions and ensures they're
 * cleaned up when the component unmounts or dependencies change.
 *
 * @example
 * ```tsx
 * import { extract, combiner } from 'port-graphs';
 *
 * function MyComponent() {
 *   const g = useGadgetMap({ a: gadget1, b: gadget2, sum: sumGadget });
 *
 *   // Relations are automatically cleaned up on unmount
 *   useRelations([
 *     () => extract(g.a.gadget, 'changed', g.sum.gadget),
 *     () => extract(g.b.gadget, 'changed', g.sum.gadget),
 *   ]);
 *
 *   // Or use combiner for more complex wiring
 *   useRelations([
 *     () => combiner(g.sum.gadget)
 *       .wire('x', g.a.gadget)
 *       .wire('y', g.b.gadget)
 *       .build()
 *   ]);
 * }
 * ```
 *
 * @param relationFactories - Array of functions that create relations and return cleanup
 * @param deps - Optional dependency array (defaults to empty array for mount-only)
 */
export function useRelations(
  relationFactories: Array<() => { cleanup: () => void }>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    // Create all relations and collect cleanup functions
    const cleanups = relationFactories.map(factory => {
      const relation = factory();
      return relation.cleanup;
    });

    // Return cleanup function that calls all individual cleanups
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}
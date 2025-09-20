/**
 * Creates a family of React-ready gadgets
 *
 * This is a convenience wrapper around createFamily that automatically
 * makes all gadgets tappable for easy connections in React components.
 */

import { createFamily, withTaps, type Gadget } from 'port-graphs';

/**
 * Creates a family gadget that produces React-ready (tappable) gadgets.
 * All gadgets created are identical - the key is only for storage/retrieval.
 *
 * @param factory - Parameterless function that creates a gadget
 * @returns A family gadget that manages tappable gadgets
 *
 * @example
 * // Create a family of tappable counter gadgets
 * const counterFamily = createReactFamily(() => lastCell(0));
 *
 * // Use in components
 * function Counter({ id }: { id: string }) {
 *   const [value, send] = useGadget(counterFamily, id);
 *   return <div>{value}</div>;
 * }
 */
export function createReactFamily<State, Incoming = any, Effect = any>(
  factory: () => Gadget<State, Incoming, Effect>
) {
  type FactoryGadget = Gadget<State, Incoming, Effect>;
  // Wrap the factory to produce tappable gadgets
  return createFamily(() => withTaps(factory()) as FactoryGadget);
}
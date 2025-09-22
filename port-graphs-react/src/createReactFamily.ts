/**
 * Creates a family of React-ready gadgets
 *
 * This is a convenience wrapper around createTypedFamily that automatically
 * makes all gadgets tappable for easy connections in React components.
 */

import { withTaps, createTypedFamily, type TypedGadget, type GadgetSpec, ExtractSpec, Tappable, PartialSpec } from 'port-graphs';

/**
 * Creates a family gadget that produces React-ready (tappable) gadgets.
 * All gadgets created are identical - the key is only for storage/retrieval.
 *
 * @param factory - Function that creates a typed gadget
 * @returns A family gadget that manages tappable gadgets
 *
 * @example
 * // Create a family of tappable slider gadgets
 * const sliderFamily = createReactFamily(() => sliderGadget(0, 0, 100));
 *
 * // Use in components
 * function Slider({ id }: { id: string }) {
 *   const [state, send] = useGadget(sliderFamily, id);
 *   return <div>{state.value}</div>;
 * }
 */
export function createReactFamily<G, Spec extends PartialSpec = ExtractSpec<G>>(
  factory: () => TypedGadget<Spec>
) {
  // Wrap the factory to produce tappable gadgets
  return createTypedFamily(() => withTaps(factory()));
}
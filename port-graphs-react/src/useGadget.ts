/**
 * React hook for integrating typed gadgets with React state management
 *
 * This hook uses TypedGadget for full type safety and inference.
 * All gadgets are managed through the GadgetProvider for consistent state.
 */

import { Gadget, Tappable } from 'port-graphs';
import { useGadgetFromProvider } from './GadgetProvider';

/**
 * React hook for using typed gadgets with automatic state management.
 *
 * The hook automatically infers the exact types from the gadget's spec:
 * - State type from Spec['state']
 * - Input type from Spec['input']
 * - Effect type from Spec['effects']
 *
 * @example
 * // With a slider gadget
 * const slider = sliderGadget(50, 0, 100);
 * const [state, send, gadget] = useGadget(slider);
 * // state is SliderState
 * // send accepts SliderCommands
 * // gadget has tap method with typed effects
 *
 * @param gadget - A TypedGadget with its spec
 * @returns Tuple of [state, send function, gadget with tap]
 */

export function useGadget<S>(
  gadget: Gadget<S>
) {
  return useGadgetFromProvider(gadget);
}
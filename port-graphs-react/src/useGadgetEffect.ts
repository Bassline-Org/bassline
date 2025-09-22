/**
 * React hook for subscribing to typed gadget effects
 *
 * This hook allows components to respond to effects emitted by gadgets,
 * with full type safety from the GadgetSpec.
 */

import { useEffect, useRef } from 'react';
import { ExtractSpec, Tappable, type TypedGadget } from 'port-graphs';
import { useGadget } from './useGadget';

/**
 * React hook for subscribing to gadget effects with automatic cleanup.
 *
 * The hook automatically infers the effect type from the gadget's spec
 * and ensures the callback receives properly typed effects.
 *
 * @example
 * ```tsx
 * const slider = sliderGadget(50, 0, 100);
 *
 * function MyComponent() {
 *   // Effect is SliderSpec['effects']
 *   useGadgetEffect(slider, (effect) => {
 *     if ('changed' in effect) {
 *       console.log('Slider changed to:', effect.changed);
 *     }
 *   });
 *
 *   return <Slider gadget={slider} />;
 * }
 * ```
 *
 * @param gadget - A TypedGadget with its spec
 * @param callback - Function to call when effects are emitted
 * @param deps - Optional dependency array for the effect callback
 */
export function useGadgetEffect<G extends TypedGadget<any>>(
  gadget: G,
  callback: (effect: ExtractSpec<typeof gadget>['effects']) => void,
  deps?: React.DependencyList
) {
  // Get the tappable gadget from useGadget
  const [, , tappableGadget] = useGadget(gadget);

  // Store the latest callback to avoid stale closures
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    // Subscribe to effects with proper typing
    const unsubscribe = tappableGadget.tap((effect: ExtractSpec<typeof gadget>['effects']) => {
      callbackRef.current(effect);
    });

    // Cleanup on unmount or when dependencies change
    return unsubscribe;
  }, [tappableGadget, ...(deps || [])]);
}
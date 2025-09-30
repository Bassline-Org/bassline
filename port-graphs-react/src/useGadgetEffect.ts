/**
 * React hook for subscribing to typed gadget effects
 *
 * This hook allows components to respond to effects emitted by gadgets,
 * with full type safety from the GadgetSpec.
 */

import { useEffect, useRef } from 'react';
import { Gadget, TapFn, Tappable, Arrow } from 'port-graphs';

/**
 * React hook for subscribing to gadget effects with automatic cleanup.
 *
 * @example
 * ```tsx
 * const gadget = withTaps(quick(sliderProto, { value: 50, min: 0, max: 100, step: 1 }));
 *
 * function MyComponent() {
 *   useGadgetEffect(gadget, (effects) => {
 *     if ('changed' in effects) {
 *       console.log('Slider changed to:', effects.changed);
 *     }
 *   });
 *
 *   return <Slider gadget={gadget} />;
 * }
 * ```
 *
 * @param gadget - A tappable gadget
 * @param callback - Function to call when effects are emitted
 * @param deps - Optional dependency array for the effect callback
 */
export function useGadgetEffect<Step extends Arrow>(
  gadget: Gadget<Step> & Tappable<Step>,
  callback: TapFn<Step>,
  deps?: React.DependencyList
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const cleanup = gadget.tap((effect) => {
      callbackRef.current(effect);
    });
    return cleanup;
  }, [gadget, ...(deps || [])]);
}
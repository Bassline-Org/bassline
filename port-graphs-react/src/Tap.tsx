/**
 * Declarative tap component for wiring gadgets
 *
 * This component doesn't render anything - it just sets up
 * a tap connection from the current gadget using the provided handler.
 */

import { useEffect } from 'react';
import { useCurrentGadget } from './GadgetContext';
import type { Tappable } from 'port-graphs';

/**
 * Sets up a tap from the current gadget
 *
 * @example
 * // Simple tap with custom handler
 * <Tap handler={(effect) => console.log('Effect:', effect)} />
 *
 * @example
 * // Tap to another gadget using tap utilities
 * <Tap handler={tapValue(targetGadget)} />
 *
 * @example
 * // Conditional tap
 * <Tap handler={(effect) => {
 *   if (effect.changed > threshold) {
 *     alertGadget.receive(effect);
 *   }
 * }} />
 */
export function Tap<Effect = any>({
  handler,
  source,
  deps = []
}: {
  handler: (effect: Effect) => void;
  source?: Tappable<Effect>;
  deps?: React.DependencyList;
}) {
  // Use provided source or get from context
  const contextGadget = useCurrentGadget<Effect>();
  const gadget = source || contextGadget;

  if (!gadget) {
    throw new Error('Tap requires either a source prop or to be used within GadgetContext');
  }

  useEffect(() => {
    // Set up the tap
    const cleanup = gadget.tap(handler);
    return cleanup;
  }, [gadget, handler, ...deps]);

  // This component doesn't render anything
  return null;
}
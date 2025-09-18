/**
 * React hook for tapping into gadget effects
 *
 * This hook provides a clean way to tap into a gadget's effect stream,
 * with automatic cleanup on unmount or dependency changes.
 */

import { useEffect } from 'react';
import type { Tappable } from 'port-graphs';

/**
 * Creates a tap connection to a gadget's effect stream.
 * The tap is automatically cleaned up on unmount or when dependencies change.
 *
 * @param source - The tappable gadget to tap into (or undefined)
 * @param handler - Function to handle emitted effects
 * @param deps - React dependency array for the effect
 *
 * @example
 * // Simple tap to log effects
 * useTap(gadget, effect => console.log('Effect:', effect));
 *
 * @example
 * // Connect two gadgets
 * useTap(source, effect => target.receive(effect.changed));
 *
 * @example
 * // Conditional routing
 * useTap(source, effect => {
 *   if (effect.type === 'error') errorGadget.receive(effect);
 *   else successGadget.receive(effect);
 * });
 */
export function useTap<Effect>(
  source: Tappable<any, any, Effect> | undefined,
  handler: (effect: Effect) => void,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    // Handle undefined source gracefully
    if (!source?.tap) return;

    // Create the tap and get cleanup function
    const cleanup = source.tap(handler);

    // Return cleanup for React to call
    return cleanup;
  }, [source, ...deps]);
}

/**
 * Creates multiple taps from a single source.
 * Useful for broadcasting to multiple targets.
 *
 * @param source - The tappable gadget to tap into
 * @param handlers - Array of handler functions
 * @param deps - React dependency array
 *
 * @example
 * useTaps(source, [
 *   effect => logger.receive(effect),
 *   effect => storage.receive(effect),
 *   effect => metrics.receive(effect)
 * ]);
 */
export function useTaps<Effect>(
  source: Tappable<any, any, Effect> | undefined,
  handlers: Array<(effect: Effect) => void>,
  deps: React.DependencyList = []
): void {
  useEffect(() => {
    if (!source?.tap) return;

    // Create all taps and collect cleanup functions
    const cleanups = handlers.map(handler => source.tap(handler));

    // Return cleanup that calls all cleanup functions
    return () => {
      cleanups.forEach(cleanup => cleanup());
    };
  }, [source, ...handlers, ...deps]);
}

/**
 * Creates a bidirectional tap connection between two gadgets.
 * Each gadget taps into the other's effects.
 *
 * @param gadgetA - First tappable gadget
 * @param gadgetB - Second tappable gadget
 * @param transformAtoB - Optional transform for A's effects going to B
 * @param transformBtoA - Optional transform for B's effects going to A
 *
 * @example
 * // Simple bidirectional connection
 * useBidirectionalTap(gadgetA, gadgetB);
 *
 * @example
 * // With transformations
 * useBidirectionalTap(
 *   gadgetA,
 *   gadgetB,
 *   effect => ({ fromA: effect }),
 *   effect => ({ fromB: effect })
 * );
 */
export function useBidirectionalTap<EffectA, EffectB, IncomingA, IncomingB>(
  gadgetA: Tappable<any, IncomingA, EffectA> | undefined,
  gadgetB: Tappable<any, IncomingB, EffectB> | undefined,
  transformAtoB?: (effect: EffectA) => IncomingB,
  transformBtoA?: (effect: EffectB) => IncomingA
): void {
  // A → B tap
  useTap(gadgetA, (effect) => {
    if (gadgetB) {
      const data = transformAtoB ? transformAtoB(effect) : effect as any;
      gadgetB.receive(data);
    }
  }, [gadgetB, transformAtoB]);

  // B → A tap
  useTap(gadgetB, (effect) => {
    if (gadgetA) {
      const data = transformBtoA ? transformBtoA(effect) : effect as any;
      gadgetA.receive(data);
    }
  }, [gadgetA, transformBtoA]);
}

import React from 'react';
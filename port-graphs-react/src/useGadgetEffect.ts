/**
 * React hook for handling gadget effects/emissions
 *
 * This hook intercepts gadget emissions and converts them to React-friendly callbacks,
 * allowing React components to respond to gadget effects idiomatically.
 */

import { useEffect, useRef } from 'react';
import type { Gadget } from 'port-graphs';

export type EffectHandler<Effect> = (effect: Effect) => void;

/**
 * Intercepts emissions from a gadget and handles them in React
 * Note: This requires using useGadgetWithRef to get the gadget reference
 *
 * @param gadget - The gadget whose emissions to handle
 * @param handler - Callback function to handle emissions
 * @param deps - React dependency array for the handler
 */
export function useGadgetEffect<State = any, Incoming = any, Effect = any>(
  gadget: Gadget<State, Incoming, Effect> | undefined,
  handler: EffectHandler<Effect>,
  deps: React.DependencyList = []
): void {
  const handlerRef = useRef<EffectHandler<Effect>>(handler);

  // Keep handler ref updated
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler, ...deps]);

  useEffect(() => {
    if (!gadget) return;

    // Store original emit
    const originalEmit = gadget.emit;

    // Override emit to intercept effects
    gadget.emit = (effect: Effect) => {
      // Call original emit first (in case there are other listeners)
      originalEmit.call(gadget, effect);
      // Then call our handler
      handlerRef.current(effect);
    };

    // Cleanup: restore original emit
    return () => {
      gadget.emit = originalEmit;
    };
  }, [gadget]);
}

/**
 * Variant that collects all emissions into an array
 * Useful for debugging or displaying a log of effects
 */
export function useGadgetEmissions<State = any, Incoming = any, Effect = any>(
  gadget: Gadget<State, Incoming, Effect> | undefined,
  maxSize: number = 100
): Effect[] {
  const [emissions, setEmissions] = React.useState<Effect[]>([]);

  useGadgetEffect(
    gadget,
    (effect) => {
      setEmissions(prev => {
        const newEmissions = [...prev, effect];
        // Keep only last maxSize emissions
        return newEmissions.slice(-maxSize);
      });
    },
    []
  );

  return emissions;
}

/**
 * Helper to connect two gadgets where one's emissions feed into another's receive
 * This is useful for wiring gadgets together in React components
 */
export function useGadgetConnection<
  StateA = any,
  IncomingA = any,
  EffectA = any,
  StateB = any,
  IncomingB = any,
  EffectB = any
>(
  source: Gadget<StateA, IncomingA, EffectA> | undefined,
  target: Gadget<StateB, IncomingB, EffectB> | undefined,
  transform?: (effect: EffectA) => IncomingB | null
): void {
  useGadgetEffect(
    source,
    (effect) => {
      if (!target) return;

      if (transform) {
        const data = transform(effect);
        if (data !== null) {
          target.receive(data);
        }
      } else {
        // If no transform, pass effect directly as incoming data
        target.receive(effect as any);
      }
    },
    [target, transform]
  );
}

// Fix missing import
import * as React from 'react';
/**
 * Composable tap utility functions for working with gadget effects
 *
 * These functions create handlers that can be used with gadget.tap()
 * or the useTap React hook. They transform effects and route them
 * to target gadgets.
 */

import { Gadget } from './core';

/**
 * Extract value from changed effect and send to target
 * @example
 * source.tap(tapValue(target));
 */
export const tapValue = <T>(target: Gadget<any, T, any>, key?: string) =>
  (effect: any) => {
    if (effect?.changed !== undefined) {
      if (key) {
        target.receive({ [key]: effect.changed } as T);
      } else {
        target.receive(effect.changed);
      }
    }
  };

/**
 * Transform value before sending to target
 * @example
 * source.tap(tapTransform(target, x => x * 2));
 */
export const tapTransform = <T, U>(
  target: Gadget<any, U, any>,
  transform: (value: T) => U
) =>
  (effect: any) => {
    if (effect?.changed !== undefined) {
      target.receive(transform(effect.changed));
    }
  };

/**
 * Filter values based on predicate
 * @example
 * source.tap(tapFilter(target, x => x > 0));
 */
export const tapFilter = <T>(
  target: Gadget<any, T, any>,
  predicate: (value: T) => boolean
) =>
  (effect: any) => {
    if (effect?.changed !== undefined && predicate(effect.changed)) {
      target.receive(effect.changed);
    }
  };

/**
 * Map value to a named argument for function gadgets
 * @example
 * source.tap(tapTo(adder, 'a')); // Sends {a: value}
 */
export const tapTo = <T>(
  target: Gadget<any, any, any>,
  key: string
) =>
  (effect: any) => {
    if (effect?.changed !== undefined) {
      target.receive({ [key]: effect.changed });
    }
  };

/**
 * Combine multiple tap functions
 * @example
 * source.tap(tapAll([
 *   tapValue(display),
 *   tapTransform(doubled, x => x * 2)
 * ]));
 */
export const tapAll = (handlers: Array<(effect: any) => void>) =>
  (effect: any) => {
    handlers.forEach(handler => handler(effect));
  };

/**
 * Conditional routing based on effect content
 * @example
 * source.tap(tapRoute({
 *   error: errorGadget,
 *   success: successGadget
 * }));
 */
export const tapRoute = (routes: Record<string, Gadget>) =>
  (effect: any) => {
    if (!effect) return;

    // Route based on effect type
    Object.keys(routes).forEach(key => {
      if (effect[key] !== undefined) {
        const target = routes[key];
        if (target) {
          target.receive(effect[key]);
        }
      }
    });
  };

/**
 * Debug tap that logs effects
 * @example
 * source.tap(tapDebug('MyGadget'));
 */
export const tapDebug = (label?: string) =>
  (effect: any) => {
    console.log(`[${label || 'tap'}]:`, effect);
  };

/**
 * Compose tap functions in sequence
 * Each function can transform the effect for the next
 * @example
 * source.tap(tapPipe(
 *   (e) => ({ ...e, timestamp: Date.now() }),
 *   tapValue(logger)
 * ));
 */
export const tapPipe = (...fns: Array<(effect: any) => any>) =>
  (effect: any) => {
    fns.reduce((acc, fn) => {
      const result = fn(acc);
      // If function returns undefined, pass through the original
      return result !== undefined ? result : acc;
    }, effect);
  };

/**
 * Throttle tap to limit frequency
 * @example
 * source.tap(tapThrottle(tapValue(target), 100)); // Max once per 100ms
 */
export const tapThrottle = (
  handler: (effect: any) => void,
  delayMs: number
) => {
  let lastCall = 0;
  return (effect: any) => {
    const now = Date.now();
    if (now - lastCall >= delayMs) {
      lastCall = now;
      handler(effect);
    }
  };
};

/**
 * Debounce tap to delay until quiet
 * @example
 * source.tap(tapDebounce(tapValue(target), 300)); // Wait 300ms after last
 */
export const tapDebounce = (
  handler: (effect: any) => void,
  delayMs: number
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  return (effect: any) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      handler(effect);
      timeoutId = null;
    }, delayMs);
  };
};
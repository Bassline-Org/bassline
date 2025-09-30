/**
 * React hook for using NEW system gadgets with automatic state management
 */

import { useMemo, useSyncExternalStore, useState } from 'react';
import { realize, reactStore, withTaps, StateOf, InputOf, Arrow, Tappable, Gadget } from 'port-graphs';

/**
 * React hook for using gadgets with React state management.
 *
 * Accepts a gadget created with quick() or realize() and subscribes to its state changes.
 *
 * @example
 * ```tsx
 * const gadget = withTaps(quick(sliderProto, { value: 50, min: 0, max: 100, step: 1 }));
 * const [state, send] = useGadget(gadget);
 * ```
 *
 * @param gadget - A gadget (ideally tappable)
 * @returns Tuple of [state, send function]
 */
export function useGadget<Step extends Arrow>(
  gadget: Gadget<Step> & Tappable<Step>
): readonly [StateOf<Step>, (input: InputOf<Step>) => void] {
  // Create listener set for React subscriptions
  const [listeners] = useState(() => new Set<() => void>());

  // Subscribe to gadget state changes using useSyncExternalStore
  const state = useSyncExternalStore(
    (onStoreChange) => {
      // Add React's change handler to our listener set
      listeners.add(onStoreChange);

      // Subscribe to gadget effects - when gadget emits, notify React
      const cleanup = gadget.tap(() => {
        listeners.forEach(fn => fn());
      });

      return () => {
        listeners.delete(onStoreChange);
        cleanup();
      };
    },
    () => gadget.current()
  );

  return [state, gadget.receive.bind(gadget)] as const;
}
/**
 * React hook for using NEW system proto-gadgets with automatic state management
 */

import { useMemo, useSyncExternalStore, useState } from 'react';
import { ProtoGadget, realize, reactStore, withTaps, StateOf, InputOf, Arrow, Tappable, Gadget } from 'port-graphs';

/**
 * React hook for creating and using gadgets with React state management.
 *
 * Creates a gadget using reactStore which directly triggers React re-renders on state updates.
 *
 * @example
 * ```tsx
 * const [state, send] = useGadget(sliderProto, { value: 50, min: 0, max: 100, step: 1 });
 * ```
 *
 * @param proto - A proto-gadget with step and handler
 * @param initialState - Initial state value
 * @returns Tuple of [state, send function]
 */
export function useGadget<Step extends Arrow>(
  proto: ProtoGadget<Step>,
  initialState: StateOf<Step>
): readonly [StateOf<Step>, (input: InputOf<Step>) => void, Gadget<Step> & Tappable<Step>] {
  // Create listener set for React subscriptions
  const [listeners] = useState(() => new Set<() => void>());

  // Create notify callback that broadcasts to all listeners
  const notify = useMemo(() => () => {
    listeners.forEach(fn => fn());
  }, [listeners]);

  // Create gadget with React-aware store (only once)
  const gadget = useMemo(() => {
    const store = reactStore(initialState, notify);
    const realized = realize(proto, store);
    return withTaps(realized);
  }, [proto, initialState, notify]);

  // Subscribe to gadget state changes using useSyncExternalStore
  const state = useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => gadget.current()
  );

  return [state, (input: InputOf<Step>) => { gadget.receive(input) }, gadget] as const;
}
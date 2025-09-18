/**
 * React hook for integrating gadgets with React state management
 *
 * This hook creates a bridge between the gadget protocol and React's state system,
 * making React's state the single source of truth while preserving gadget behavior.
 * All gadgets are automatically made tappable for easy connections.
 */

import { useRef, useState, useCallback } from 'react';
import { replaceSemantics, type Gadget, withTaps, type Tappable } from 'port-graphs';

/**
 * Creates a React-aware gadget that uses React state as its source of truth
 * and is automatically tappable for connections.
 *
 * @param factory - Function that creates a gadget with initial state
 * @param initial - Initial state for both React and the gadget
 * @returns Tuple of [currentState, send, tappableGadget]
 */
export function useGadget<State, Incoming = any, Effect = any>(
  factory: (initial: State) => Gadget<State, Incoming, Effect>,
  initial: State
): readonly [State, (data: Incoming) => void, Tappable<State, Incoming, Effect>] {
  const gadgetRef = useRef<Tappable<State, Incoming, Effect>>();
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef<State>(state);

  // Create and configure the gadget once
  if (!gadgetRef.current) {
    const gadget = factory(initial);
    // Make it tappable first
    const tappable = withTaps(gadget);
    // Then replace state management with React state
    const replaced = replaceSemantics(tappable, {
      emit: tappable.emit, // Keep the tappable emit
      current: () => stateRef.current,
      update: (newState) => {
        setState(newState);
        stateRef.current = newState;
      },
    }) as Tappable<State, Incoming, Effect>;
    gadgetRef.current = replaced;
    stateRef.current = initial;
  }

  const send = useCallback((data: Incoming) => {
    gadgetRef.current!.receive(data);
  }, []);

  return [state, send, gadgetRef.current!] as const;
}
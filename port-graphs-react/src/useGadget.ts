/**
 * React hook for integrating gadgets with React state management
 *
 * This hook creates a bridge between the gadget protocol and React's state system,
 * making React's state the single source of truth while preserving gadget behavior.
 * All gadgets are automatically made tappable for easy connections.
 */

import { useRef, useState, useCallback } from 'react';
import type React from 'react';
import { replaceSemantics, type Gadget, withTaps, type Tappable } from 'port-graphs';

/**
 * Creates a React-aware gadget that uses React state as its source of truth
 * and is automatically tappable for connections.
 *
 * @param gadget - A gadget instance to connect to React state
 * @returns Tuple of [currentState, send, tappableGadget]
 */

export type ReactExtension = {
  reactExtensionSetup: true;
  reactStateRef?: React.MutableRefObject<any>;
}

export function useGadget<State, Incoming = any, Effect = any>(
  gadget: Gadget<State, Incoming, Effect>
): readonly [State, (data: Incoming) => void, Tappable<State, Incoming, Effect>] {
  const gadgetRef = useRef<Tappable<State, Incoming, Effect> & ReactExtension>();
  const [state, setState] = useState<State>(gadget.current());
  const stateRef = useRef<State>(state);

  // Configure the gadget once, or reuse if already configured
  if (!gadgetRef.current) {
    // Check if gadget is already React-extended
    const extended = gadget as any as ReactExtension;
    if (extended.reactExtensionSetup) {
      // Reuse the existing React-extended gadget
      gadgetRef.current = gadget as Tappable<State, Incoming, Effect> & ReactExtension;
      // Sync with existing state
      if (extended.reactStateRef) {
        setState(extended.reactStateRef.current);
        stateRef.current = extended.reactStateRef.current;
      }
    } else {
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
      }) as Tappable<State, Incoming, Effect> & ReactExtension;
      replaced.reactExtensionSetup = true;
      replaced.reactStateRef = stateRef;
      gadgetRef.current = replaced;
    }
  }

  const send = useCallback((data: Incoming) => {
    gadgetRef.current!.receive(data);
  }, []);

  return [state, send, gadgetRef.current!] as const;
}
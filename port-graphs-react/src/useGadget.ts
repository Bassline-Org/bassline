/**
 * React hook for integrating gadgets with React state management
 *
 * This hook creates a bridge between the gadget protocol and React's state system,
 * making React's state the single source of truth while preserving gadget behavior.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Gadget } from '../../port-graphs/dist/core';

export type GadgetFactory<State, Incoming, Effect> =
  (initial: State) => Gadget<State, Incoming, Effect>;

/**
 * Creates a React-aware gadget that uses React state as its source of truth
 *
 * @param factory - Function that creates a gadget with initial state
 * @param initialState - Initial state for both React and the gadget
 * @returns Tuple of [currentState, send] where send passes data to gadget.receive
 */
export function useGadget<State, Incoming = any, Effect = any>(
  factory: GadgetFactory<State, Incoming, Effect>,
  initialState: State
): [State, (data: Incoming) => void] {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef<State>(state);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Create gadget once, immediately (not in effect)
  const gadgetRef = useRef<Gadget<State, Incoming, Effect>>();

  if (!gadgetRef.current) {
    const gadget = factory(initialState);

    // Store original methods
    const originalUpdate = gadget.update;

    // Override update to use React's setState
    gadget.update = (newState: State) => {
      // Call original update for any internal bookkeeping
      originalUpdate.call(gadget, newState);
      // Update React state
      setState(newState);
      // Update ref immediately for current() calls
      stateRef.current = newState;
    };

    // Override current to read from React state ref
    // We use a ref here because current() might be called during computation
    // where we need the most recent value immediately
    gadget.current = () => stateRef.current;

    gadgetRef.current = gadget;
  }

  // Stable send function
  const send = useCallback((data: Incoming) => {
    gadgetRef.current?.receive(data);
  }, []);

  return [state, send];
}

/**
 * Advanced hook that also exposes the gadget for wiring
 * Use this when you need to connect gadgets together
 */
export function useGadgetWithRef<State, Incoming = any, Effect = any>(
  factory: GadgetFactory<State, Incoming, Effect>,
  initialState: State
): [State, (data: Incoming) => void, Gadget<State, Incoming, Effect>] {
  const [state, setState] = useState<State>(initialState);
  const stateRef = useRef<State>(state);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Create gadget once, immediately (not in effect)
  const gadgetRef = useRef<Gadget<State, Incoming, Effect>>();

  if (!gadgetRef.current) {
    const gadget = factory(initialState);

    // Store original methods
    const originalUpdate = gadget.update;

    // Override update to use React's setState
    gadget.update = (newState: State) => {
      // Call original update for any internal bookkeeping
      originalUpdate.call(gadget, newState);
      // Update React state
      setState(newState);
      // Update ref immediately for current() calls
      stateRef.current = newState;
    };

    // Override current to read from React state ref
    gadget.current = () => stateRef.current;

    gadgetRef.current = gadget;
  }

  // Stable send function
  const send = useCallback((data: Incoming) => {
    gadgetRef.current?.receive(data);
  }, []);

  return [state, send, gadgetRef.current!];
}
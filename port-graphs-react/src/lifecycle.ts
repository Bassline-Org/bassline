import { useEffect, useRef, useCallback } from 'react';
import { Gadget } from 'port-graphs';

/**
 * Lifecycle management utilities for React + Gadget integration
 */

/**
 * Automatically cleanup gadget connections on unmount
 */
export function useGadgetCleanup<G extends Gadget>(
  gadget: G,
  setup: (gadget: G) => (() => void) | void
): void {
  useEffect(() => {
    const cleanup = setup(gadget);
    return () => {
      if (cleanup) cleanup();
    };
  }, [gadget, setup]);
}

/**
 * Batch multiple gadget updates into a single render
 */
export function useBatchedGadget<State, Incoming, Effect>(
  factory: (initial: State) => Gadget<State, Incoming, Effect>,
  initial: State,
  batchDelay: number = 0
): readonly [State, (data: Incoming) => void, Gadget<State, Incoming, Effect>] {
  const [state, setState] = React.useState<State>(initial);
  const gadgetRef = useRef<Gadget<State, Incoming, Effect>>();
  const batchTimeoutRef = useRef<NodeJS.Timeout>();
  const pendingUpdates = useRef<State[]>([]);

  // Create gadget with batched state updates
  if (!gadgetRef.current) {
    const gadget = factory(initial);
    const originalUpdate = gadget.update;

    gadget.update = (newState: State) => {
      originalUpdate.call(gadget, newState);
      pendingUpdates.current.push(newState);

      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      batchTimeoutRef.current = setTimeout(() => {
        const latestState = pendingUpdates.current[pendingUpdates.current.length - 1];
        pendingUpdates.current = [];
        setState(latestState);
      }, batchDelay);
    };

    gadgetRef.current = gadget;
  }

  const send = useCallback((data: Incoming) => {
    gadgetRef.current!.receive(data);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, []);

  return [state, send, gadgetRef.current!] as const;
}

/**
 * Debug hook for inspecting gadget state and effects
 */
export function useGadgetDebug<State, Incoming, Effect>(
  name: string,
  gadget: Gadget<State, Incoming, Effect>,
  options: {
    logState?: boolean;
    logEffects?: boolean;
    logReceive?: boolean;
  } = {}
): void {
  const { logState = true, logEffects = true, logReceive = true } = options;

  useEffect(() => {
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
      const originalEmit = gadget.emit;
      const originalReceive = gadget.receive;
      const originalUpdate = gadget.update;

      if (logEffects) {
        gadget.emit = (effect: Effect) => {
          console.log(`[${name}] emit:`, effect);
          originalEmit.call(gadget, effect);
        };
      }

      if (logReceive) {
        gadget.receive = (data: Incoming) => {
          console.log(`[${name}] receive:`, data);
          originalReceive.call(gadget, data);
        };
      }

      if (logState) {
        gadget.update = (state: State) => {
          console.log(`[${name}] update:`, state);
          originalUpdate.call(gadget, state);
        };
      }

      return () => {
        gadget.emit = originalEmit;
        gadget.receive = originalReceive;
        gadget.update = originalUpdate;
      };
    }
  }, [name, gadget, logState, logEffects, logReceive]);
}

/**
 * Create a managed gadget with lifecycle hooks
 */
export function useManagedGadget<State, Incoming, Effect>(
  factory: (initial: State) => Gadget<State, Incoming, Effect>,
  initial: State,
  options: {
    onMount?: (gadget: Gadget<State, Incoming, Effect>) => void;
    onUnmount?: (gadget: Gadget<State, Incoming, Effect>) => void;
    onStateChange?: (state: State) => void;
    onEffect?: (effect: Effect) => void;
  } = {}
): readonly [State, (data: Incoming) => void, Gadget<State, Incoming, Effect>] {
  const [state, setState] = React.useState<State>(initial);
  const gadgetRef = useRef<Gadget<State, Incoming, Effect>>();
  const { onMount, onUnmount, onStateChange, onEffect } = options;

  // Create gadget with lifecycle hooks
  if (!gadgetRef.current) {
    const gadget = factory(initial);
    const originalUpdate = gadget.update;
    const originalEmit = gadget.emit;

    if (onStateChange) {
      gadget.update = (newState: State) => {
        originalUpdate.call(gadget, newState);
        setState(newState);
        onStateChange(newState);
      };
    } else {
      gadget.update = (newState: State) => {
        originalUpdate.call(gadget, newState);
        setState(newState);
      };
    }

    if (onEffect) {
      gadget.emit = (effect: Effect) => {
        originalEmit.call(gadget, effect);
        onEffect(effect);
      };
    }

    gadgetRef.current = gadget;
  }

  const send = useCallback((data: Incoming) => {
    gadgetRef.current!.receive(data);
  }, []);

  // Lifecycle effects
  useEffect(() => {
    const gadget = gadgetRef.current!;
    if (onMount) {
      onMount(gadget);
    }
    return () => {
      if (onUnmount) {
        onUnmount(gadget);
      }
    };
  }, []);

  return [state, send, gadgetRef.current!] as const;
}

import React from 'react';
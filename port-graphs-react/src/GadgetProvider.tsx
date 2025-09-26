/**
 * Global state management for typed gadgets in React
 *
 * This provider maintains a registry of all gadgets and their React state,
 * ensuring each gadget is wrapped exactly once and all components share
 * the same state for a given gadget.
 */

import React, { createContext, useContext, useRef, useSyncExternalStore, useCallback } from 'react';
import { Tappable, Gadget, withTaps, State, Input, StateOf, InputOf } from 'port-graphs';

// Registry entry for a typed gadget with its spec
type GadgetEntry<S, G extends Gadget<S> = Gadget<S>> = {
  gadget: G;
  listeners: Set<() => void>;
  state: StateOf<S>;
};

// Map from gadget instances to their entries
// We use WeakMap for better memory management
type GadgetRegistry<S, G extends Gadget<S> = Gadget<S>> = WeakMap<G, GadgetEntry<S, G>>;

type GadgetContextValue<S, G extends Gadget<S> = Gadget<S>> = {
  registry: GadgetRegistry<S, G>;
};

const GadgetContext = createContext<GadgetContextValue<any> | null>(null);

export function useGadgetContext<S>() {
  const context = useContext(GadgetContext) as GadgetContextValue<S>;
  if (!context) {
    throw new Error('useGadget must be used within a GadgetProvider');
  }
  return context;
}

/**
 * Provides global gadget state management for all child components
 */
export function GadgetProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<GadgetRegistry<unknown>>(new WeakMap());

  const contextValue: GadgetContextValue<unknown> = {
    registry: registryRef.current
  };

  return (
    <GadgetContext.Provider value={contextValue}>
      {children}
    </GadgetContext.Provider>
  );
}

/**
 * Internal hook used by useGadget to get or create state for a typed gadget
 *
 * This hook ensures proper type inference from the gadget's spec
 */
export function useGadgetFromProvider<S, G extends Gadget<S> = Gadget<S>>(
  gadget: G
): readonly [
  StateOf<S>,
  (data: InputOf<S>) => void,
  G & Tappable<S>
] {
  const { registry } = useGadgetContext<S>();

  // Get or create the registry entry for this gadget
  let entry = registry.get(gadget);

  if (!entry) {
    // First time seeing this gadget - wrap it with tap
    const tappableGadget = withTaps(gadget);

    // Create the entry with initial state and proper typing
    entry = {
      gadget: tappableGadget,
      listeners: new Set<() => void>(),
      state: gadget.current()
    };

    // Override the update method to track state changes
    gadget.update = (newState: S extends State<infer St> ? St : never) => {
      const currentEntry = registry.get(gadget);
      if (currentEntry) {
        currentEntry.state = newState;
        // Notify all listeners that state has changed
        currentEntry.listeners.forEach(listener => listener());
      }
    };
    gadget.current = () => {
      const currentEntry = registry.get(gadget)!;
      return currentEntry.state;
    };

    // Store in registry with proper type
    registry.set(gadget, entry);
  }

  // Use useSyncExternalStore for React 18+ concurrent features
  const state = useSyncExternalStore<S extends State<infer St> ? St : never>(
    // Subscribe
    (onStoreChange) => {
      entry.listeners.add(onStoreChange);
      return () => {
        entry.listeners.delete(onStoreChange);
      };
    },
    // Get snapshot - returns the exact state type
    () => entry.state,
    // Get server snapshot (for SSR)
    () => entry.state
  );

  // Create send function with proper input type
  const send = useCallback((data: S extends Input<infer I> ? I : never) => {
    entry.gadget.receive(data);
  }, [entry]);

  return [state, send, entry.gadget as G & Tappable<S>] as const;
}
/**
 * Global state management for gadgets in React
 *
 * This provider maintains a registry of all gadgets and their React state,
 * ensuring each gadget is wrapped exactly once and all components share
 * the same state for a given gadget.
 */

import React, { createContext, useContext, useRef, useSyncExternalStore, useCallback } from 'react';
import { Gadget, replaceSemantics, withTaps, type Tappable } from 'port-graphs';

type GadgetEntry<State, Incoming, Effect> = {
  tappable: Tappable<State, Incoming, Effect>;
  listeners: Set<() => void>;
  state: State;
};

type GadgetRegistry = Map<Gadget, GadgetEntry<any, any, any>>;

type GadgetContextValue = {
  registry: GadgetRegistry;
};

const GadgetContext = createContext<GadgetContextValue | null>(null);

export function useGadgetContext() {
  const context = useContext(GadgetContext);
  if (!context) {
    throw new Error('useGadget must be used within a GadgetProvider');
  }
  return context;
}

/**
 * Provides global gadget state management for all child components
 */
export function GadgetProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<GadgetRegistry>(new Map());

  const contextValue: GadgetContextValue = {
    registry: registryRef.current
  };

  return (
    <GadgetContext.Provider value={contextValue}>
      {children}
    </GadgetContext.Provider>
  );
}

/**
 * Internal hook used by useGadget to get or create state for a gadget
 */
export function useGadgetFromProvider<State, Incoming, Effect>(
  gadget: Gadget<State, Incoming, Effect>
): readonly [State, (data: Incoming) => void, Tappable<State, Incoming, Effect>] {
  const { registry } = useGadgetContext();

  // Get or create the registry entry for this gadget
  let entry = registry.get(gadget) as GadgetEntry<State, Incoming, Effect> | undefined;

  if (!entry) {
    // First time seeing this gadget - wrap it
    const tappable = withTaps(gadget);

    // Create the entry with initial state
    entry = {
      tappable,
      listeners: new Set(),
      state: gadget.current()
    };

    // Replace semantics to track state changes
    replaceSemantics(tappable, {
      emit: tappable.emit,
      current: () => entry!.state,
      update: (newState: State) => {
        entry!.state = newState;
        // Notify all listeners
        entry!.listeners.forEach(listener => listener());
      }
    });

    registry.set(gadget, entry);
  }

  const finalEntry = entry;

  // Use useSyncExternalStore for React 18+ concurrent features
  const state = useSyncExternalStore(
    // Subscribe
    (onStoreChange) => {
      finalEntry.listeners.add(onStoreChange);
      return () => {
        finalEntry.listeners.delete(onStoreChange);
      };
    },
    // Get snapshot
    () => finalEntry.state,
    // Get server snapshot (for SSR)
    () => finalEntry.state
  );

  const send = useCallback((data: Incoming) => {
    finalEntry.tappable.receive(data);
  }, [finalEntry]);

  return [state, send, finalEntry.tappable] as const;
}
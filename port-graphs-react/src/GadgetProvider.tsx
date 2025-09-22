/**
 * Global state management for typed gadgets in React
 *
 * This provider maintains a registry of all gadgets and their React state,
 * ensuring each gadget is wrapped exactly once and all components share
 * the same state for a given gadget.
 */

import React, { createContext, useContext, useRef, useSyncExternalStore, useCallback } from 'react';
import { ExtractSpec, Tappable, type TypedGadget, withTaps } from 'port-graphs';

// Registry entry for a typed gadget with its spec
type GadgetEntry<G, Spec extends ExtractSpec<G>> = {
  gadget: G;
  listeners: Set<() => void>;
  state: Spec['state'];
};

// Map from gadget instances to their entries
// We use WeakMap for better memory management
type GadgetRegistry<G extends TypedGadget<any> = TypedGadget, Spec extends ExtractSpec<G> = ExtractSpec<G>> = WeakMap<G, GadgetEntry<G, Spec>>;

type GadgetContextValue<G extends TypedGadget<any>, Spec extends ExtractSpec<G> = ExtractSpec<G>> = {
  registry: GadgetRegistry<G, Spec>;
};

const GadgetContext = createContext<GadgetContextValue<TypedGadget<any>> | null>(null);

export function useGadgetContext<G extends TypedGadget<any>, Spec extends ExtractSpec<G> = ExtractSpec<G>>() {
  const context = useContext(GadgetContext) as GadgetContextValue<G, Spec>;
  if (!context) {
    throw new Error('useGadget must be used within a GadgetProvider');
  }
  return context;
}

/**
 * Provides global gadget state management for all child components
 */
export function GadgetProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<GadgetRegistry<TypedGadget>>(new WeakMap());

  const contextValue: GadgetContextValue<TypedGadget> = {
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
export function useGadgetFromProvider<G extends TypedGadget<any>, Spec extends ExtractSpec<G>>(
  gadget: G
): readonly [
  Spec['state'],
  (data: Spec['input']) => void,
  G & Tappable<Spec['effects']>
] {
  const { registry } = useGadgetContext<G>();

  // Get or create the registry entry for this gadget
  let entry = registry.get(gadget);

  if (!entry) {
    // First time seeing this gadget - wrap it with tap
    const tappableGadget = withTaps(gadget);

    // Create the entry with initial state and proper typing
    entry = {
      gadget: tappableGadget as G & Tappable<Spec['effects']>,
      listeners: new Set<() => void>(),
      state: gadget.current()
    };

    // Override the update method to track state changes
    gadget.update = (newState: Spec['state']) => {
      const currentEntry = registry.get(gadget);
      if (currentEntry) {
        currentEntry.state = newState;
        // Notify all listeners that state has changed
        currentEntry.listeners.forEach(listener => listener());
      }
    };
    gadget.current = () => {
      const currentEntry = registry.get(gadget);
      if (currentEntry) {
        return currentEntry.state;
      }
    };

    // Store in registry with proper type
    registry.set(gadget, entry);
  }

  // TypeScript knows entry is GadgetEntry<Spec> here
  const typedEntry = entry;

  // Use useSyncExternalStore for React 18+ concurrent features
  const state = useSyncExternalStore<Spec['state']>(
    // Subscribe
    (onStoreChange) => {
      typedEntry.listeners.add(onStoreChange);
      return () => {
        typedEntry.listeners.delete(onStoreChange);
      };
    },
    // Get snapshot - returns the exact state type
    () => typedEntry.state,
    // Get server snapshot (for SSR)
    () => typedEntry.state
  );

  // Create send function with proper input type
  const send = useCallback((data: Spec['input']) => {
    typedEntry.gadget.receive(data);
  }, [typedEntry]);

  return [state, send, typedEntry.gadget as G & Tappable<Spec['effects']>] as const;
}
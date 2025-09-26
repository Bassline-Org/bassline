/**
 * Context system for providing gadgets to components
 *
 * Supports two patterns:
 * 1. Current gadget - accessed via useCurrentGadget()
 * 2. Named gadgets - registered with ProvideGadget and accessed via useExplicitGadget(name)
 */

import React, { createContext, useContext, useState } from 'react';
import type { Tappable, Gadget } from 'port-graphs';

// Context for the current gadget
type CurrentGadget<S, G extends Gadget<S> & Tappable<S> = Gadget<S> & Tappable<S>> = G | null;
const CurrentGadgetContext = createContext<CurrentGadget<unknown>>(null);

// Context for named gadgets registry
type NamedGadgets<S, G extends Gadget<S> & Tappable<S> = Gadget<S> & Tappable<S>> = Map<string, G>;
const NamedGadgetsContext = createContext<NamedGadgets<unknown>>(new Map());

/**
 * Hook to access the current gadget from context
 */
export function useCurrentGadget<S, G extends Gadget<S> & Tappable<S> = Gadget<S> & Tappable<S>>() {
  const gadget = useContext(CurrentGadgetContext) as CurrentGadget<S, G>;
  if (!gadget) {
    throw new Error('useCurrentGadget must be used within a GadgetContext');
  }
  return gadget as G
}

/**
 * Hook to access a named gadget from context
 */
export function useExplicitGadget<S, G extends Gadget<S> & Tappable<S> = Gadget<S> & Tappable<S>>(
  name: string
) {
  const namedGadgets = useContext(NamedGadgetsContext) as NamedGadgets<S, G>;
  const gadget = namedGadgets.get(name);
  if (!gadget) {
    throw new Error(`No gadget found with name: ${name}. Did you forget to use ProvideGadget?`);
  }
  return gadget as G;
}

/**
 * Provides the current gadget to child components
 */
export function GadgetContext<S, G extends Gadget<S> & Tappable<S> = Gadget<S> & Tappable<S>>({
  gadget,
  children
}: {
  gadget: G;
  children: React.ReactNode;
}) {
  return (
    <CurrentGadgetContext.Provider value={gadget}>
      {children}
    </CurrentGadgetContext.Provider>
  );
}

/**
 * Registers a named gadget in the context
 */
export function ProvideGadget<S, G extends Gadget<S> & Tappable<S> = Gadget<S> & Tappable<S>>({
  name,
  gadget,
  children
}: {
  name: string;
  gadget: G;
  children?: React.ReactNode;
}) {
  const parentGadgets = useContext(NamedGadgetsContext) as NamedGadgets<S, G>;
  const [namedGadgets] = useState(() => {
    const newMap = new Map(parentGadgets);
    newMap.set(name, gadget);
    return newMap;
  });

  return (
    <NamedGadgetsContext.Provider value={namedGadgets}>
      {children}
    </NamedGadgetsContext.Provider>
  );
}
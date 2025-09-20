/**
 * Context system for providing gadgets to components
 *
 * Supports two patterns:
 * 1. Current gadget - accessed via useCurrentGadget()
 * 2. Named gadgets - registered with ProvideGadget and accessed via useExplicitGadget(name)
 */

import React, { createContext, useContext, useState } from 'react';
import type { Tappable } from 'port-graphs';

// Context for the current gadget
const CurrentGadgetContext = createContext<Tappable | null>(null);

// Context for named gadgets registry
type NamedGadgets = Map<string, Tappable>;
const NamedGadgetsContext = createContext<NamedGadgets>(new Map());

/**
 * Hook to access the current gadget from context
 */
export function useCurrentGadget<State = any, Incoming = any, Effect = any>(): Tappable<State, Incoming, Effect> {
  const gadget = useContext(CurrentGadgetContext);
  if (!gadget) {
    throw new Error('useCurrentGadget must be used within a GadgetContext');
  }
  return gadget as Tappable<State, Incoming, Effect>;
}

/**
 * Hook to access a named gadget from context
 */
export function useExplicitGadget<State = any, Incoming = any, Effect = any>(
  name: string
): Tappable<State, Incoming, Effect> {
  const namedGadgets = useContext(NamedGadgetsContext);
  const gadget = namedGadgets.get(name);
  if (!gadget) {
    throw new Error(`No gadget found with name: ${name}. Did you forget to use ProvideGadget?`);
  }
  return gadget as Tappable<State, Incoming, Effect>;
}

/**
 * Provides the current gadget to child components
 */
export function GadgetContext({
  gadget,
  children
}: {
  gadget: Tappable;
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
export function ProvideGadget({
  name,
  gadget,
  children
}: {
  name: string;
  gadget: Tappable;
  children?: React.ReactNode;
}) {
  const parentGadgets = useContext(NamedGadgetsContext);
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
import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { createPubSubSystem } from 'port-graphs/meta/routing';
import type { Gadget } from 'port-graphs';

interface PubSubContextType {
  registry: any;
  subscriptions: any;
  pubsub: any;
}

const PubSubContext = createContext<PubSubContextType | null>(null);

export interface PubSubProviderProps {
  children: ReactNode;
}

export function PubSubProvider({ children }: PubSubProviderProps) {
  const pubSubSystem = useMemo(() => createPubSubSystem(), []);

  return (
    <PubSubContext.Provider value={pubSubSystem}>
      {children}
    </PubSubContext.Provider>
  );
}

export function usePubSubContext() {
  const context = useContext(PubSubContext);
  if (!context) {
    throw new Error('usePubSubContext must be used within a PubSubProvider');
  }
  return context;
}
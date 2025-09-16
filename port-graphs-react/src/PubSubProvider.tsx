import { createContext, useContext, useMemo, ReactNode } from 'react';
import { createPubSubSystem } from 'port-graphs/meta';

interface PubSubContextType {
  registry: ReturnType<typeof createPubSubSystem>['registry'];
  subscriptions: ReturnType<typeof createPubSubSystem>['subscriptions'];
  pubsub: ReturnType<typeof createPubSubSystem>['pubsub'];
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

export function usePubSubContext(): PubSubContextType {
  const context = useContext(PubSubContext);
  if (!context) {
    throw new Error('usePubSubContext must be used within a PubSubProvider');
  }
  return context as PubSubContextType;
}
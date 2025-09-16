import { createContext, useContext, ReactNode, useCallback } from 'react';
import { pubsub } from 'port-graphs/meta';
import { Gadget } from 'port-graphs';
import { useGadget } from './useGadget';

interface TopicsContextValue {
  router: Gadget;
  publish: (topics: string[], data: any) => void;
  subscribe: (topics: string[], source: Gadget) => void;
}

const TopicsContext = createContext<TopicsContextValue | null>(null);

export interface TopicsProviderProps {
  children: ReactNode;
}

/**
 * Provides a simple topic-based routing system to child components.
 * Uses the pubsub gadget to handle routing of effects between gadgets.
 */
export function TopicsProvider({ children }: TopicsProviderProps) {
  const [, send, router] = useGadget(pubsub, {});

  const publish = useCallback((topics: string[], data: any) => {
    send({ publish: { topics, data } });
  }, [send]);

  const subscribe = useCallback((topics: string[], source: Gadget) => {
    send({ subscribe: { topics, source } });
  }, [send]);

  const value = { router, publish, subscribe };

  return (
    <TopicsContext.Provider value={value}>
      {children}
    </TopicsContext.Provider>
  );
}

export function useTopics() {
  const context = useContext(TopicsContext);
  if (!context) {
    throw new Error('useTopics must be used within a TopicsProvider');
  }
  return context;
}
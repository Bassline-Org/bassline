import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { createTopics, type Topics } from 'port-graphs/meta';

const TopicsContext = createContext<Topics | null>(null);

export interface TopicsProviderProps {
  children: ReactNode;
}

/**
 * Provides a simple topic-based routing system to child components.
 * This replaces the complex PubSubProvider with something much simpler.
 */
export function TopicsProvider({ children }: TopicsProviderProps) {
  const topics = useMemo(() => createTopics(), []);

  return (
    <TopicsContext.Provider value={topics}>
      {children}
    </TopicsContext.Provider>
  );
}

export function useTopics(): Topics {
  const context = useContext(TopicsContext);
  if (!context) {
    throw new Error('useTopics must be used within a TopicsProvider');
  }
  return context;
}
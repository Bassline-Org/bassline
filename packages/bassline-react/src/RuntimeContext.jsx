/**
 * RuntimeContext - React Context for Bassline Runtime
 *
 * Provides runtime instance to React component tree.
 */
import { createContext } from 'react';

export const RuntimeContext = createContext(null);

/**
 * RuntimeProvider - Provide runtime instance to React tree
 *
 * @param {Object} props
 * @param {Runtime} props.runtime - Bassline Runtime instance
 * @param {ReactNode} props.children
 */
export function RuntimeProvider({ runtime, children }) {
  if (!runtime) {
    throw new Error('RuntimeProvider requires a runtime instance');
  }

  return (
    <RuntimeContext.Provider value={runtime}>
      {children}
    </RuntimeContext.Provider>
  );
}

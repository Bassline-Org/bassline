/**
 * useRuntime - Access Bassline Runtime from React context
 *
 * Primary hook for interacting with Bassline from components.
 * Provides access to runtime.eval(), runtime.graph, etc.
 *
 * @returns {Runtime} The Bassline Runtime instance
 *
 * @example
 * const runtime = useRuntime();
 *
 * // Use pattern language
 * runtime.eval('insert { alice age 30 * }');
 *
 * // Or access graph directly
 * runtime.graph.add("alice", "city", "NYC", null);
 */
import { useContext } from 'react';
import { RuntimeContext } from './RuntimeContext.jsx';

export function useRuntime() {
  const runtime = useContext(RuntimeContext);

  if (!runtime) {
    throw new Error('useRuntime must be used within RuntimeProvider');
  }

  return runtime;
}

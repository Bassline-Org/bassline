import { useEffect, useRef } from 'react';
import { Gadget, Tappable } from 'port-graphs';

/**
 * React hooks for using context patterns
 */

/**
 * Create and mount a context to a source gadget
 * Handles lifecycle automatically
 */
export function useGadgetContext<S extends Gadget & Tappable, C extends Gadget>(
  source: S,
  contextFactory: () => C
): C {
  const contextRef = useRef<C>();

  // Create context once
  if (!contextRef.current) {
    contextRef.current = contextFactory();
  }

  // Mount/unmount based on source changes
  useEffect(() => {
    contextRef.current!.receive({ mount: { source } });
    return () => {
      contextRef.current!.receive({ unmount: { source } });
    };
  }, [source]);

  return contextRef.current;
}

/**
 * Connect a source to a target gadget
 * Returns the connection for inspection/debugging
 */
export function useGadgetConnection<S extends Gadget & Tappable, T extends Gadget>(
  source: S,
  target: T
): void {
  useEffect(() => {
    const cleanup = source.tap((effect) => target.receive(effect));
    return cleanup;
  }, [source, target]);
}
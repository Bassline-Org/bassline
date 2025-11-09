import { useSyncExternalStore, useMemo } from 'react';

/**
 * Subscribe to graph changes via EventTarget and get current quads.
 *
 * Uses React 18's useSyncExternalStore to subscribe to quad-added events
 * from the instrumented graph without duplicating state.
 *
 * IMPORTANT: Caches the snapshot to avoid infinite re-render loops.
 * graph.quads returns a new array each time, so we need stable references.
 *
 * @param {Graph} graph - The graph to read quads from
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @returns {Quad[]} Current array of quads from graph
 *
 * @example
 * const graph = new WatchedGraph();
 * const events = instrument(graph);
 *
 * function MyComponent() {
 *   const quads = useGraphQuads(graph, events);
 *   // Re-renders when new quads added
 * }
 */
export function useGraphQuads(graph, events) {
    // Create stable cache for this graph/events pair
    const store = useMemo(() => {
        let cachedSnapshot = graph.quads;

        return {
            subscribe: (callback) => {
                const handler = () => {
                    // Update cached snapshot when event fires
                    cachedSnapshot = graph.quads;
                    callback();
                };
                events.addEventListener('quad-added', handler);
                return () => events.removeEventListener('quad-added', handler);
            },
            getSnapshot: () => cachedSnapshot
        };
    }, [graph, events]);

    return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

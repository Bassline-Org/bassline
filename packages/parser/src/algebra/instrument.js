/**
 * Minimal graph instrumentation for visualization and debugging.
 *
 * Wraps a graph's add() method to emit events via EventTarget.
 * External consumers can listen to these events for visualization,
 * logging, streaming, etc.
 *
 * @example
 * import { WatchedGraph } from './watch.js';
 * import { instrument } from './instrument.js';
 *
 * const graph = new WatchedGraph();
 * const events = instrument(graph);
 *
 * events.addEventListener('quad-added', (e) => {
 *   console.log('Added:', e.detail);
 * });
 *
 * graph.add(quad);  // Emits 'quad-added' event
 */

/**
 * Instrument a graph to emit events on quad additions
 * @param {Graph|WatchedGraph} graph - Graph to instrument
 * @returns {EventTarget} Event emitter for quad-added events
 */
export function instrument(graph) {
    const emitter = new EventTarget();

    const originalAdd = graph.add.bind(graph);
    graph.add = function(quad) {
        emitter.dispatchEvent(new CustomEvent('quad-added', { detail: quad }));
        return originalAdd(quad);
    };

    return emitter;
}

/**
 * @bassline/parser-react
 *
 * React integration for visualizing Bassline graphs with React Flow.
 *
 * Provides hooks and components for real-time graph visualization
 * using React 18's useSyncExternalStore pattern.
 *
 * @example
 * import { WatchedGraph } from '@bassline/parser/algebra/watch';
 * import { instrument } from '@bassline/parser/algebra/instrument';
 * import { GraphVisualization } from '@bassline/parser-react';
 *
 * const graph = new WatchedGraph();
 * const events = instrument(graph);
 *
 * graph.add(q(w('alice'), w('age'), 30));
 *
 * <GraphVisualization graph={graph} events={events} />
 */

export { useGraphQuads } from './hooks/useGraphQuads.js';
export { quadsToReactFlow } from './transforms/quadsToReactFlow.js';
export { GraphVisualization } from './components/GraphVisualization.jsx';
export { QueryVisualization } from './components/QueryVisualization.jsx';

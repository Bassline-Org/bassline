/**
 * @bassline/parser-react Hooks
 *
 * Graph-native React hooks for building reactive UIs with Bassline.
 *
 * These hooks use the proper Pattern algebra from @bassline/parser
 * and subscribe to graph changes via useSyncExternalStore.
 */

// Core hooks
export { GraphProvider, useGraph, GraphContext } from './useGraph.jsx';
export { useQuery } from './useQuery.js';
export { useEntity, useEntityFull } from './useEntity.js';
export { useGraphMutation } from './useGraphMutation.js';

// Legacy hook (kept for backwards compatibility with existing code)
export { useGraphQuads } from './useGraphQuads.js';

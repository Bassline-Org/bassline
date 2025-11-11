/**
 * @bassline/parser-react Hooks
 *
 * Graph-native React hooks for building reactive UIs with Bassline.
 *
 * These hooks use the proper Pattern algebra from @bassline/parser
 * and subscribe to graph changes via useSyncExternalStore.
 */

// Core hooks
export { GraphContext, GraphProvider, useGraph } from "./useGraph.jsx";
export { useQuery } from "./useQuery.js";
export { useEntity, useEntityFull } from "./useEntity.js";

// Specialized hooks
export { useActiveRules, useRuleDetails } from "./useActiveRules.js";

// LayeredControl hooks
export {
    LayeredControlProvider,
    useLayeredControl,
    useLayer,
    useLayers,
    useRouting,
    useLayerQuads,
    useStaging,
    useCommits,
    useBranches,
} from "./useLayeredControl.jsx";

// Legacy hook (kept for backwards compatibility with existing code)
export { useGraphQuads } from "./useGraphQuads.js";

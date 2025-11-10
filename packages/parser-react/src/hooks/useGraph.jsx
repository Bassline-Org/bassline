import { createContext, useContext } from 'react';

/**
 * Context for providing the graph instance to all components
 */
export const GraphContext = createContext(null);

/**
 * Provider component that makes the graph available to all descendants
 *
 * @param {Object} props
 * @param {Graph} props.graph - The Bassline graph instance
 * @param {React.ReactNode} props.children - Child components
 *
 * @example
 * ```jsx
 * import { Graph } from '@bassline/parser/graph';
 * import { GraphProvider } from '@bassline/parser-react/hooks';
 *
 * const graph = new Graph();
 *
 * function App() {
 *   return (
 *     <GraphProvider graph={graph}>
 *       <MyComponents />
 *     </GraphProvider>
 *   );
 * }
 * ```
 */
export function GraphProvider({ graph, children }) {
    if (!graph) {
        throw new Error('GraphProvider requires a graph instance');
    }

    return (
        <GraphContext.Provider value={graph}>
            {children}
        </GraphContext.Provider>
    );
}

/**
 * Hook to access the graph instance from context
 *
 * Must be used within a GraphProvider.
 *
 * @returns {Graph} The Bassline graph instance
 * @throws {Error} If used outside GraphProvider
 *
 * @example
 * ```jsx
 * function MyComponent() {
 *   const graph = useGraph();
 *
 *   // Use graph directly
 *   const results = graph.query(['?s', '?a', '?t', '*']);
 *
 *   return <div>{results.length} quads</div>;
 * }
 * ```
 */
export function useGraph() {
    const graph = useContext(GraphContext);

    if (!graph) {
        throw new Error(
            'useGraph must be used within a GraphProvider. ' +
            'Wrap your component tree with <GraphProvider graph={graph}>.'
        );
    }

    return graph;
}

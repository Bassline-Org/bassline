import { useCallback } from 'react';
import { useGraph } from './useGraph.jsx';

/**
 * Hook for graph mutations
 *
 * Provides methods for adding quads to the graph.
 * Use the proper type constructors from @bassline/parser.
 *
 * @returns {Object} Object with mutation methods
 *
 * @example
 * ```jsx
 * import { useGraphMutation } from '@bassline/parser-react/hooks';
 * import { quad } from '@bassline/parser/algebra';
 * import { word as w } from '@bassline/parser/types';
 *
 * function AddPersonForm() {
 *   const { addQuad } = useGraphMutation();
 *
 *   const handleSubmit = () => {
 *     const q = quad(w('alice'), w('age'), 30, w('people'));
 *     addQuad(q);
 *   };
 *
 *   return <form onSubmit={handleSubmit}>...</form>;
 * }
 * ```
 */
export function useGraphMutation() {
    const graph = useGraph();

    /**
     * Add a quad to the graph
     *
     * @param {Quad} quad - Quad object created with quad() constructor
     */
    const addQuad = useCallback((quad) => {
        graph.add(quad);
    }, [graph]);

    return { addQuad };
}

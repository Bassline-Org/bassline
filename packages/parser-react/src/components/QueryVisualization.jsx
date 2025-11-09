import { useMemo, useEffect } from 'react';
import { ReactFlow, useNodesState, useEdgesState, Controls, Background } from '@xyflow/react';
import { useGraphQuads } from '../hooks/useGraphQuads.js';
import { quadsToReactFlow } from '../transforms/quadsToReactFlow.js';
import '@xyflow/react/dist/style.css';

/**
 * Visualize query results as a React Flow diagram
 *
 * Shows only the quads that matched the query pattern.
 * Automatically updates as new matching quads are added.
 *
 * @param {Graph} graph - The graph to visualize
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @param {Match[]} queryResults - Array of Match objects from matchGraph()
 *
 * @example
 * const graph = new WatchedGraph();
 * const events = instrument(graph);
 *
 * graph.add(q(w('alice'), w('age'), 30, w('ctx1')));
 * graph.add(q(w('bob'), w('age'), 25, w('ctx1')));
 *
 * const pattern = pattern(patternQuad(v('person'), w('age'), v('age'), WC));
 * const results = matchGraph(graph, pattern);
 *
 * <QueryVisualization graph={graph} events={events} queryResults={results} />
 */
export function QueryVisualization({ graph, events, queryResults }) {
    // Subscribe to graph changes via useSyncExternalStore
    const quads = useGraphQuads(graph, events);

    // Extract quad hashes from query results
    const matchedHashes = useMemo(() => {
        const hashes = new Set();
        for (const match of queryResults) {
            for (const quad of match.quads) {
                hashes.add(quad.hash());
            }
        }
        return hashes;
    }, [queryResults]);

    // Filter quads to only show matched ones
    const filteredQuads = useMemo(() =>
        quads.filter(quad => matchedHashes.has(quad.hash())),
        [quads, matchedHashes]
    );

    // Transform to React Flow format
    const { nodes, edges } = useMemo(() =>
        quadsToReactFlow(filteredQuads),
        [filteredQuads]
    );

    // React Flow state management
    const [rfNodes, setNodes, onNodesChange] = useNodesState(nodes);
    const [rfEdges, setEdges, onEdgesChange] = useEdgesState(edges);

    // Sync React Flow state when quads change
    useEffect(() => {
        setNodes(nodes);
        setEdges(edges);
    }, [nodes, edges, setNodes, setEdges]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                fitView
            >
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
}

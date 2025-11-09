import { useMemo, useEffect } from 'react';
import { ReactFlow, useNodesState, useEdgesState, Controls, Background } from '@xyflow/react';
import { useGraphQuads } from '../hooks/useGraphQuads.js';
import { quadsToReactFlow } from '../transforms/quadsToReactFlow.js';
import { serialize } from '@bassline/parser/types';
import '@xyflow/react/dist/style.css';

/**
 * Visualize the entire graph as a React Flow diagram
 *
 * Automatically updates when new quads are added to the instrumented graph.
 * Uses useSyncExternalStore to subscribe efficiently without state duplication.
 *
 * @param {Graph} graph - The graph to visualize
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @param {string} [filterContext] - Optional: only show quads from this context
 *
 * @example
 * const graph = new WatchedGraph();
 * const events = instrument(graph);
 *
 * graph.add(q(w('alice'), w('age'), 30, w('ctx1')));
 * graph.add(q(w('alice'), w('friend'), w('bob'), w('ctx1')));
 *
 * <GraphVisualization graph={graph} events={events} />
 */
export function GraphVisualization({ graph, events, filterContext = null }) {
    // Subscribe to graph changes via useSyncExternalStore
    const quads = useGraphQuads(graph, events);

    // Filter by context if specified
    const filteredQuads = useMemo(() => {
        if (!filterContext) return quads;

        return quads.filter(quad => {
            const [_, __, ___, group] = quad.values;
            return serialize(group) === filterContext;
        });
    }, [quads, filterContext]);

    // Transform quads to React Flow format
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

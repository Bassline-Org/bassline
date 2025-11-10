import { useMemo, useEffect } from 'react';
import { ReactFlow, useNodesState, useEdgesState, Controls, Background } from '@xyflow/react';
import { useGraphQuads } from '../hooks/useGraphQuads.js';
import { quadsToReactFlow } from '../transforms/quadsToReactFlow.js';
import { serialize } from '@bassline/parser/types';
import { EntityNode } from '../nodes/EntityNode.jsx';
import { LiteralNode } from '../nodes/LiteralNode.jsx';
import { AttributeEdge } from '../edges/AttributeEdge.jsx';
import '@xyflow/react/dist/style.css';

// Register custom node and edge types
const nodeTypes = {
    entity: EntityNode,
    literal: LiteralNode,
};

const edgeTypes = {
    attribute: AttributeEdge,
};

/**
 * Visualize the entire graph as a React Flow diagram
 *
 * Automatically updates when new quads are added to the instrumented graph.
 * Uses useSyncExternalStore to subscribe efficiently without state duplication.
 *
 * @param {Graph} graph - The graph to visualize
 * @param {EventTarget} events - EventTarget from instrument(graph)
 * @param {string} [filterContext] - Optional: only show quads from this context
 * @param {Array} [filteredQuads] - Optional: pre-filtered quads to display (overrides graph quads)
 * @param {Object} [layoutOptions] - Optional: force layout configuration
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
export function GraphVisualization({ graph, events, filterContext = null, filteredQuads: propFilteredQuads = null, layoutOptions = {} }) {
    // Subscribe to graph changes via useSyncExternalStore
    const quads = useGraphQuads(graph, events);

    // Use provided filtered quads if available, otherwise use all quads
    const sourceQuads = propFilteredQuads || quads;

    // Filter by context if specified
    const filteredQuads = useMemo(() => {
        if (!filterContext) return sourceQuads;

        return sourceQuads.filter(quad => {
            const [_, __, ___, group] = quad.values;
            return serialize(group) === filterContext;
        });
    }, [sourceQuads, filterContext]);

    // Transform quads to React Flow format
    const { nodes, edges } = useMemo(() =>
        quadsToReactFlow(filteredQuads, layoutOptions),
        [filteredQuads, layoutOptions]
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
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
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

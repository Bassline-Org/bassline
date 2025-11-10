import { useMemo, useEffect, useRef, useState } from 'react';
import { ReactFlow, useNodesState, useEdgesState, Controls, Background, Panel } from '@xyflow/react';
import * as d3 from 'd3-force';
import { useGraphQuads } from '../hooks/useGraphQuads.js';
import { quadsToReactFlow } from '../transforms/quadsToReactFlow.js';
import { quadsToReactFlowLabeled } from '../transforms/quadsToReactFlowLabeled.js';
import { serialize } from '@bassline/parser/types';
import { EntityNode } from '../nodes/EntityNode.jsx';
import { LiteralNode } from '../nodes/LiteralNode.jsx';
import { AttributeEdge } from '../edges/AttributeEdge.jsx';
import { LabeledEdge } from '../edges/LabeledEdge.jsx';
import '@xyflow/react/dist/style.css';

// Register custom node and edge types
const nodeTypes = {
    entity: EntityNode,
    literal: LiteralNode,
};

const edgeTypes = {
    attribute: AttributeEdge,
    labeled: LabeledEdge,
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
    // View mode: 'labeled' (property graph) or 'triple' (attribute nodes)
    const [viewMode, setViewMode] = useState('labeled');
    const [isAnimating, setIsAnimating] = useState(false);

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

    // Track previous nodes for incremental layout
    const previousNodesRef = useRef([]);
    const simulationRef = useRef(null);
    const dragSimulationRef = useRef(null);

    // React Flow state management
    const [rfNodes, setNodes, onNodesChange] = useNodesState([]);
    const [rfEdges, setEdges, onEdgesChange] = useEdgesState([]);

    // Create persistent physics simulation when drag starts
    const handleNodeDragStart = (event, node) => {
        // Stop initial layout animation if running
        if (simulationRef.current) {
            simulationRef.current.stop();
            simulationRef.current = null;
            setIsAnimating(false);
        }

        // Create d3 nodes from current React Flow nodes
        const d3Nodes = rfNodes.map(n => ({
            ...n,
            x: n.position.x,
            y: n.position.y,
            // Pin the dragged node at current position
            fx: n.id === node.id ? node.position.x : undefined,
            fy: n.id === node.id ? node.position.y : undefined,
        }));

        // Create d3 links from React Flow edges
        const d3Links = rfEdges.map(edge => ({
            source: edge.source,
            target: edge.target,
        }));

        // Create and configure d3-force simulation
        const simulation = d3.forceSimulation(d3Nodes)
            .force('charge', d3.forceManyBody().strength(layoutOptions.charge || -500))
            .force('collide', d3.forceCollide().radius(layoutOptions.collisionRadius || 60))
            .alphaTarget(0.3); // Keep simulation warm for responsive updates

        // Add link force if edges exist
        if (d3Links.length > 0) {
            simulation.force('link', d3.forceLink(d3Links)
                .id(d => d.id)
                .distance(layoutOptions.linkDistance || 150)
                .strength(layoutOptions.linkStrength || 0.3));
        }

        // Set up tick callback for smooth updates
        simulation.on('tick', () => {
            setNodes(d3Nodes.map(n => ({
                ...n,
                position: {
                    x: isNaN(n.x) ? 0 : n.x,
                    y: isNaN(n.y) ? 0 : n.y
                }
            })));
        });

        dragSimulationRef.current = simulation;
    };

    // Update pinned node position as user drags
    const handleNodeDrag = (event, node) => {
        if (dragSimulationRef.current) {
            const simulation = dragSimulationRef.current;
            const d3Node = simulation.nodes().find(n => n.id === node.id);

            if (d3Node) {
                // Update pinned position
                d3Node.fx = node.position.x;
                d3Node.fy = node.position.y;
                // Nudge simulation to respond
                simulation.alpha(0.3).restart();
            }
        }
    };

    // Release pin and let simulation settle when drag ends
    const handleNodeDragStop = (event, node) => {
        if (dragSimulationRef.current) {
            const simulation = dragSimulationRef.current;
            const d3Node = simulation.nodes().find(n => n.id === node.id);

            if (d3Node) {
                // Release the pin
                d3Node.fx = null;
                d3Node.fy = null;
            }

            // Let simulation settle naturally
            simulation.alphaTarget(0).alpha(0.3);

            // Clean up after settling
            setTimeout(() => {
                if (dragSimulationRef.current) {
                    previousNodesRef.current = rfNodes;
                    dragSimulationRef.current.stop();
                    dragSimulationRef.current = null;
                }
            }, 1000);
        }
    };

    // Handle layout updates with animation support
    useEffect(() => {
        // Clean up previous simulation if running
        if (simulationRef.current) {
            simulationRef.current.stop();
            simulationRef.current = null;
        }

        // Check if we should use animated incremental update
        const shouldAnimate = previousNodesRef.current.length > 0 &&
                              layoutOptions.animated !== false;

        // Select transform based on view mode
        const transform = viewMode === 'labeled' ? quadsToReactFlowLabeled : quadsToReactFlow;

        // Transform quads to React Flow format
        const result = transform(filteredQuads, {
            ...layoutOptions,
            previousNodes: previousNodesRef.current,
            animated: shouldAnimate,
            onTick: shouldAnimate ? ({ nodes }) => {
                // Update nodes during animation
                setNodes(nodes);
                previousNodesRef.current = nodes;
            } : undefined,
            onEnd: shouldAnimate ? ({ nodes, edges }) => {
                // Final update when animation completes
                setNodes(nodes);
                setEdges(edges);
                previousNodesRef.current = nodes;
                setIsAnimating(false); // Animation finished
            } : undefined,
        });

        if (shouldAnimate) {
            // Store simulation controller for cleanup
            simulationRef.current = result;
            // Edges are set once at the start
            setEdges(result.edges || []);
            setIsAnimating(true); // Animation started
        } else {
            // Synchronous mode - set both immediately
            setNodes(result.nodes);
            setEdges(result.edges);
            previousNodesRef.current = result.nodes;
            setIsAnimating(false); // No animation
        }

        // Cleanup on unmount
        return () => {
            if (simulationRef.current) {
                simulationRef.current.stop();
                setIsAnimating(false);
            }
            if (dragSimulationRef.current) {
                dragSimulationRef.current.stop();
                dragSimulationRef.current = null;
            }
        };
    }, [filteredQuads, layoutOptions, viewMode]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ReactFlow
                nodes={rfNodes}
                edges={rfEdges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStart={handleNodeDragStart}
                onNodeDrag={handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                nodesConnectable={false}
                fitView
            >
                <Controls />
                <Background />
                <Panel position="top-right">
                    <div style={{
                        background: 'white',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'center',
                        fontSize: '12px',
                        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                    }}>
                        <span style={{ color: '#64748b', fontWeight: '500' }}>View:</span>
                        <button
                            onClick={() => setViewMode('labeled')}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: '1px solid',
                                borderColor: viewMode === 'labeled' ? '#3b82f6' : '#cbd5e1',
                                background: viewMode === 'labeled' ? '#3b82f6' : 'white',
                                color: viewMode === 'labeled' ? 'white' : '#475569',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '500',
                                transition: 'all 0.2s',
                            }}
                        >
                            Property Graph
                        </button>
                        <button
                            onClick={() => setViewMode('triple')}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '4px',
                                border: '1px solid',
                                borderColor: viewMode === 'triple' ? '#3b82f6' : '#cbd5e1',
                                background: viewMode === 'triple' ? '#3b82f6' : 'white',
                                color: viewMode === 'triple' ? 'white' : '#475569',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '500',
                                transition: 'all 0.2s',
                            }}
                        >
                            Triple Mode
                        </button>
                    </div>
                </Panel>
            </ReactFlow>
        </div>
    );
}

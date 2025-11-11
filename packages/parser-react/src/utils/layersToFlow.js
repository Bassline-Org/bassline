/**
 * layersToFlow - Transform LayeredControl layers and routing into React Flow format
 *
 * Converts layer metadata and routing connections into nodes and edges for React Flow visualization.
 * Uses dagre for automatic hierarchical layout.
 */

import dagre from "dagre";

/**
 * Transform layers and routing into React Flow nodes and edges
 *
 * @param {string[]} layers - Array of layer names
 * @param {{from: string, to: string}[]} routing - Array of routing connections
 * @param {LayeredControl} lc - LayeredControl instance for accessing layer metadata
 * @param {string|null} activeLayer - Currently active layer name
 * @returns {{nodes: Array, edges: Array}} React Flow nodes and edges
 */
export function layersToFlow(layers, routing, lc, activeLayer = null) {
    const nodes = [];
    const edges = [];

    // Create nodes from layers
    for (const name of layers) {
        const layer = lc.getLayer(name);
        if (!layer) continue;

        const isBus = !!layer.bus;
        const isActive = name === activeLayer;

        // Gather metadata for display
        const data = {
            label: name,
            isBus,
            isActive,
        };

        // Add layer-specific metadata (not for buses)
        if (!isBus && layer.control) {
            data.quadCount = layer.control.graph?.quads
                ? Object.keys(layer.control.graph.quads).length
                : 0;
            data.hasStaging = layer.staging?.size > 0;
            data.stagingCount = layer.staging?.size ?? 0;
            data.branch = layer.currentBranch;
            data.commitCount = layer.commits?.size ?? 0;
        }

        nodes.push({
            id: name,
            type: isBus ? "bus" : "layer",
            position: { x: 0, y: 0 }, // Will be set by layout
            data,
        });
    }

    // Create edges from routing
    for (const route of routing) {
        edges.push({
            id: `${route.from}-${route.to}`,
            source: route.from,
            target: route.to,
            type: "smoothstep",
            animated: true,
            style: {
                stroke: "#555",
                strokeWidth: 2,
            },
        });
    }

    // Apply dagre layout
    applyDagreLayout(nodes, edges);

    return { nodes, edges };
}

/**
 * Apply dagre hierarchical layout to nodes
 * Arranges nodes left-to-right following data flow
 *
 * @param {Array} nodes - React Flow nodes (mutated in place)
 * @param {Array} edges - React Flow edges
 */
function applyDagreLayout(nodes, edges) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configure layout direction (left-to-right)
    dagreGraph.setGraph({
        rankdir: "LR",
        nodesep: 80,
        ranksep: 150,
        marginx: 50,
        marginy: 50,
    });

    // Add nodes to dagre
    for (const node of nodes) {
        const width = node.data.isBus ? 60 : 180;
        const height = node.data.isBus ? 60 : 100;
        dagreGraph.setNode(node.id, { width, height });
    }

    // Add edges to dagre
    for (const edge of edges) {
        dagreGraph.setEdge(edge.source, edge.target);
    }

    // Run layout
    dagre.layout(dagreGraph);

    // Apply positions to nodes
    for (const node of nodes) {
        const nodeWithPosition = dagreGraph.node(node.id);
        if (nodeWithPosition) {
            // Center the node on the calculated position
            const width = node.data.isBus ? 60 : 180;
            const height = node.data.isBus ? 60 : 100;

            node.position = {
                x: nodeWithPosition.x - width / 2,
                y: nodeWithPosition.y - height / 2,
            };
        }
    }
}

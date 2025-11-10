import * as d3 from 'd3-force';

/**
 * Apply d3-force layout to nodes and edges
 *
 * Uses physics-based force simulation to position nodes organically.
 * Better for general graph structures than hierarchical dagre layout.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} options - Layout configuration
 * @param {number} [options.charge=-300] - Node repulsion force (-1000 to 0)
 * @param {number} [options.linkDistance=100] - Target distance between connected nodes (20 to 500)
 * @param {number} [options.linkStrength=0.5] - How strongly links pull nodes together (0 to 1)
 * @param {number} [options.collisionRadius=50] - Prevent node overlap radius (10 to 200)
 * @param {number} [options.iterations=300] - Number of simulation steps (100 to 1000)
 * @returns {{nodes: Array, edges: Array}} Layouted nodes and edges
 */
export function applyForceLayout(nodes, edges, options = {}) {
    // Handle empty graph
    if (nodes.length === 0) {
        return { nodes: [], edges: [] };
    }

    const {
        charge = -300,
        linkDistance = 100,
        linkStrength = 0.5,
        collisionRadius = 50,
        iterations = 300,
    } = options;

    // Convert React Flow nodes to d3 format with random initial positions
    // This prevents NaN issues with d3-force
    const d3Nodes = nodes.map(node => ({
        ...node,
        x: node.position.x || Math.random() * 500,
        y: node.position.y || Math.random() * 500,
    }));

    // Convert React Flow edges to d3 links
    const d3Links = edges.map(edge => ({
        source: edge.source,
        target: edge.target,
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(d3Nodes)
        .force('charge', d3.forceManyBody().strength(charge))
        .force('center', d3.forceCenter(0, 0))
        .force('collide', d3.forceCollide().radius(collisionRadius))
        .stop();

    // Only add link force if there are edges
    if (d3Links.length > 0) {
        simulation.force('link', d3.forceLink(d3Links)
            .id(d => d.id)
            .distance(linkDistance)
            .strength(linkStrength));
    }

    // Run simulation synchronously
    for (let i = 0; i < iterations; i++) {
        simulation.tick();
    }

    // Convert back to React Flow format
    const layoutedNodes = d3Nodes.map(node => ({
        ...node,
        position: {
            x: isNaN(node.x) ? 0 : node.x,
            y: isNaN(node.y) ? 0 : node.y
        },
    }));

    return {
        nodes: layoutedNodes,
        edges,
    };
}

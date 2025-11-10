import * as d3 from 'd3-force';
import { applyIncrementalForceLayout } from './force-incremental.js';

/**
 * Apply d3-force layout to nodes and edges
 *
 * Uses physics-based force simulation to position nodes organically.
 * Better for general graph structures than hierarchical dagre layout.
 *
 * Supports two modes:
 * - Synchronous: Computes final positions immediately (default)
 * - Animated: Incrementally updates positions with smooth transitions
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} options - Layout configuration
 * @param {number} [options.charge=-500] - Node repulsion force (-1000 to 0) - stronger for labeled graphs
 * @param {number} [options.linkDistance=150] - Target distance between connected nodes (20 to 500) - more space for labels
 * @param {number} [options.linkStrength=0.3] - How strongly links pull nodes together (0 to 1) - weaker allows spreading
 * @param {number} [options.collisionRadius=60] - Prevent node overlap radius (10 to 200) - accounts for label space
 * @param {number} [options.iterations=300] - Number of simulation steps (100 to 1000)
 * @param {Array} [options.previousNodes] - Previous node positions for incremental layout
 * @param {boolean} [options.animated=false] - Use animated incremental layout
 * @param {Function} [options.onTick] - Callback for animation frames (animated mode only)
 * @param {Function} [options.onEnd] - Callback when simulation completes (animated mode only)
 * @returns {{nodes: Array, edges: Array}} Layouted nodes and edges (or simulation controller in animated mode)
 */
export function applyForceLayout(nodes, edges, options = {}) {
    const {
        animated = false,
        previousNodes = [],
        onTick,
        onEnd,
        ...forceOptions
    } = options;

    // Use animated incremental layout if requested
    if (animated && previousNodes.length > 0) {
        return applyIncrementalForceLayout(nodes, edges, {
            ...forceOptions,
            previousNodes,
            onTick,
            onEnd,
        });
    }

    // Otherwise use synchronous layout (original behavior)
    return applySynchronousForceLayout(nodes, edges, forceOptions);
}

/**
 * Apply synchronous force layout (runs all iterations at once)
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} options - Layout configuration
 * @returns {{nodes: Array, edges: Array}} Layouted nodes and edges
 */
function applySynchronousForceLayout(nodes, edges, options = {}) {
    // Handle empty graph
    if (nodes.length === 0) {
        return { nodes: [], edges: [] };
    }

    const {
        charge = -500,          // Stronger repulsion for labeled graphs
        linkDistance = 150,     // More space for edge labels
        linkStrength = 0.3,     // Weaker links allow better spreading
        collisionRadius = 60,   // Account for label space around nodes
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

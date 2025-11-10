import * as d3 from 'd3-force';

/**
 * Apply incremental force layout with smooth animations
 *
 * This layout preserves existing node positions and only repositions new nodes.
 * Uses d3-force's alphaTarget warming pattern for smooth, organic animations.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} options - Layout configuration
 * @param {Array} [options.previousNodes] - Previous node positions to preserve
 * @param {Function} [options.onTick] - Callback fired on each simulation tick
 * @param {Function} [options.onEnd] - Callback fired when simulation completes
 * @param {number} [options.charge=-500] - Node repulsion force - stronger for labeled graphs
 * @param {number} [options.linkDistance=150] - Target distance between connected nodes - more space for labels
 * @param {number} [options.linkStrength=0.3] - How strongly links pull nodes together - weaker allows spreading
 * @param {number} [options.collisionRadius=60] - Prevent node overlap radius - accounts for label space
 * @returns {Object} Simulation controller with stop() method and edges array
 */
export function applyIncrementalForceLayout(nodes, edges, options = {}) {
    const {
        previousNodes = [],
        onTick = () => {},
        onEnd = () => {},
        charge = -500,          // Stronger repulsion for labeled graphs
        linkDistance = 150,     // More space for edge labels
        linkStrength = 0.3,     // Weaker links allow better spreading
        collisionRadius = 60,   // Account for label space around nodes
    } = options;

    // Handle empty graph
    if (nodes.length === 0) {
        onEnd({ nodes: [], edges: [] });
        return { stop: () => {}, edges: [] };
    }

    // Create a map of previous positions
    const previousPositions = new Map(
        previousNodes.map(node => [node.id, node.position])
    );

    // Identify new vs existing nodes
    const d3Nodes = nodes.map(node => {
        const prevPos = previousPositions.get(node.id);
        const isExisting = !!prevPos;

        return {
            ...node,
            // Use previous position if exists, otherwise random near center
            x: prevPos?.x ?? Math.random() * 200 - 100,
            y: prevPos?.y ?? Math.random() * 200 - 100,
            // Pin existing nodes initially (will unpin after warmup)
            fx: isExisting ? prevPos.x : undefined,
            fy: isExisting ? prevPos.y : undefined,
            isExisting,
        };
    });

    // Convert edges to d3 links
    const d3Links = edges.map(edge => ({
        source: edge.source,
        target: edge.target,
    }));

    // Create force simulation
    const simulation = d3.forceSimulation(d3Nodes)
        .force('charge', d3.forceManyBody().strength(charge))
        .force('center', d3.forceCenter(0, 0))
        .force('collide', d3.forceCollide().radius(collisionRadius))
        .alphaDecay(0.02); // Slower cooling for smoother animation

    // Add link force if there are edges
    if (d3Links.length > 0) {
        simulation.force('link', d3.forceLink(d3Links)
            .id(d => d.id)
            .distance(linkDistance)
            .strength(linkStrength));
    }

    // Warm the simulation gradually for smooth start
    simulation.alphaTarget(0.3).restart();

    // Track if we've unpinned nodes
    let unpinned = false;

    // Emit tick events for animation
    simulation.on('tick', () => {
        // Convert to React Flow format
        const layoutedNodes = d3Nodes.map(node => ({
            ...node,
            position: {
                x: isNaN(node.x) ? 0 : node.x,
                y: isNaN(node.y) ? 0 : node.y
            },
        }));

        onTick({ nodes: layoutedNodes, edges });

        // After initial warmup, unpin existing nodes to allow organic movement
        if (!unpinned && simulation.alpha() < 0.5) {
            d3Nodes.forEach(node => {
                if (node.isExisting) {
                    node.fx = null;
                    node.fy = null;
                }
            });
            unpinned = true;
        }
    });

    // Cool down after initial warmup
    setTimeout(() => {
        simulation.alphaTarget(0);
    }, 500);

    // Detect when simulation has settled
    simulation.on('end', () => {
        const finalNodes = d3Nodes.map(node => ({
            ...node,
            position: {
                x: isNaN(node.x) ? 0 : node.x,
                y: isNaN(node.y) ? 0 : node.y
            },
        }));
        onEnd({ nodes: finalNodes, edges });
    });

    // Return controller with edges
    return {
        stop: () => {
            simulation.stop();
        },
        edges, // Include edges for initial render
    };
}

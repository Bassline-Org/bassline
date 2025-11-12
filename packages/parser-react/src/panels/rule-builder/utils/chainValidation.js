/**
 * Chain validation utilities
 *
 * Validates that nodes are properly connected in 4-node chains
 */

/**
 * Find all chains in a group
 * @param {Array} nodes - Nodes in the group
 * @param {Array} edges - All edges
 * @returns {Array} Array of chains (each chain is an array of nodes)
 */
export function findAllChains(nodes, edges) {
    const nodeIds = new Set(nodes.map(n => n.id));

    // Find starting nodes (no incoming edges within group)
    const startNodes = nodes.filter(node => {
        const incoming = edges.filter(e =>
            e.target === node.id && nodeIds.has(e.source)
        );
        return incoming.length === 0;
    });

    // Build chains from each start node
    const chains = [];
    startNodes.forEach(startNode => {
        const chain = [startNode];
        let current = startNode;

        // Follow edges to build chain
        while (true) {
            const outgoing = edges.find(e => e.source === current.id);
            if (!outgoing) break;

            const next = nodes.find(n => n.id === outgoing.target);
            if (!next) break;

            chain.push(next);
            current = next;

            // Prevent infinite loops
            if (chain.length > 10) break;
        }

        if (chain.length > 0) {
            chains.push(chain);
        }
    });

    return chains;
}

/**
 * Validate chains in a group
 * @param {Array} nodes - Nodes in the group
 * @param {Array} edges - All edges
 * @returns {Object} Validation result
 */
export function validateChains(nodes, edges) {
    const chains = findAllChains(nodes, edges);
    const errors = [];
    const warnings = [];

    // Track which nodes are in valid chains
    const nodesInValidChains = new Set();

    chains.forEach((chain, idx) => {
        if (chain.length < 4) {
            errors.push({
                type: 'incomplete-chain',
                message: `Chain ${idx + 1} is incomplete (${chain.length}/4 nodes)`,
                nodeIds: chain.map(n => n.id),
                chain
            });
        } else if (chain.length > 4) {
            warnings.push({
                type: 'long-chain',
                message: `Chain ${idx + 1} is too long (${chain.length} nodes, expected 4)`,
                nodeIds: chain.map(n => n.id),
                chain
            });
            // Only the first 4 nodes are in a valid quad
            chain.slice(0, 4).forEach(n => nodesInValidChains.add(n.id));
        } else {
            // Valid 4-node chain
            chain.forEach(n => nodesInValidChains.add(n.id));
        }
    });

    // Find orphaned nodes (not in any chain)
    const orphanedNodes = nodes.filter(n => !nodesInValidChains.has(n.id));
    if (orphanedNodes.length > 0) {
        warnings.push({
            type: 'orphaned-nodes',
            message: `${orphanedNodes.length} node(s) not part of any valid quad`,
            nodeIds: orphanedNodes.map(n => n.id),
            nodes: orphanedNodes
        });
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        validChainCount: chains.filter(c => c.length === 4).length,
        totalNodes: nodes.length
    };
}

/**
 * Get validation errors for a specific node
 * @param {string} nodeId - Node ID
 * @param {Object} validation - Validation result from validateChains
 * @returns {Array} Array of error/warning messages for this node
 */
export function getNodeErrors(nodeId, validation) {
    const messages = [];

    validation.errors.forEach(error => {
        if (error.nodeIds.includes(nodeId)) {
            messages.push({ severity: 'error', message: error.message });
        }
    });

    validation.warnings.forEach(warning => {
        if (warning.nodeIds.includes(nodeId)) {
            messages.push({ severity: 'warning', message: warning.message });
        }
    });

    return messages;
}

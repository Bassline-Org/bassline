/**
 * Chain detection utilities for 4-node quad chains
 *
 * A valid quad is a 4-node chain: Subject → Attribute → Target → Context
 */

/**
 * Detect the position of a node in a chain
 * @param {string} nodeId - Node ID to check
 * @param {Array} edges - All edges in the graph
 * @returns {string|null} 'subject', 'attribute', 'target', 'context', or null
 */
export function detectPositionInChain(nodeId, edges) {
    const incoming = edges.filter(e => e.target === nodeId);
    const outgoing = edges.filter(e => e.source === nodeId);

    const inCount = incoming.length;
    const outCount = outgoing.length;

    // Subject: no incoming, 1 outgoing
    if (inCount === 0 && outCount === 1) {
        return 'subject';
    }

    // Context: 1 incoming, no outgoing
    if (inCount === 1 && outCount === 0) {
        return 'context';
    }

    // Attribute or Target: 1 incoming, 1 outgoing
    // Determine by chain depth (distance from subject)
    if (inCount === 1 && outCount === 1) {
        const depth = getChainDepth(nodeId, edges);
        return depth === 1 ? 'attribute' : 'target';
    }

    return null; // Not in a valid chain
}

/**
 * Get the depth of a node in its chain (distance from subject)
 * @param {string} nodeId - Node ID to check
 * @param {Array} edges - All edges in the graph
 * @returns {number} Chain depth (0 = subject, 1 = attribute, 2 = target, 3 = context)
 */
function getChainDepth(nodeId, edges) {
    let depth = 0;
    let current = nodeId;

    // Walk backwards to find the start of the chain
    while (true) {
        const incoming = edges.find(e => e.target === current);
        if (!incoming) break;

        depth++;
        current = incoming.source;

        // Prevent infinite loops
        if (depth > 10) break;
    }

    return depth;
}

/**
 * Get position label for display
 * @param {string} position - Position string
 * @returns {string} Single-letter label
 */
export function getPositionLabel(position) {
    const labels = {
        subject: 'S',
        attribute: 'A',
        target: 'T',
        context: 'C'
    };
    return labels[position] || '';
}

/**
 * Get position color for badge styling
 * @param {string} position - Position string
 * @returns {string} Tailwind class
 */
export function getPositionColor(position) {
    const colors = {
        subject: 'bg-gradient-to-br from-blue-600 to-blue-700 border-2 border-blue-800',
        attribute: 'bg-gradient-to-br from-purple-600 to-purple-700 border-2 border-purple-800',
        target: 'bg-gradient-to-br from-green-600 to-green-700 border-2 border-green-800',
        context: 'bg-gradient-to-br from-orange-600 to-orange-700 border-2 border-orange-800'
    };
    return colors[position] || 'bg-gradient-to-br from-gray-600 to-gray-700 border-2 border-gray-800';
}

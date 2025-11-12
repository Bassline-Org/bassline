/**
 * compileToQuads - Convert ReactFlow graph to quad patterns
 *
 * Finds 4-node chains (Subject → Attribute → Target → Context)
 * and compiles them into quad strings
 */

/**
 * Find all 4-node chains starting from a given node
 * @param {Object} startNode - Starting node
 * @param {Array} nodes - All nodes
 * @param {Array} edges - All edges
 * @returns {Array|null} Chain of 4 nodes or null if incomplete
 */
function findChainFrom(startNode, nodes, edges) {
    const chain = [startNode];
    let current = startNode;

    // Follow edges to build 4-node chain
    for (let i = 1; i < 4; i++) {
        const outgoing = edges.find(e => e.source === current.id);
        if (!outgoing) return null; // Chain incomplete

        const next = nodes.find(n => n.id === outgoing.target);
        if (!next) return null; // Target node not found

        chain.push(next);
        current = next;
    }

    // Verify chain has exactly 4 nodes
    return chain.length === 4 ? chain : null;
}

/**
 * Format a node's value for quad compilation
 * @param {Object} node - Node to format
 * @returns {string} Formatted value
 */
function formatNode(node) {
    if (!node || !node.data) return '?';

    // Variable nodes already have ? prefix
    if (node.type === 'variable') {
        return node.data.label || '?x';
    }

    // Wildcard
    if (node.type === 'wildcard') {
        return '*';
    }

    // Literal nodes - format based on literalType
    if (node.type === 'literal') {
        const { label, literalType } = node.data;
        if (literalType === 'string') {
            return `"${label}"`;
        }
        return label;
    }

    // Fallback
    return node.data.label || '?';
}

/**
 * Compile a group (pattern/production/NAC) into quad strings
 * @param {Array} nodes - All nodes in the graph
 * @param {Array} edges - All edges in the graph
 * @param {string} groupId - ID of the group to compile
 * @returns {Array<string>} Array of quad strings
 */
function compileGroup(nodes, edges, groupId) {
    // Get all nodes that belong to this group
    const groupNodes = nodes.filter(node => node.parentNode === groupId);

    // Find all starting nodes (no incoming edges within this group)
    const groupNodeIds = new Set(groupNodes.map(n => n.id));
    const startNodes = groupNodes.filter(node => {
        const incoming = edges.filter(e =>
            e.target === node.id && groupNodeIds.has(e.source)
        );
        return incoming.length === 0;
    });

    // Build chains from each start node
    const chains = [];
    startNodes.forEach(startNode => {
        const chain = findChainFrom(startNode, nodes, edges);
        if (chain) {
            chains.push(chain);
        }
    });

    // Compile chains to quad strings
    return chains.map(chain => {
        const [subject, attribute, target, context] = chain;
        return `${formatNode(subject)} ${formatNode(attribute)} ${formatNode(target)} ${formatNode(context)}`;
    });
}

/**
 * Compile the entire graph into pattern, production, and NAC quads
 * @param {Array} nodes - All nodes in the graph
 * @param {Array} edges - All edges in the graph
 * @returns {Object} { patternQuads, productionQuads, nacQuads }
 */
export function compileToQuads(nodes, edges) {
    // Find group nodes
    const patternGroup = nodes.find(n => n.id === 'pattern-group');
    const productionGroup = nodes.find(n => n.id === 'production-group');
    const nacGroup = nodes.find(n => n.id === 'nac-group');

    // Compile each group
    const patternQuads = patternGroup
        ? compileGroup(nodes, edges, 'pattern-group')
        : [];

    const productionQuads = productionGroup
        ? compileGroup(nodes, edges, 'production-group')
        : [];

    const nacQuads = nacGroup
        ? compileGroup(nodes, edges, 'nac-group')
        : [];

    return {
        patternQuads,
        productionQuads,
        nacQuads,
    };
}

/**
 * Validate that production variables exist in pattern or palette
 * @param {Array<string>} patternQuads
 * @param {Array<string>} productionQuads
 * @param {Array} nodes - All nodes (to check palette variables)
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export function validateRule(patternQuads, productionQuads, nodes = []) {
    // Extract variables from pattern (anything starting with ?)
    const patternVars = new Set();
    patternQuads.forEach(quad => {
        const parts = quad.split(' ');
        parts.forEach(part => {
            if (part.startsWith('?')) {
                patternVars.add(part);
            }
        });
    });

    // Also add palette variables (variables with no parentNode)
    const paletteVars = nodes
        .filter(n => !n.parentNode && n.type === 'variable')
        .map(n => n.data?.label);
    paletteVars.forEach(v => patternVars.add(v));

    // Check that all production variables exist in pattern or palette
    const errors = [];
    productionQuads.forEach(quad => {
        const parts = quad.split(' ');
        parts.forEach(part => {
            if (part.startsWith('?') && !patternVars.has(part)) {
                errors.push(`Variable ${part} used in production but not in pattern or palette`);
            }
        });
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

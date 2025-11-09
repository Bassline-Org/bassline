import dagre from '@dagrejs/dagre';
import { serialize, hash } from '@bassline/parser/types';

/**
 * Transform quads to React Flow node/edge format
 *
 * Nodes: One node per unique word/value in the quads
 * Edges: One edge per quad, representing the relationship
 *
 * @param {Quad[]} quads - Array of quads from graph
 * @returns {{nodes: Object[], edges: Object[]}} React Flow format
 *
 * @example
 * const quads = [
 *   quad(w('alice'), w('age'), 30, w('ctx1')),
 *   quad(w('alice'), w('friend'), w('bob'), w('ctx1'))
 * ];
 *
 * const { nodes, edges } = quadsToReactFlow(quads);
 * // nodes: [alice, age, 30, friend, bob, ctx1]
 * // edges: [alice--(age)-->30, alice--(friend)-->bob]
 */
export function quadsToReactFlow(quads) {
    // Track unique words/values by their hash
    const wordMap = new Map(); // hash -> {id, label}
    const edges = [];

    for (const quad of quads) {
        const [entity, attr, value, group] = quad.values;

        // Register all unique words from this quad
        registerWord(wordMap, entity);
        registerWord(wordMap, attr);
        registerWord(wordMap, value);
        registerWord(wordMap, group);

        // Create edge: entity --[attr]--> value
        edges.push({
            id: quad.hash().toString(),
            source: hash(entity).toString(),
            target: hash(value).toString(),
            label: serialize(attr),
            data: {
                attribute: serialize(attr),
                context: serialize(group),
                quadHash: quad.hash()
            }
        });
    }

    // Convert word map to React Flow nodes
    const nodes = Array.from(wordMap.values()).map(({ id, label }) => ({
        id,
        data: { label },
        position: { x: 0, y: 0 } // Will be set by layout
    }));

    // Apply dagre layout
    return applyLayout(nodes, edges);
}

/**
 * Register a word in the word map if not already present
 */
function registerWord(wordMap, value) {
    const id = hash(value).toString();

    if (!wordMap.has(id)) {
        wordMap.set(id, {
            id,
            label: serialize(value)
        });
    }
}

/**
 * Apply dagre layout algorithm to position nodes
 */
function applyLayout(nodes, edges) {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: 'LR',      // Left to right
        nodesep: 100,        // Horizontal spacing
        ranksep: 150         // Vertical spacing
    });

    // Add nodes to graph
    nodes.forEach(node => {
        g.setNode(node.id, {
            width: 150,
            height: 50
        });
    });

    // Add edges to graph
    edges.forEach(edge => {
        g.setEdge(edge.source, edge.target);
    });

    // Run layout algorithm
    dagre.layout(g);

    // Apply computed positions to nodes
    const layoutedNodes = nodes.map(node => {
        const nodeWithPosition = g.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 75,  // Center (width/2)
                y: nodeWithPosition.y - 25   // Center (height/2)
            }
        };
    });

    return {
        nodes: layoutedNodes,
        edges
    };
}

import { hash, serialize } from "@bassline/parser/types";
import { applyForceLayout } from "../layouts/force.js";

/**
 * Transform quads to React Flow node/edge format with labeled edges
 *
 * Nodes: Two nodes per quad - entity and value
 * Edges: One labeled edge per quad - entity --[attribute]--> value
 *
 * This creates a property graph visualization (fewer nodes than triple mode)
 *
 * @param {Quad[]} quads - Array of quads from graph
 * @param {Object} [options] - Layout options (passed to force layout)
 * @param {Array} [options.previousNodes] - Previous node positions for incremental layout
 * @returns {{nodes: Object[], edges: Object[]}} React Flow format
 *
 * @example
 * const quads = [
 *   quad(w('alice'), w('age'), 30, w('ctx1')),
 *   quad(w('alice'), w('friend'), w('bob'), w('ctx1'))
 * ];
 *
 * const { nodes, edges } = quadsToReactFlowLabeled(quads);
 * // nodes: [alice, 30, bob]
 * // edges: [alice --[age]--> 30, alice --[friend]--> bob]
 */
export function quadsToReactFlowLabeled(quads, options = {}) {
    const { previousNodes, ...layoutOptions } = options;
    // Track unique words/values by their hash
    const wordMap = new Map(); // hash -> {id, label}
    const edges = [];
    const entityIds = new Set(); // Track which nodes are entities (appear as source)

    for (const quad of quads) {
        const [entity, attr, value, group] = quad.values;

        // Register entity and value (skip attribute - it becomes edge label)
        registerWord(wordMap, entity);
        registerWord(wordMap, value);

        // Mark entity as an entity (it's the source of the relationship)
        const entityId = hash(entity).toString();
        entityIds.add(entityId);

        const valueId = hash(value).toString();
        const quadHashStr = quad.hash().toString();

        // Create single labeled edge: entity --[attribute]--> value
        edges.push({
            id: quadHashStr,
            source: entityId,
            target: valueId,
            type: "labeled",
            data: {
                label: serialize(attr), // Attribute becomes edge label
                context: serialize(group),
                quadHash: quad.hash(),
            },
        });
    }

    // Assign linknum to edges for curvature (handles multiple edges between same nodes)
    const edgesWithLinknum = assignEdgeLinkNumbers(edges);

    // Convert word map to React Flow nodes with types
    const nodes = Array.from(wordMap.values()).map(({ id, label }) => {
        // Determine node type: entity if it appears as source, otherwise literal
        const type = entityIds.has(id) ? "entity" : "literal";

        return {
            id,
            type, // 'entity' or 'literal'
            data: { label },
            position: { x: 0, y: 0 }, // Will be set by layout
        };
    });

    // Apply force layout with previous node positions for incremental updates
    return applyForceLayout(nodes, edgesWithLinknum, {
        ...layoutOptions,
        previousNodes: previousNodes || [],
    });
}

/**
 * Register a word in the word map if not already present
 */
function registerWord(wordMap, value) {
    const id = hash(value).toString();

    if (!wordMap.has(id)) {
        wordMap.set(id, {
            id,
            label: serialize(value),
        });
    }
}

/**
 * Assign linknum and linkTotal to edges for proper curvature
 *
 * When multiple edges exist between the same two nodes, we need to
 * curve them differently so their labels don't overlap. This function
 * groups edges by source-target pair and assigns:
 * - linknum: Position in group (1, 2, 3, ...)
 * - linkTotal: Total edges in group
 *
 * @param {Array} edges - Array of edge objects
 * @returns {Array} Edges with linknum and linkTotal added to data
 */
function assignEdgeLinkNumbers(edges) {
    // Group edges by source-target pair
    const edgeGroups = new Map(); // "source-target" -> edges[]

    edges.forEach(edge => {
        const key = `${edge.source}-${edge.target}`;
        if (!edgeGroups.has(key)) {
            edgeGroups.set(key, []);
        }
        edgeGroups.get(key).push(edge);
    });

    // Assign linknum and linkTotal to each edge
    edgeGroups.forEach(group => {
        const total = group.length;
        group.forEach((edge, index) => {
            edge.data.linknum = index + 1;
            edge.data.linkTotal = total;
        });
    });

    return edges;
}

import { hash, serialize } from "@bassline/parser/types";
import { applyForceLayout } from "../layouts/force.js";

/**
 * Transform quads to React Flow node/edge format
 *
 * Nodes: Three nodes per quad - entity, attribute, and value
 * Edges: Two unlabeled edges per quad - entity -> attribute -> value
 *
 * @param {Quad[]} quads - Array of quads from graph
 * @param {Object} [options] - Layout options (passed to force layout)
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
 * // edges: [alice-->age, age-->30, alice-->friend, friend-->bob]
 */
export function quadsToReactFlow(quads, options = {}) {
    // Track unique words/values by their hash
    const wordMap = new Map(); // hash -> {id, label}
    const edges = [];
    const entityIds = new Set(); // Track which nodes are entities (appear as source)

    for (const quad of quads) {
        const [entity, attr, value, group] = quad.values;

        // Register all unique words from this quad
        registerWord(wordMap, entity);
        registerWord(wordMap, attr);
        registerWord(wordMap, value);
        registerWord(wordMap, group);

        // Mark entity as an entity (it's the source of the relationship)
        const entityId = hash(entity).toString();
        entityIds.add(entityId);

        const attrId = hash(attr).toString();
        const valueId = hash(value).toString();
        const quadHashStr = quad.hash().toString();

        // Create two unlabeled edges: entity -> attribute -> value
        edges.push({
            id: `${quadHashStr}-1`,
            source: entityId,
            target: attrId,
            type: "attribute",
            data: {
                context: serialize(group),
                quadHash: quad.hash(),
            },
        });

        edges.push({
            id: `${quadHashStr}-2`,
            source: attrId,
            target: valueId,
            type: "attribute",
            data: {
                context: serialize(group),
                quadHash: quad.hash(),
            },
        });
    }

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

    // Apply force layout
    return applyForceLayout(nodes, edges, options);
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

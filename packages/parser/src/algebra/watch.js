import { Graph } from "./graph.js";
import { matchGraph, rewrite } from "./pattern.js";
import { hash, isWildcard, PatternVar } from "../types.js";

export class WatchedGraph extends Graph {
    constructor(...quads) {
        super(...quads);
        this.rules = new Set();
        this.matches = new Set();

        // Selective activation indexes (hash → Set<Rule>)
        this.entityIndex = new Map();
        this.attributeIndex = new Map();
        this.valueIndex = new Map();
        this.groupIndex = new Map();
        this.wildcardRules = new Set(); // Rules with no literals

        // Quad indexes for NAC checking (hash → Set<Quad>)
        this.entityQuadIndex = new Map();
        this.attributeQuadIndex = new Map();
        this.valueQuadIndex = new Map();
        this.groupQuadIndex = new Map();
    }

    // Extract all literal values from all pattern quads
    extractLiterals(pattern) {
        const entities = new Set();
        const attributes = new Set();
        const values = new Set();
        const groups = new Set();

        for (const pq of pattern.quads) {
            const [e, a, v, g] = pq.values;

            if (!(e instanceof PatternVar || isWildcard(e))) {
                entities.add(e);
            }
            if (!(a instanceof PatternVar || isWildcard(a))) {
                attributes.add(a);
            }
            if (!(v instanceof PatternVar || isWildcard(v))) {
                values.add(v);
            }
            if (!(g instanceof PatternVar || isWildcard(g))) {
                groups.add(g);
            }
        }

        return { entities, attributes, values, groups };
    }

    // Add rule to activation indexes
    indexRule(rule) {
        const { entities, attributes, values, groups } = this.extractLiterals(
            rule.pattern,
        );

        // If no literals, must check on every quad
        if (entities.size + attributes.size + values.size + groups.size === 0) {
            this.wildcardRules.add(rule);
            return;
        }

        // Index by entity literals
        for (const entity of entities) {
            const key = hash(entity);
            if (!this.entityIndex.has(key)) {
                this.entityIndex.set(key, new Set());
            }
            this.entityIndex.get(key).add(rule);
        }

        // Index by attribute literals
        for (const attribute of attributes) {
            const key = hash(attribute);
            if (!this.attributeIndex.has(key)) {
                this.attributeIndex.set(key, new Set());
            }
            this.attributeIndex.get(key).add(rule);
        }

        // Index by value literals
        for (const value of values) {
            const key = hash(value);
            if (!this.valueIndex.has(key)) {
                this.valueIndex.set(key, new Set());
            }
            this.valueIndex.get(key).add(rule);
        }

        // Index by group literals
        for (const group of groups) {
            const key = hash(group);
            if (!this.groupIndex.has(key)) {
                this.groupIndex.set(key, new Set());
            }
            this.groupIndex.get(key).add(rule);
        }
    }

    // Remove rule from activation indexes
    unindexRule(rule) {
        // Remove from wildcard rules
        this.wildcardRules.delete(rule);

        const { entities, attributes, values, groups } = this.extractLiterals(
            rule.pattern,
        );

        // Remove from entity index
        for (const entity of entities) {
            const key = hash(entity);
            const set = this.entityIndex.get(key);
            if (set) {
                set.delete(rule);
                if (set.size === 0) {
                    this.entityIndex.delete(key);
                }
            }
        }

        // Remove from attribute index
        for (const attribute of attributes) {
            const key = hash(attribute);
            const set = this.attributeIndex.get(key);
            if (set) {
                set.delete(rule);
                if (set.size === 0) {
                    this.attributeIndex.delete(key);
                }
            }
        }

        // Remove from value index
        for (const value of values) {
            const key = hash(value);
            const set = this.valueIndex.get(key);
            if (set) {
                set.delete(rule);
                if (set.size === 0) {
                    this.valueIndex.delete(key);
                }
            }
        }

        // Remove from group index
        for (const group of groups) {
            const key = hash(group);
            const set = this.groupIndex.get(key);
            if (set) {
                set.delete(rule);
                if (set.size === 0) {
                    this.groupIndex.delete(key);
                }
            }
        }
    }

    // Add quad to all position indexes for NAC candidate lookup
    indexQuad(quad) {
        const [entity, attribute, value, group] = quad.values;

        // Helper to add to index
        const addToIndex = (index, key, quad) => {
            if (!index.has(key)) {
                index.set(key, new Set());
            }
            index.get(key).add(quad);
        };

        addToIndex(this.entityQuadIndex, hash(entity), quad);
        addToIndex(this.attributeQuadIndex, hash(attribute), quad);
        addToIndex(this.valueQuadIndex, hash(value), quad);
        addToIndex(this.groupQuadIndex, hash(group), quad);
    }

    // Get quads that could match a NAC pattern (O(1) lookup via indexes)
    getCandidateQuads(patternQuad, bindings = {}) {
        const [entity, attribute, value, group] = patternQuad.values;

        // Resolve pattern values (variables → bound values, wildcards → null)
        const resolve = (val) => {
            if (isWildcard(val)) return null;
            if (val instanceof PatternVar) {
                return bindings[val.name] ?? null;
            }
            return val;
        };

        const e = resolve(entity);
        const a = resolve(attribute);
        const v = resolve(value);
        const g = resolve(group);

        // Collect candidate sets from indexes
        const candidateSets = [];
        if (e) candidateSets.push(this.entityQuadIndex.get(hash(e)));
        if (a) candidateSets.push(this.attributeQuadIndex.get(hash(a)));
        if (v) candidateSets.push(this.valueQuadIndex.get(hash(v)));
        if (g) candidateSets.push(this.groupQuadIndex.get(hash(g)));

        // Filter out undefined sets
        const validSets = candidateSets.filter((s) => s !== undefined);

        // No literals → must check all quads
        if (validSets.length === 0) {
            return new Set(this.quads);
        }

        // Intersect sets for maximum selectivity
        // Start with smallest set for efficiency
        validSets.sort((a, b) => a.size - b.size);
        const smallest = validSets[0];

        const candidates = new Set();
        for (const quad of smallest) {
            if (validSets.every((set) => set.has(quad))) {
                candidates.add(quad);
            }
        }

        return candidates;
    }

    // Get rules that could potentially match this quad (O(1) lookup)
    getCandidateRules(quad) {
        const candidates = new Set();

        // Always include wildcard rules
        for (const rule of this.wildcardRules) {
            candidates.add(rule);
        }

        const [entity, attribute, value, group] = quad.values;

        // Add rules indexed by this entity
        const entityRules = this.entityIndex.get(hash(entity));
        if (entityRules) {
            for (const rule of entityRules) {
                candidates.add(rule);
            }
        }

        // Add rules indexed by this attribute
        const attributeRules = this.attributeIndex.get(hash(attribute));
        if (attributeRules) {
            for (const rule of attributeRules) {
                candidates.add(rule);
            }
        }

        // Add rules indexed by this value
        const valueRules = this.valueIndex.get(hash(value));
        if (valueRules) {
            for (const rule of valueRules) {
                candidates.add(rule);
            }
        }

        // Add rules indexed by this group
        const groupRules = this.groupIndex.get(hash(group));
        if (groupRules) {
            for (const rule of groupRules) {
                candidates.add(rule);
            }
        }

        return candidates;
    }
    add(quad) {
        const queue = [quad];

        while (queue.length > 0) {
            const currentQuad = queue.shift();

            super.add(currentQuad);
            this.indexQuad(currentQuad);

            // Process existing partial matches
            for (const entry of this.matches) {
                const { match, production } = entry;
                const wasComplete = match.isComplete();
                match.tryComplete(currentQuad);

                // Check NAC after ANY state change (reject doomed matches immediately)
                if (!match.checkNAC(this)) {
                    this.matches.delete(entry);
                    continue;
                }

                // Only fire production if newly complete
                if (match.isComplete() && !wasComplete) {
                    const productions = production(match);
                    this.matches.delete(entry);
                    queue.push(...productions);
                }
            }

            // Try to match new rules (O(1) selective activation)
            const candidates = this.getCandidateRules(currentQuad);
            for (const rule of candidates) {
                const { pattern, production } = rule;
                const match = pattern.match(currentQuad);
                if (match) {
                    // Check NAC immediately (even for partial matches!)
                    if (!match.checkNAC(this)) {
                        continue; // Reject doomed match, don't add to this.matches
                    }

                    if (match.isComplete()) {
                        const productions = production(match);
                        queue.push(...productions);
                    } else {
                        this.matches.add({ match, production });
                    }
                }
            }
        }
        return this;
    }

    watch(rule) {
        const productions = rewrite(this, [rule]);
        productions.forEach((p) => this.add(p));

        this.rules.add(rule);
        this.indexRule(rule); // Add to activation indexes

        return () => {
            this.rules.delete(rule);
            this.unindexRule(rule); // Remove from activation indexes
        };
    }

    query(pattern) {
        return matchGraph(this, pattern);
    }
}

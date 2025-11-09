import { Graph } from "./graph.js";
import { rewrite } from "./pattern.js";
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

            // Process existing partial matches
            for (const entry of this.matches) {
                const { match, production } = entry;
                match.tryComplete(currentQuad);
                if (match.isComplete()) {
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
}

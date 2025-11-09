import { Quad } from "./quad.js";
import {
    isWildcard,
    PatternVar,
    validateType,
    variable as v,
    WC,
} from "../types.js";
import { valuesEqual } from "../minimal-graph.js";

export class PatternQuad {
    constructor(entity, attribute, value, group = WC) {
        this.values = [
            validateType(entity, "Entity"),
            validateType(attribute, "Attribute"),
            validateType(value, "Value"),
            validateType(group, "Group"),
        ];
    }
    match(sourceQuad, existingBindings = {}, onMatch) {
        if (!(sourceQuad instanceof Quad)) {
            throw new Error(
                `Source quad must be an instance of Quad: ${sourceQuad}`,
            );
        }
        const bindings = { ...existingBindings };
        const matches = sourceQuad.values.every((sourceValue, index) => {
            const thisValue = this.values[index];
            if (isWildcard(thisValue)) {
                return true;
            }
            if (thisValue instanceof PatternVar) {
                const { name } = thisValue;
                const bound = bindings[name];
                if (!bound) {
                    bindings[name] = sourceValue;
                    return true;
                }
                return valuesEqual(sourceValue, bound);
            }
            return valuesEqual(sourceValue, thisValue);
        });
        const returnBindings = matches ? bindings : existingBindings;
        if (onMatch && matches) {
            onMatch(sourceQuad, returnBindings);
        }
    }
}

export class Pattern {
    constructor(...quads) {
        this.quads = quads.map((quad) => {
            if (quad instanceof PatternQuad) {
                return quad;
            }
            if (quad instanceof Quad) {
                return new PatternQuad(...quad.values);
            }
            throw new Error(`Invalid quad: ${quad}`);
        });
        this.nacQuads = [];
    }

    setNAC(...nacQuads) {
        this.nacQuads = nacQuads.map((quad) => {
            if (quad instanceof PatternQuad) {
                return quad;
            }
            if (quad instanceof Quad) {
                return new PatternQuad(...quad.values);
            }
            throw new Error(`Invalid NAC quad: ${quad}`);
        });
        return this;
    }

    /**
     * Attempt to match a quad against any of the patterns
     * For each pattern that matches, we return a new Match object to attempt to fully match the pattern
     * @param {Quad} sourceQuad
     * @returns
     */
    match(sourceQuad) {
        let match;
        for (let i = 0; i < this.quads.length; i++) {
            const quad = this.quads[i];
            quad.match(
                sourceQuad,
                {},
                (matchedQuad, bindings) => {
                    match = new Match(this, bindings);
                    match.quads.push(matchedQuad);
                    match.matchedPatternQuads.add(i);
                },
            );
            if (match) {
                return match;
            }
        }
    }
}

export class Match {
    constructor(pattern, bindings) {
        this.bindings = bindings;
        this.pattern = pattern;
        this.quads = [];
        this.matchedPatternQuads = new Set();
        this.graph = null;
    }
    get(key) {
        let normalKey = key;
        if (typeof key === "string") {
            normalKey = v(key).name;
        }
        if (typeof key === "symbol") {
            return this.bindings[key];
        }
        return this.bindings[normalKey];
    }
    isComplete() {
        return this.matchedPatternQuads.size === this.pattern.quads.length;
    }
    checkNAC() {
        if (!this.pattern.nacQuads?.length || !this.graph) {
            return true;
        }

        // For each NAC pattern quad
        for (const nacQuad of this.pattern.nacQuads) {
            // Scan all quads in graph (quads getter returns array)
            for (const quad of this.graph.quads) {
                // Use existing callback pattern from PatternQuad.match()
                // PatternQuad already handles binding copy/undo internally
                let matched = false;
                nacQuad.match(quad, this.bindings, () => {
                    matched = true;
                });

                if (matched) {
                    return false; // NAC violated - this quad exists
                }
            }
        }

        return true; // No NAC patterns matched
    }
    tryComplete(sourceQuad) {
        for (let i = 0; i < this.pattern.quads.length; i++) {
            if (this.matchedPatternQuads.has(i)) continue;
            const quad = this.pattern.quads[i];
            quad.match(sourceQuad, this.bindings, (matchedQuad, bindings) => {
                this.quads.push(matchedQuad);
                this.bindings = { ...this.bindings, ...bindings };
                this.matchedPatternQuads.add(i);
            });
            if (this.isComplete()) return true;
        }
        return false;
    }
    extendGraph(sourceGraph) {
        if (this.isComplete()) return this;
        for (const quad of sourceGraph.quads) {
            this.tryComplete(quad);
            if (this.isComplete()) return this;
        }
        return this;
    }
}

export const matchGraph = (sourceGraph, pattern) => {
    const matches = [];
    for (const quad of sourceGraph.quads) {
        const match = pattern.match(quad);
        if (match) {
            match.graph = sourceGraph;
            match.extendGraph(sourceGraph);
            if (match.isComplete() && match.checkNAC()) {
                matches.push(match);
            }
        }
    }
    return matches;
};

export const rewrite = (sourceGraph, rules) => {
    return rules.flatMap(({ pattern, production }) => {
        return matchGraph(sourceGraph, pattern)
            .flatMap((match) => {
                const result = production(match);
                return Array.isArray(result) ? result : [result];
            });
    });
};

export const patternQuad = (entity, attribute, value, group) =>
    new PatternQuad(entity, attribute, value, group);
export const pattern = (...quads) => new Pattern(...quads);

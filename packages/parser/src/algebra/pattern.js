import { Quad, quad as q } from "./quad.js";
import {
    isWildcard,
    PatternVar,
    serialize,
    validateType,
    variable as v,
    WC,
    word as w,
} from "../types.js";
import { valuesEqual } from "../minimal-graph.js";
import {
    difference,
    Graph,
    intersection,
    mutableGraph,
    union,
} from "./graph.js";

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
        this.completed = false;
        this.quads = [];
        this.variables = new Set();
        this.matchedPatternQuads = new Set();
        for (const quad of pattern.quads) {
            for (const value of quad.values) {
                if (value instanceof PatternVar) {
                    this.variables.add(value.name);
                }
            }
        }
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

    complete() {
        if (this.completed) {
            return true;
        }
        if (this.matchedPatternQuads.size !== this.pattern.quads.length) {
            return false;
        }
        for (const variable of this.variables) {
            if (!this.bindings[variable]) {
                return false;
            }
        }
        this.completed = true;
        return true;
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

            if (this.complete()) return true;
        }
        return false;
    }

    extendGraph(sourceGraph) {
        if (this.completed) return this;

        for (const quad of sourceGraph.quads) {
            this.tryComplete(quad);
            if (this.completed) return this;
        }

        return this;
    }
}

const matchGraph = (sourceGraph, pattern) => {
    const matches = [];
    for (const quad of sourceGraph.quads) {
        const match = pattern.match(quad);
        if (match) {
            match.extendGraph(sourceGraph);
            if (match.completed) {
                matches.push(match);
            }
        }
    }
    return matches;
};

const rewrite = (sourceGraph, rules) => {
    return rules.flatMap(({ pattern, production }) => {
        return matchGraph(sourceGraph, pattern)
            .map((match) => production(match));
    });
};

export const patternQuad = (entity, attribute, value, group) =>
    new PatternQuad(entity, attribute, value, group);

export const pattern = (...quads) => new Pattern(...quads);

const pq = patternQuad;
function test() {
    const a = new Graph(
        q(
            w("alice"),
            w("likes"),
            w("bob"),
        ),
        q(
            w("bob"),
            w("likes"),
            w("alice"),
        ),
    );
    const b = new Graph(
        q(
            w("carol"),
            w("likes"),
            w("dave"),
        ),
    );

    const mutualLike = new Pattern(
        pq(
            v("X"),
            w("likes"),
            v("Y"),
        ),
        pq(
            v("Y"),
            w("likes"),
            v("X"),
        ),
    );
    const merge = union(a, b);

    const mutable = mutableGraph(...merge.quads);
    const tx = mutable.tx();
    const productions = rewrite(tx, [
        {
            pattern: mutualLike,
            production: (match) => {
                return q(
                    match.get("X"),
                    w("mutual-like"),
                    match.get("Y"),
                );
            },
        },
    ]);
    for (const production of productions) {
        tx.add(production);
    }
    tx.apply();
    for (const quad of mutable.quads) {
        const [entity, attribute, value] = quad.values.slice(0, 3);
        console.log(
            `${serialize(entity)} ${serialize(attribute)} ${serialize(value)}`,
        );
    }
}

test();

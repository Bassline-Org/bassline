import { Quad, quad as q } from "./quad.js";
import {
    isWildcard,
    PatternVar,
    validateType,
    variable as v,
    WC,
    word as w,
} from "../types.js";
import { valuesEqual } from "../minimal-graph.js";
import { difference, Graph, intersection, union } from "./graph.js";

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
    constructor(quads, nacQuads = []) {
        this.quads = quads.map((quad) => {
            if (!(quad instanceof PatternQuad)) {
                throw new Error(
                    `Quad must be an instance of PatternQuad: ${quad}`,
                );
            }
            return quad;
        });
        this.nacQuads = nacQuads.map((quad) => {
            if (!(quad instanceof PatternQuad)) {
                throw new Error(
                    `Quad must be an instance of PatternQuad: ${quad}`,
                );
            }
            return quad;
        });
    }
    checkNac(sourceQuad) {
        let nacMatched = false;
        for (const quad of this.nacQuads) {
            quad.match(
                sourceQuad,
                {},
                (_, bindings) => {
                    nacMatched = true;
                },
            );
        }
        return !nacMatched;
    }
    match(sourceQuad) {
        let match;
        if (!this.checkNac(sourceQuad)) {
            return false;
        }
        for (const quad of this.quads) {
            quad.match(
                sourceQuad,
                {},
                (_, bindings) => {
                    match = new Match(this, bindings);
                },
            );
            if (match) {
                return match;
            }
        }
    }
}

export class Match extends Graph {
    constructor(pattern, bindings) {
        super();
        this.bindings = bindings;
        this.pattern = pattern;
        this.variables = new Set();
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
        for (const variable of this.variables) {
            if (!this.bindings[variable]) {
                return false;
            }
        }
        return true;
    }
    extend(sourceQuad, onMatch) {
        for (const quad of this.pattern.quads) {
            quad.match(sourceQuad, this.bindings, (sourceQuad, bindings) => {
                this.add(sourceQuad);
                this.bindings = { ...this.bindings, ...bindings };
                onMatch?.(sourceQuad, this);
            });
        }
    }
    extendGraph(sourceGraph, onMatch) {
        for (const quad of sourceGraph.quads) {
            this.extend(quad, onMatch);
        }
        return this;
    }
}

export const matchGraph = (sourceGraph, pattern, onMatch) => {
    const matches = [];
    for (const quad of sourceGraph.quads) {
        const match = pattern.match(quad);
        if (match) {
            match.extendGraph(sourceGraph, onMatch);
            matches.push(match);
        }
    }
    const completeMatches = matches.filter((match) => match.complete());
    return union(...completeMatches);
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
    );
    const b = new Graph(
        q(
            w("bob"),
            w("likes"),
            w("carol"),
        ),
    );

    const pattern = new Pattern(
        pq(
            w("alice"),
            w("likes"),
            v("X"),
        ),
        pq(
            v("X"),
            w("likes"),
            v("Y"),
        ),
    );

    const merge = union(a, b);
    console.log("merge: ", merge);
    const diff = difference(a, b);
    console.log("diff: ", diff);
    const inter = intersection(a, b);
    console.log("inter: ", inter);

    const quadMatches = matchGraph(merge, pattern, (s, match) => {
        if (match.get("y")) {
            console.log("matched: ", match.get("y"));
        }
    });
    console.log("quadMatches: ", quadMatches);
}

test();

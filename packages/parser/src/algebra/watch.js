import { Graph } from "./graph.js";
import { pattern, patternQuad, rewrite } from "./pattern.js";
import { serialize, variable as v, word as w } from "../types.js";
import { quad as q } from "./quad.js";

export class WatchedGraph extends Graph {
    constructor(...quads) {
        super(...quads);
        this.rules = new Set();
        this.matches = new Set();
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

            // Try to match new rules
            for (const rule of this.rules) {
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
        return () => {
            this.rules.delete(rule);
        };
    }
}

const graph = new WatchedGraph();
const mutualLike = pattern(
    patternQuad(v("X"), w("likes"), v("Y")),
    patternQuad(v("Y"), w("likes"), v("X")),
);
// Rule 1: Detect reciprocal likes → mutual-like
graph.watch({
    pattern: mutualLike,
    production: (
        match,
    ) => [q(match.get("X"), w("mutual-like"), match.get("Y"))],
});

// Rule 2: mutual-like → friend (cascades!)
graph.watch({
    pattern: pattern(patternQuad(v("X"), w("mutual-like"), v("Y"))),
    production: (match) => [q(match.get("X"), w("friend"), match.get("Y"))],
});

// Add data - should cascade through both rules
graph.add(q(w("alice"), w("likes"), w("bob")));
graph.add(q(w("bob"), w("likes"), w("alice")));

// Should have: likes → mutual-like → friend

for (const quad of graph.quads) {
    const [entity, attribute, value] = quad.values.slice(0, 3);
    console.log(
        `${serialize(entity)} ${serialize(attribute)} ${serialize(value)}`,
    );
}

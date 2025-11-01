import crypto from "crypto";
import * as p from "./parser.js";
import { normalize, TYPES } from "./data.js";
import { CELLS } from "./data.js";

const example = `

link: https://google.com
a: make task! []
foo: make context! []
copy system foo

in foo [
    something: 10
]

b: after a [ something: + something 20 ] foo

after b [
    print concat "from foo " form something
] foo

after b [
    print concat "from system " form something
] system

print "sleeping..."
after sleep 1000 [
    print "yawning"
    schedule a
] self

after sleep 1500 [ print "done" ] self
`;

const ast = p.parse(example);

const matcher = (property) => (value) => {
    const val = value ?? "*";
    const match = (e) => val === "*" ? true : (val === e[property]);
    return (e) => {
        if (Array.isArray(val)) {
            return val.some(match);
        }
        return match(e);
    };
};

const matchSource = matcher("source");
const matchAttr = matcher("attr");
const matchTarget = matcher("target");

const findExact = (...predicates) => (edges) =>
    edges.filter((edge) => predicates.every((p) => p(edge)));
const findAny = (...predicates) => (edges) =>
    edges.filter((edge) => predicates.some((p) => p(edge)));

const queryBuilder = (g) => {
    let builder = {
        queries: [],
        sideEffects: [],
        addQuery: (f) => {
            builder.queries.push(f);
            return builder;
        },
        addSideEffect: (f) => {
            builder.sideEffects.push(f);
            return builder;
        },
        matchFrom(source) {
            builder.match(source, null, null);
            return builder;
        },
        matchTo(target) {
            builder.match(null, null, target);
            return builder;
        },
        matchAttr(attr) {
            builder.match(null, attr, null);
            return builder;
        },
        match(source, attr, target) {
            builder.addQuery(findExact(
                matchSource(source),
                matchAttr(attr),
                matchTarget(target),
            ));
            return builder;
        },
        matchAny(property) {
            builder.addQuery(findAny(
                matchSource(property),
                matchAttr(property),
                matchTarget(property),
            ));
            return builder;
        },
        map(fn) {
            builder.addQuery((edges) => edges.map(fn));
            return builder;
        },
        run(edges = g.edges) {
            const [results] = builder.compute(edges);
            return results;
        },
        // Threads the edges through all of the queries and returns the results and a boolean indicating if any matches were found
        // We need to track this, because if no matches are found, we can discard the edges
        compute: (edges) => {
            let shouldCache = false;
            let results = edges;
            builder.queries.forEach((query, index) => {
                results = query(results);
                // If the first query finds no matches, we can discard the edges
                if (index === 0) {
                    shouldCache = results.length > 0;
                }
            });
            if (results.length > 0) {
                for (const sideEffect of builder.sideEffects) {
                    sideEffect(results);
                }
            }
            return [results, shouldCache];
        },
        enableReactivity: () => {
            if (builder.removeTrigger !== undefined) {
                return builder;
            }
            builder.removeTrigger = g.addTrigger(() =>
                builder.compute(g.edges)
            );
            return builder;
        },
        disableReactivity: () => {
            if (builder.removeTrigger === undefined) {
                return builder;
            }
            builder.removeTrigger();
            delete builder.removeTrigger;
            return builder;
        },
        materialize: () => {
            let partialResults = [];
            let results = [];
            let lastHeight = 0;
            const newEdges = () => g.edges.slice(lastHeight, g.edges.length);

            return () => {
                const prevHeight = lastHeight;
                const prevPartialResults = [...partialResults];
                try {
                    if (lastHeight > g.edges.length) {
                        console.log("Graph rollback, recomputing results");
                        lastHeight = g.edges.length;
                        const [newResults] = builder.compute(g.edges);
                        partialResults = [];
                        return newResults;
                    }

                    const unseen = newEdges();
                    if (unseen.length > 0) {
                        lastHeight = g.edges.length;
                        // We need to process the unseen edges with the partial results
                        const toProcess = partialResults.concat(unseen);

                        const [newResults, shouldCache] = builder.compute(
                            toProcess,
                        );

                        if (!shouldCache) {
                            console.log(
                                "No useful edges, returning cached and discarding unseen",
                            );
                            return results;
                        }

                        if (shouldCache && newResults.length === 0) {
                            console.log("No results, caching unseen");
                            partialResults = toProcess;
                            return results;
                        }

                        console.log("New results, clearing cache");
                        partialResults = [];
                        results = results.concat(newResults);
                        return results;
                    } else {
                        console.log("No new edges, returning cached");
                        return results;
                    }
                } catch (e) {
                    lastHeight = prevHeight;
                    partialResults = prevPartialResults;
                    throw e;
                }
            };
        },
    };
    return builder;
};

const createGraph = (edges = []) => {
    const g = {
        _nodes: new Set(),
        get nodes() {
            if (g._nodeQuery === undefined) {
                g._nodeQuery = g.query()
                    .match("*", "*", "*")
                    .addSideEffect((results) => {
                        for (const result of results) {
                            g._nodes.add(result.source);
                            g._nodes.add(result.attr);
                            g._nodes.add(result.target);
                        }
                    })
                    .enableReactivity()
                    .materialize();
                g._nodeQuery();
            }
            return g._nodes;
        },
        edges,
        constraints: [],
        triggers: [],
        query: () => queryBuilder(g),
        addConstraint: (f) => {
            g.constraints.push(f);
            return () => {
                g.constraints = g.constraints.filter((c) => c !== f);
            };
        },
        addTrigger: (f) => {
            g.triggers.push(f);
            return () => {
                g.triggers = g.triggers.filter((t) => t !== f);
            };
        },
        constraint: (f) => {
            const builder = queryBuilder(g);
            let constraintQuery = f(builder);
            if (typeof constraintQuery !== "function") {
                constraintQuery = builder.materialize();
            }
            try {
                constraintQuery();
            } catch (error) {
                console.error("Constraint not valid on initial state", error);
                return;
            }
            return g.addConstraint(() => {
                constraintQuery();
            });
        },
        runConstraints: () => {
            let valid = true;
            for (const constraint of g.constraints) {
                try {
                    constraint();
                } catch (error) {
                    console.error("Error running constraint", error);
                    valid = false;
                    break;
                }
            }
            return valid;
        },
        runTriggers: (catchErrors = false) => {
            for (const trigger of g.triggers) {
                try {
                    trigger();
                } catch (error) {
                    console.error("Error running trigger", error);
                    if (!catchErrors) {
                        throw error;
                    }
                }
            }
        },
        relate(source, attr, target) {
            g.edges.push({
                source,
                attr,
                target,
            });
            return g;
        },
        tx() {
            let commited = false;
            const txn = {
                changes: [],
                relate: (source, attr, target) => {
                    txn.changes.push({
                        source,
                        attr,
                        target,
                    });
                    return txn;
                },
                commit: () => {
                    if (!commited) {
                        commited = true;
                        const oldEdges = [...g.edges];
                        for (const change of txn.changes) {
                            g.relate(
                                change.source,
                                change.attr,
                                change.target,
                            );
                        }
                        const valid = g.runConstraints();
                        if (!valid) {
                            console.error(
                                "Constraints failed, rolling back",
                            );
                            commited = false;
                            g.edges = oldEdges;
                            return false;
                        }
                        g.runTriggers();
                        return true;
                    }
                },
            };
            return txn;
        },
    };

    g.relate("DATATYPE!", "TYPE?", "DATATYPE!");
    g.relate("TYPE?", "TYPE?", "WORD!");

    return g;
};

const g = createGraph();

const tx = g.tx();
ast.insert(tx);
tx.commit();

const fooValues = g.query()
    .match("*", "SPELLING?", "FOO")
    .map(({ source }) =>
        g.query()
            .match(source, "VALUE?", "*")
            .map(({ target }) => target)
            .run()
    );

console.log(fooValues.run());

g.constraint((builder) => {
    return builder
        .match("*", "SPELLING?", "FOO")
        .addSideEffect((results) => {
            const tx = g.tx();
            for (const { source, attr, target } of results) {
                tx.relate(source, "VALUE?", 69);
            }
            console.log("Committing foo values");
            tx.commit();
        });
});

console.log(fooValues.run());

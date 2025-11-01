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
        hasVariables: false, // Track if any patterns use variables

        addQuery: (f) => {
            builder.queries.push(f);
            return builder;
        },

        addSideEffect: (f) => {
            builder.sideEffects.push(f);
            return builder;
        },

        // Check if value is a variable
        isVar: (val) => typeof val === "string" && val.startsWith("?"),

        matchFrom(source) {
            return builder.match(source, null, null);
        },

        matchTo(target) {
            return builder.match(null, null, target);
        },

        matchAttr(attr) {
            return builder.match(null, attr, null);
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
            builder.addQuery((items) => {
                // If items have bindings, extract edges for the map function
                if (builder.hasVariables && items.length > 0 && items[0].edge) {
                    return items.map((item) => {
                        const result = fn(item.edge);
                        // Preserve bindings through map
                        return { edge: result, bindings: item.bindings };
                    });
                }
                // Original behavior
                return items.map(fn);
            });
            return builder;
        },

        select(...vars) {
            builder.addQuery((items) => {
                return items.map((item) => {
                    const bindings = item.bindings || {};
                    const selected = {};
                    for (const v of vars) {
                        const key = v.startsWith("?") ? v.slice(1) : v;
                        selected[key] = bindings[v];
                    }
                    return selected;
                });
            });
            return builder;
        },

        run(edges = g.edges) {
            const [results] = builder.compute(edges);
            return results;
        },
        match(source, attr, target) {
            const usesVars = builder.isVar(source) || builder.isVar(attr) ||
                builder.isVar(target);
            if (usesVars) builder.hasVariables = true;

            if (usesVars) {
                builder.addQuery((items) => {
                    // Check if items are plain edges (no bindings yet)
                    const isFirstPattern = items.length === 0 ||
                        !items[0].bindings ||
                        Object.keys(items[0].bindings).length === 0;

                    if (isFirstPattern) {
                        // Initialize: filter current edges and create bindings
                        const results = [];
                        for (const edge of items) {
                            const actualEdge = edge.edge || edge; // Handle wrapped or plain
                            const bindings = {};
                            if (
                                matchField(
                                    source,
                                    actualEdge.source,
                                    bindings,
                                ) &&
                                matchField(attr, actualEdge.attr, bindings) &&
                                matchField(target, actualEdge.target, bindings)
                            ) {
                                results.push({ edge: actualEdge, bindings });
                            }
                        }
                        return results;
                    } else {
                        // Extend: for each binding set, find compatible edges from ALL edges
                        return items.flatMap((item) => {
                            const matches = [];
                            for (const edge of g.edges) {
                                const newBindings = { ...item.bindings };
                                if (
                                    matchField(
                                        source,
                                        edge.source,
                                        newBindings,
                                    ) &&
                                    matchField(attr, edge.attr, newBindings) &&
                                    matchField(target, edge.target, newBindings)
                                ) {
                                    // Only add if bindings actually changed (new constraints satisfied)
                                    matches.push({
                                        edge,
                                        bindings: newBindings,
                                    });
                                }
                            }
                            return matches;
                        });
                    }
                });
            } else {
                builder.addQuery(findExact(
                    matchSource(source),
                    matchAttr(attr),
                    matchTarget(target),
                ));
            }

            return builder;
        },

        compute: (edges) => {
            let shouldCache = false;

            // DON'T wrap here - let first pattern do it
            let results = edges;

            builder.queries.forEach((query, index) => {
                results = query(results);
                if (index === 0) {
                    shouldCache = results.length > 0;
                }
            });

            if (results.length > 0) {
                for (const sideEffect of builder.sideEffects) {
                    sideEffect(results);
                }
            }

            // Extract at the end for backwards compat
            if (builder.hasVariables && results.length > 0 && results[0].edge) {
                results = results.map((r) => r.edge);
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
                        lastHeight = g.edges.length;
                        const [newResults] = builder.compute(g.edges);
                        partialResults = [];
                        return newResults;
                    }

                    const unseen = newEdges();
                    if (unseen.length > 0) {
                        lastHeight = g.edges.length;
                        const toProcess = partialResults.concat(unseen);
                        const [newResults, shouldCache] = builder.compute(
                            toProcess,
                        );

                        if (!shouldCache) {
                            return results;
                        }

                        if (shouldCache && newResults.length === 0) {
                            partialResults = toProcess;
                            return results;
                        }

                        partialResults = [];
                        results = results.concat(newResults);
                        return results;
                    } else {
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

    // Helper for variable matching
    function matchField(patternField, edgeField, bindings) {
        if (patternField === null || patternField === "*") return true;

        if (typeof patternField === "string" && patternField.startsWith("?")) {
            if (patternField in bindings) {
                return bindings[patternField] === edgeField;
            }
            bindings[patternField] = edgeField;
            return true;
        }

        if (Array.isArray(patternField)) {
            return patternField.includes(edgeField);
        }

        return patternField === edgeField;
    }

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

//const fooValues = g.query()
//    .match("?x", "SPELLING?", "FOO")
//.match("?x", "VALUE?", "?value")
//    .select("?x");

// console.log(fooValues.run());

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

const fooValues = g.query()
    .match("?x", "SPELLING?", "FOO") // Finds all with SPELLING?=FOO, binds ?x
    .match("?x", "VALUE?", "?value") // Searches ALL edges for ?x -> VALUE? -> ?value
    .select("?value")
    .run();

const blocksWithChildren = g.query()
    .match("?b", "TYPE?", "BLOCK!")
    .match("?child", "PARENT?", "?b")
    .select("?b", "?child")
    .run();

console.log(fooValues);
console.log(blocksWithChildren);

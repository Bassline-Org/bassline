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
        build() {
            return () => {
                const [results] = builder.compute(g.edges);
                return results;
            };
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
        isReactive: false,
        enableReactivity: () => {
            if (builder.isReactive) {
                return builder;
            }
            builder.isReactive = true;
            builder.removeTrigger = g.addTrigger(() =>
                builder.compute(g.edges)
            );
            return builder;
        },
        disableReactivity: () => {
            if (!builder.isReactive) {
                return builder;
            }
            builder.removeTrigger();
            builder.isReactive = false;
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
                    console.log("lastHeight: ", lastHeight);
                    console.log("g.edges.length: ", g.edges.length);
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
                    console.error("Error materializing", e);
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
            }
            return g._nodeQuery();
        },
        edges,
        constraints: [],
        triggers: [],
        query: () => queryBuilder(g),
        addConstraint: (f) => {
            console.log("Adding constraint");
            g.constraints.push(f);
            return () => {
                console.log("Removing constraint");
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
            console.log("Constraint added");
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
                        console.log("Running constraints");
                        const valid = g.runConstraints();
                        if (!valid) {
                            console.error(
                                "Constraints failed, rolling back",
                            );
                            commited = false;
                            g.edges = oldEdges;
                            g.runConstraints();
                        }
                        console.log("Constraints passed, running triggers");
                        g.runTriggers();
                    }
                },
            };
            return txn;
        },
        store(cell) {
            if (
                cell.type === TYPES.block ||
                cell.type === TYPES.paren
            ) {
                cell.value.forEach((item, index) => {
                    const id = g.store(item);
                    g.relate(id, "PARENT?", cell.id);
                    g.relate(cell.id, index.toString(), id);
                    return id;
                });
                g.relate(cell.type, "TYPE?", "DATATYPE!");
                g.relate(cell.id, "TYPE?", cell.type);
                return cell.id;
            }
            if (
                cell.type === TYPES.uri
            ) {
                Object.entries(cell.value)
                    .filter(([k, v]) => v !== null)
                    .map(([k, v]) => {
                        const id = g.store(v);
                        g.relate(cell.id, normalize(k), id);
                        g.relate(id, "PARENT?", cell.id);
                    });

                g.relate(cell.type, "TYPE?", "DATATYPE!");
                g.relate(cell.id, "TYPE?", cell.type);

                return cell.id;
            }
            g.relate(cell.type, "TYPE?", "DATATYPE!");
            g.relate(cell.id, "TYPE?", cell.type);
            return cell.id;
        },
    };

    g.relate("DATATYPE!", "TYPE?", "DATATYPE!");
    g.relate("TYPE?", "TYPE?", "WORD!");

    return g;
};

const g = createGraph();

g.store(ast);

const blocks = g.query()
    .matchTo(["BLOCK!", "PAREN!"])
    .matchAttr("TYPE?")
    .materialize();

const uris = g.query()
    .matchAttr("TYPE?")
    .matchTo("URI!")
    .build();

const allNodes = new Set();
const nodeQuery = g.query()
    .match("*", "*", "*")
    .addSideEffect((results) => {
        for (const result of results) {
            allNodes.add(result.source);
            allNodes.add(result.attr);
            allNodes.add(result.target);
        }
    })
    .materialize();

const hosts = g.query()
    .matchAttr("HOST")
    .build();

//console.log(uris());
const logBlocks = () => {
    console.log(blocks().length);
};

logBlocks();
logBlocks();
logBlocks();

g.relate("FOO", "PARENT?", "BLOCK!");

logBlocks();

g.relate("FOO", "TYPE?", "BLOCK!");
g.relate("BAR", "TYPE?", "BLOCK!");

logBlocks();

nodeQuery();

console.log(allNodes);
const barQuery = g.query()
    .enableReactivity()
    .match("BAR", "PARENT?", null)
    .addSideEffect((results) => {
        console.log("new data: ", results);
    })
    .build();

console.log("bar: ", barQuery(), "\n\n");

const createConstraint = () =>
    g.constraint((builder) => {
        builder
            .match("BAR", "PARENT?", "BLOCK!")
            .addSideEffect(() => {
                throw new Error("NO SETTING BAR PARENT TO BLOCK!");
            });
    });

let removeConstraint = createConstraint();

const tx = g.tx()
    .relate("BAR", "PARENT?", "BLOCK!");

console.log("Attempting first commit");
tx.commit();
console.log("after first commit: ", barQuery(), "\n\n");

console.log("Attempting second commit");
g.tx().relate("FOO", "PARENT?", "BLOCK!").commit();
console.log("after second commit: ", barQuery(), "\n\n");

//console.log("bar: ", barQuery(), "\n\n");

console.log("Removing constraint");
removeConstraint();

console.log("after removing constraint: ", barQuery(), "\n\n");

console.log("Attempting third commit");
tx.commit();
console.log("after third commit: ", barQuery(), "\n\n");

console.log("Creating new constraint");
removeConstraint = createConstraint();

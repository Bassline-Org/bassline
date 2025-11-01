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

const find = (sourceQuery, attrQuery, targetQuery) => {
    const source = sourceQuery ?? "*";
    const attr = attrQuery ?? "*";
    const target = targetQuery ?? "*";
    const sourceMatches = (e) => {
        if (source === "*") {
            return true;
        }
        if (Array.isArray(source)) {
            return source.some((s) => s === e.source);
        }
        return e.source === source;
    };
    const attrMatches = (e) => {
        if (attr === "*") {
            return true;
        }
        if (Array.isArray(attr)) {
            return attr.some((a) => a === e.attr);
        }
        return e.attr === attr;
    };
    const targetMatches = (e) => {
        if (target === "*") {
            return true;
        }
        if (Array.isArray(target)) {
            return target.some((t) => t === e.target);
        }
        return e.target === target;
    };
    return (edges) =>
        edges.filter((e) =>
            sourceMatches(e) && attrMatches(e) && targetMatches(e)
        );
};

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
        from(source) {
            builder.where(source, null, null);
            return builder;
        },
        to(target) {
            builder.where(null, null, target);
            return builder;
        },
        attr(attr) {
            builder.where(null, attr, null);
            return builder;
        },
        where(source, attr, target) {
            builder.addQuery(find(source, attr, target));
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
            for (const query of builder.queries) {
                results = query(results);
                if (results.length > 0) {
                    shouldCache = true;
                }
            }
            if (results.length > 0) {
                for (const sideEffect of builder.sideEffects) {
                    sideEffect(results);
                }
            }
            return [results, shouldCache];
        },
        materialize: () => {
            let partialResults = [];
            let results = [];
            let lastHeight = 0;
            const newEdges = () => g.edges.slice(lastHeight, g.edges.length);

            return () => {
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
            };
        },
    };
    return builder;
};

const createGraph = (nodes = new Map(), edges = []) => {
    const g = {
        nodes,
        edges,
        query: () => queryBuilder(g),
        addNode(id, node) {
            g.nodes.set(id, node);
            return g;
        },
        relate(source, attr, target) {
            g.edges.push({
                source,
                attr,
                target,
            });
        },
        store(cell) {
            if (
                cell.type === TYPES.block ||
                cell.type === TYPES.paren
            ) {
                g.addNode(cell.id, cell.id);

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
                g.addNode(cell.id, cell.id);

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

            g.addNode(cell.id, cell.value);

            g.relate(cell.type, "TYPE?", "DATATYPE!");
            g.relate(cell.id, "TYPE?", cell.type);
            return cell.id;
        },
    };

    g.nodes.set("DATATYPE!", "DATATYPE!");

    return g;
};

const g = createGraph();

g.store(ast);

const blocks = g.query()
    .to(["BLOCK!", "PAREN!"])
    .attr("TYPE?")
    .materialize();

const uris = g.query()
    .attr("TYPE?")
    .to("URI!")
    .build();

const allNodes = new Set();
const nodeQuery = g.query()
    .where("*", "*", "*")
    .addSideEffect((results) => {
        for (const result of results) {
            allNodes.add(result.source);
            allNodes.add(result.attr);
            allNodes.add(result.target);
        }
    })
    .materialize();

const hosts = g.query()
    .attr("HOST")
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

logBlocks();

nodeQuery();

console.log(allNodes);

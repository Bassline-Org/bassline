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

const queryBuilder = (edgeFn) => {
    let builder = {
        query: edgeFn,
        updateQuery: (f) => {
            const oldQuery = builder.query;
            builder.query = () => f(oldQuery());
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
            builder.updateQuery(find(source, attr, target));
            return builder;
        },
        map(fn) {
            builder.updateQuery((edges) => edges.map(fn));
            return builder;
        },
        build() {
            return builder.query;
        },
    };
    return builder;
};

const createGraph = (nodes = new Map(), edges = []) => {
    const g = {
        nodes,
        edges,
        query() {
            return queryBuilder(() => g.edges);
        },
        relate(source, attr, target) {
            g.edges.push({
                source,
                attr,
                target,
            });
        },
        store(cell) {
            g.nodes.set(cell.type, cell.type);
            g.relate(cell.type, "TYPE?", "DATATYPE!");
            g.relate(cell.id, "TYPE?", cell.type);
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
                g.nodes.set(cell.id, cell.id);
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
                g.nodes.set(cell.id, cell.id);
                return cell.id;
            }
            g.nodes.set(cell.id, cell.value);
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
    .build();

const uris = g.query()
    .attr("TYPE?")
    .to("URI!")
    .build();

const hosts = g.query()
    .attr("HOST")
    .build();

//console.log(uris());
console.log(blocks());

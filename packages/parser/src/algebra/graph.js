import { Quad } from "./quad.js";

/**
 * @typedef {Set<import("./quad.js").Quad>} Graph
 * @typedef {import("./quad.js").Quad} Quad
 */

export class Graph {
    constructor(...quads) {
        this._quads = new Map(quads.map((quad) => {
            if (quad instanceof Quad) {
                return [quad.hash(), quad];
            }
            throw new Error(`Invalid quad: ${quad}`);
        }));
    }
    get quads() {
        return Array.from(this._quads.values());
    }
    keys() {
        return Array.from(this._quads.keys());
    }
    get size() {
        return this._quads.size;
    }
    get(key) {
        return this._quads.get(key);
    }
    has(quad) {
        return this._quads.has(quad.hash());
    }
    add(quad) {
        if (this.has(quad)) {
            return this;
        }
        this._quads.set(quad.hash(), quad);
        return this;
    }
    remove(quad) {
        if (!this.has(quad)) {
            return this;
        }
        this._quads.delete(quad.hash());
        return this;
    }
    static fromArray(quads) {
        return new Graph(...quads);
    }
}

export class DiffGraph extends Graph {
    constructor(baseGraph) {
        super();
        this.baseGraph = baseGraph;
        this.additions = new Graph();
        this.removals = new Graph();
    }
    add(quad) {
        if (this.removals.has(quad)) {
            this.removals.remove(quad);
            return this;
        }
        this.additions.add(quad);
        return this;
    }
    remove(quad) {
        if (this.additions.has(quad)) {
            this.additions.remove(quad);
            return this;
        }
        this.removals.add(quad);
        return this;
    }
    get(key) {
        return this.additions.get(key) ?? this.baseGraph.get(key);
    }
    has(quad) {
        return this.additions.has(quad) || this.baseGraph.has(quad);
    }
    keys() {
        return [...this.additions.keys(), ...this.baseGraph.keys()];
    }
    get size() {
        return this.baseGraph.size + this.additions.size - this.removals.size;
    }
    get quads() {
        return [...this.additions.quads, ...this.baseGraph.quads];
    }
    apply() {
        for (const quad of this.additions.quads) {
            this.baseGraph.add(quad);
        }
        for (const quad of this.removals.quads) {
            this.baseGraph.remove(quad);
        }
        delete this.additions;
        delete this.removals;
        return this.baseGraph;
    }
}

export class MutableGraph extends Graph {
    constructor(...quads) {
        super(...quads);
    }
    tx() {
        return new DiffGraph(this);
    }
}

export const mutableGraph = (...quads) => new MutableGraph(...quads);
export const diffGraph = (baseGraph) => new DiffGraph(baseGraph);

export const union = (...graphs) => {
    const quads = graphs.flatMap((graph) => graph.quads);
    return Graph.fromArray(quads);
};

export const difference = (a, b) => {
    const diff = new Set(a.keys()).difference(new Set(b.keys()));
    const diffQuads = diff.values().map((key) => a.get(key) ?? b.get(key));
    return Graph.fromArray(diffQuads);
};

export const intersection = (a, b) => {
    const inter = new Set(a.keys()).intersection(new Set(b.keys()));
    const interQuads = inter.values().map((key) => a.get(key) ?? b.get(key));
    return Graph.fromArray(interQuads);
};
export const emptyGraph = new Graph();

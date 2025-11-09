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
        const h = quad.hash();  // Compute hash once
        if (this._quads.has(h)) {
            return this;
        }
        this._quads.set(h, quad);
        return this;
    }
    remove(quad) {
        const h = quad.hash();  // Compute hash once
        if (!this._quads.has(h)) {
            return this;
        }
        this._quads.delete(h);
        return this;
    }
    static fromArray(quads) {
        return new Graph(...quads);
    }
}

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

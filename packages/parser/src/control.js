import { parseProgram } from "./pattern-parser.js";
import { createBrowserGraph } from "./browser-graph.js";
import { serialize } from "./types.js";

export const serializeQuad = (q) => q.values.map(serialize).join(" ");

export class Control {
    constructor() {
        const { graph, events } = createBrowserGraph();
        this.graph = graph;
        this.events = events;
        this.patterns = {};
        // this.history = [];
        // this.events.addEventListener("quad-added", (e) => {
        //     const quad = e.detail;
        //     this.history.push(quad.hash());
        // });
    }
    setPattern(name, quads) {
        if (typeof name === "string") {
            const key = w(name.trim()).spelling;
            return this.patterns[key] = quads;
        }
        this.patterns[name.spelling] = quads;
    }
    getPattern(name) {
        if (typeof name === "string") {
            const key = w(name.trim()).spelling;
            return this.patterns[key];
        }
        return this.patterns[name.spelling];
    }

    serialize() {
        const quads = this.graph.quads.map(serializeQuad).join("\n  ");
        return `
insert {
  ${quads}
}`;
    }

    run(source) {
        return parseProgram(source.trim())
            .map((cmd) => cmd(this));
    }
}

import { parseProgram } from "./pattern-parser.js";
import { createBrowserGraph } from "./browser-graph.js";
import { Graph } from "./algebra/graph.js";
import { serialize } from "./types.js";

export const serializeQuad = (q) => q.values.map(serialize).join(" ");

export class Control {
    constructor() {
        const { graph, events } = createBrowserGraph();
        this.graph = graph;
        this.events = events;
    }
    add(quad) {
        this.graph.add(quad);
    }
    serialize() {
        const quads = this.graph.quads.map(serializeQuad).join("\n  ");
        return `
insert {
  ${quads}
}`;
    }

    listen(fn) {
        this.events.addEventListener("quad-added", fn);
        return () => this.events.removeEventListener("quad-added", fn);
    }

    run(source) {
        return parseProgram(source.trim())
            .map((cmd) => cmd(this));
    }
}

export class Bus extends EventTarget {
    add(quad) {
        this.dispatchEvent(
            new CustomEvent("quad-added", {
                detail: quad,
            }),
        );
    }
    listen(fn) {
        this.addEventListener("quad-added", fn);
        return () => this.removeEventListener("quad-added", fn);
    }
}

export class LayeredControl {
    constructor() {
        this.layers = {};
        this.versions = {};
    }
    addBus(name) {
        if (this.layers[name]) {
            throw new Error("Must remove the layer before adding a new layer!");
        }
        this.layers[name] = {
            bus: new Bus(),
        };
    }
    addLayer(name) {
        if (this.layers[name]) {
            throw new Error("Must remove the layer before adding a new layer!");
        }
        const control = new Control();
        this.layers[name] = {
            control,
        };
        return control;
    }
    getLayer(name) {
        return this.layers[name];
    }
    route(fromName, toName) {
        const from = this.getLayer(fromName);
        const to = this.getLayer(toName);
        if (from.cleanup) {
            from?.cleanup?.();
        }
        from.output = toName;
        const source = from.control ?? from.bus;
        const target = to.control ?? to.bus;
        const cleanup = source.listen((event) => target.add(event.detail));
        from.cleanup = cleanup;
    }
    removeLayer(name) {
        const { cleanup } = this.getLayer(name) ?? {};
        cleanup?.();
        delete this.layers[name];
    }
    toString() {
        const out = {
            layers: {},
        };
        for (const [name, layer] of Object.entries(this.layers)) {
            const { output, bus, control } = layer;
            const entry = { output };
            if (bus) {
                entry.bus = true;
            }
            if (control) {
                entry.control = control.serialize();
            }
            out.layers[name] = entry;
        }
        return JSON.stringify(out);
    }
    static fromJSON(str) {
        const obj = JSON.parse(str);
        const layers = Object.entries(obj.layers ?? {});
        const layered = new LayeredControl();
        const routes = [];
        for (const [name, layer] of layers) {
            const { bus, control, output } = layer;
            if (bus) {
                layered.addBus(name);
            }
            if (control) {
                const ctrl = layered.addLayer(name);
                ctrl.run(control);
            }
            if (output) {
                routes.push([name, output]);
            }
        }

        for (const [from, to] of routes) {
            layered.route(from, to);
        }

        return layered;
    }
}

const layered = new LayeredControl();

const foo = layered.addLayer("foo");
const bar = layered.addLayer("bar");
const baz = layered.addLayer("baz");
const bus = layered.addBus("foo-bus");

layered.route("foo", "foo-bus");
layered.route("bar", "foo-bus");
layered.route("foo-bus", "baz");

foo.run(`insert { alice cringe true system }`);
bar.run(`insert { bob cringe false system }`);

console.log(baz.run(`query where { alice ?a ?v ?c }`));
const str = layered.toString();
console.log(str);
const materialized = LayeredControl.fromJSON(str);
console.log(materialized);

const materializedBaz = materialized.getLayer("baz").control;
const query = materializedBaz.run("query where { alice ?a ?v ?c } ");
console.log(query);

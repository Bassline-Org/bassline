import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block } from "../values.js";

// Helper: Convert JS value to Bassline value
export function jsToBassline(value, parentContext) {
    if (Array.isArray(value)) {
        return new Block(value.map((v) => jsToBassline(v, parentContext)));
    }
    if (typeof value === "object") {
        const ctx = new Context(parentContext);
        for (const [key, val] of Object.entries(value)) {
            ctx.set(key, jsToBassline(val, parentContext));
        }
        return ctx;
    }
    return value;
}

// Helper: Convert Bassline value to JS value
export function basslineToJs(value) {
    if (isa(value, Block)) {
        return value.items.map(basslineToJs);
    }
    if (value instanceof Context) {
        const obj = {};
        for (const [sym, val] of value.bindings) {
            obj[sym.description] = basslineToJs(val);
        }
        return obj;
    }
    return value;
}

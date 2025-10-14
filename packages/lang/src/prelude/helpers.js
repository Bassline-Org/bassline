import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, LitWord, Num, Paren, SetWord, Str, Word } from "../values.js";

// Helper: Convert JS value to Bassline value
export function jsToBassline(value, parentContext) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value === "number") {
        return new Num(value);
    }
    if (typeof value === "string") {
        return new Str(value);
    }
    if (typeof value === "boolean") {
        return value;
    }
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
    if (isa(value, Num)) {
        return value.value;
    }
    if (isa(value, Str)) {
        return value.value;
    }
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
    if (
        typeof value === "boolean" || typeof value === "number" ||
        typeof value === "string"
    ) {
        return value;
    }
    if (value === null || value === undefined) {
        return null;
    }
    return value;
}

// Deep inspection of a value for UI display
export function inspectValue(val) {
    // Bassline value types
    if (isa(val, Num)) {
        return { type: "num", value: val.value };
    }

    if (isa(val, Str)) {
        return { type: "str", value: val.value };
    }

    if (isa(val, LitWord)) {
        return { type: "lit-word", spelling: val.spelling.description };
    }

    if (isa(val, SetWord)) {
        return { type: "set-word", spelling: val.spelling.description };
    }

    if (isa(val, Word)) {
        return { type: "word", spelling: val.spelling.description };
    }

    if (isa(val, Block)) {
        return {
            type: "block",
            items: val.items.map(inspectValue),
        };
    }

    if (isa(val, Paren)) {
        return {
            type: "paren",
            items: val.items.map(inspectValue),
        };
    }

    // Context inspection
    if (val instanceof Context) {
        const bindings = [];
        const isFunction = val.bindings.has(Symbol.for("_FUNCTION"));

        for (const [sym, value] of val.bindings) {
            const spelling = sym.description;
            // Skip internal metadata and system self-reference
            if (
                spelling === "_FUNCTION" ||
                spelling === "_ARGNAMES" ||
                spelling === "_ARGEVAL" ||
                spelling === "SYSTEM"
            ) {
                continue;
            }
            bindings.push({
                name: spelling,
                value: inspectValue(value),
            });
        }

        if (isFunction) {
            // For functions, also show argument info
            const argNames = val.bindings.get(Symbol.for("_ARGNAMES")) || [];
            const argEval = val.bindings.get(Symbol.for("_ARGEVAL")) || [];

            return {
                type: "function",
                args: argNames.map((name, i) => ({
                    name: name.description,
                    literal: !argEval[i],
                })),
                bindings,
                parent: val.parent ? "[parent context]" : null,
            };
        }

        return {
            type: "context",
            bindings,
            parent: val.parent ? "[parent context]" : null,
        };
    }

    // JS primitives (from evaluation results)
    if (typeof val === "number") {
        return { type: "num", value: val };
    }

    if (typeof val === "string") {
        return { type: "str", value: val };
    }

    if (typeof val === "boolean") {
        return { type: "bool", value: val };
    }

    if (val === null || val === undefined) {
        return { type: "none" };
    }

    // Complex objects (natives, etc.)
    if (val?.call) {
        return { type: "native" };
    }

    // Generic object
    return { type: "object", value: String(val) };
}

// Serialize a value to valid Bassline code
export function moldValue(val) {
    // Bassline value types
    if (isa(val, Num)) {
        return String(val.value);
    }

    if (isa(val, Str)) {
        // Escape quotes in string
        const escaped = val.value.replace(/"/g, '\\"');
        return `"${escaped}"`;
    }

    if (isa(val, LitWord)) {
        return `'${val.spelling.description}`;
    }

    if (isa(val, SetWord)) {
        return `${val.spelling.description}:`;
    }

    if (isa(val, Word)) {
        return val.spelling.description;
    }

    if (isa(val, Block)) {
        const inner = val.items.map(moldValue).join(" ");
        return `[${inner}]`;
    }

    if (isa(val, Paren)) {
        const inner = val.items.map(moldValue).join(" ");
        return `(${inner})`;
    }

    // Context serialization
    if (val instanceof Context) {
        const bindings = [];
        for (const [sym, value] of val.bindings) {
            const spelling = sym.description;
            // Skip internal function metadata and system self-reference
            if (
                spelling === "_FUNCTION" ||
                spelling === "_ARGNAMES" ||
                spelling === "_ARGEVAL" ||
                spelling === "SYSTEM"
            ) {
                continue;
            }
            bindings.push(`${spelling}: ${moldValue(value)}`);
        }

        // Generate code that recreates the context
        // If empty: just "context"
        if (bindings.length === 0) {
            return "context";
        }
        // If has bindings: "in (context) [bindings...]"
        return `in (context) [${bindings.join(" ")}]`;
    }

    // JS primitives (from evaluation results)
    if (typeof val === "number") {
        return String(val);
    }

    if (typeof val === "string") {
        const escaped = val.replace(/"/g, '\\"');
        return `"${escaped}"`;
    }

    if (typeof val === "boolean") {
        return val ? "true" : "false";
    }

    if (val === null || val === undefined) {
        return "none";
    }

    // Complex objects (gadgets, natives, etc.)
    if (val?.call) {
        return "#[native]";
    }

    return "#[object]";
}

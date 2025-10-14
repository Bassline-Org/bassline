import { native, evalValue } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, Str } from "../values.js";
import { evalNext, ex } from "../evaluator.js";

export function installContextOps(context) {
    // context
    // Create a new empty context
    context.set(
        "context",
        native((_stream, context) => {
            return new Context(context); // Parent is current context
        }),
    );

    // in <context> <block>
    // Evaluate block in the given context
    context.set(
        "in",
        native(async (stream, context) => {
            const targetContext = evalValue(stream.next(), context);
            const block = await evalNext(stream, context);

            if (!isa(block, Block)) {
                throw new Error("in expects a block as second argument");
            }

            return ex(targetContext, block);
        }),
    );

    // get <context> <key>
    // Get value from context by key name
    context.set(
        "get",
        native(async (stream, context) => {
            const ctx = await evalNext(stream, context);
            const key = evalValue(stream.next(), context);

            if (!(ctx instanceof Context)) {
                throw new Error("get expects a context as first argument");
            }

            const keyStr = isa(key, Str) ? key.value : String(key);
            return ctx.get(Symbol.for(keyStr.toUpperCase()));
        }),
    );

    // set <context> <key> <value>
    // Set value in context (returns new context)
    context.set(
        "set",
        native(async (stream, context) => {
            const ctx = await evalNext(stream, context);
            const key = evalValue(stream.next(), context);
            const value = await evalNext(stream, context);

            if (!(ctx instanceof Context)) {
                throw new Error("set expects a context as first argument");
            }

            const keyStr = isa(key, Str) ? key.value : String(key);

            // Create new context with updated value
            const newCtx = new Context(ctx.parent);
            for (const [sym, val] of ctx.bindings) {
                newCtx.bindings.set(sym, val);
            }
            newCtx.set(keyStr, value);

            return newCtx;
        }),
    );

    // keys <context>
    // Get all keys from context
    context.set(
        "keys",
        native(async (stream, context) => {
            const ctx = await evalNext(stream, context);

            if (!(ctx instanceof Context)) {
                throw new Error("keys expects a context");
            }

            const keyNames = [];
            for (const [sym] of ctx.bindings) {
                const name = sym.description;
                // Skip internal metadata
                if (name.startsWith("_") || name === "SYSTEM") continue;
                keyNames.push(new Str(name));
            }

            return new Block(keyNames);
        }),
    );

    // values <context>
    // Get all values from context
    context.set(
        "values",
        native(async (stream, context) => {
            const ctx = await evalNext(stream, context);

            if (!(ctx instanceof Context)) {
                throw new Error("values expects a context");
            }

            const vals = [];
            for (const [sym, value] of ctx.bindings) {
                const name = sym.description;
                // Skip internal metadata
                if (name.startsWith("_") || name === "SYSTEM") continue;
                vals.push(value);
            }

            return new Block(vals);
        }),
    );

    // has? <context> <key>
    // Check if context has key
    context.set(
        "has?",
        native(async (stream, context) => {
            const ctx = await evalNext(stream, context);
            const key = evalValue(stream.next(), context);

            if (!(ctx instanceof Context)) {
                throw new Error("has? expects a context as first argument");
            }

            const keyStr = isa(key, Str) ? key.value : String(key);
            const result = ctx.bindings.has(Symbol.for(keyStr.toUpperCase()));
            return result;
        }),
    );
}

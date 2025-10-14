import { Context } from "./context.js";
import { evalValue, native } from "./natives.js";
import { isa, isSelfEvaluating } from "./utils.js";
import { Block, Num, SetWord, Word } from "./values.js";
import { gadgetNative } from "./dialects/gadget.js";
import { linkNative } from "./dialects/link.js";

// Main evaluator for prelude (top-level bassline code)
export function ex(context, code) {
    if (!isa(code, Block)) {
        throw new Error("ex can only be called with a block!");
    }

    let result;
    const stream = code.stream();

    while (!stream.done()) {
        const current = stream.next();

        // Self-evaluating values (numbers, strings, blocks)
        if (isSelfEvaluating(current)) {
            result = current;
            continue;
        }

        // Assignment: var: value
        if (isa(current, SetWord)) {
            result = evalNext(stream, context);
            context.set(current.spelling, result);
            continue;
        }

        // Word lookup/call
        if (isa(current, Word)) {
            const value = context.get(current.spelling);

            // If callable (native or dialect), invoke it
            if (value?.call) {
                result = value.call(stream, context);
            } else {
                result = value;
            }
            continue;
        }
    }

    return result;
}

// Evaluate next value from stream
function evalNext(stream, context) {
    const val = stream.next();
    if (isa(val, Word)) {
        const resolved = context.get(val.spelling);
        // If it's callable, call it
        if (resolved?.call) {
            return resolved.call(stream, context);
        }
        return resolved;
    }
    return val; // Self-evaluating
}

// Create a prelude context with built-in natives
export function createPreludeContext() {
    const context = new Context();

    // --- Dialects ---

    // gadget [block]
    // Define a gadget prototype
    context.set("gadget", gadgetNative);

    // link [block]
    // Create connections between gadgets
    context.set("link", linkNative);

    // --- Gadget operations ---

    // spawn <proto> [<state>]
    // Spawns a gadget instance from a prototype
    context.set(
        "spawn",
        native((stream, context) => {
            const proto = evalValue(stream.next(), context);
            const stateArg = stream.peek();

            let initialState;
            if (stateArg && !isa(stateArg, Word) && !isa(stateArg, SetWord)) {
                // Has explicit state argument
                initialState = evalValue(stream.next(), context);
            } else {
                // Use proto's default
                initialState = proto._initialState ?? 0;
            }

            return proto.spawn(initialState);
        }),
    );

    // send <gadget> <value>
    // Send a value to a gadget (calls receive)
    context.set(
        "send",
        native((stream, context) => {
            const gadget = evalValue(stream.next(), context);
            const input = evalValue(stream.next(), context);
            gadget.receive(input);
        }),
    );

    // current <gadget>
    // Get current state of a gadget
    context.set(
        "current",
        native((stream, context) => {
            const gadget = evalValue(stream.next(), context);
            return gadget.current();
        }),
    );

    // --- Arithmetic ---

    // + <a> <b>
    context.set(
        "+",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a + b);
        }),
    );

    // - <a> <b>
    context.set(
        "-",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a - b);
        }),
    );

    // * <a> <b>
    context.set(
        "*",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a * b);
        }),
    );

    // / <a> <b>
    context.set(
        "/",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a / b);
        }),
    );

    // --- Comparison ---

    // = <a> <b>
    context.set(
        "=",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a === b;
        }),
    );

    // < <a> <b>
    context.set(
        "<",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a < b;
        }),
    );

    // > <a> <b>
    context.set(
        ">",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a > b;
        }),
    );

    // <= <a> <b>
    context.set(
        "<=",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a <= b;
        }),
    );

    // >= <a> <b>
    context.set(
        ">=",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a >= b;
        }),
    );

    // not= <a> <b>
    context.set(
        "not=",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a !== b;
        }),
    );

    // --- Boolean values ---
    context.set("true", true);
    context.set("false", false);

    // --- Context manipulation ---

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
        native((stream, context) => {
            const targetContext = evalValue(stream.next(), context);
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("in expects a block as second argument");
            }

            return ex(targetContext, block);
        }),
    );

    // --- Utilities ---

    // print <value>
    // Print a value to console
    context.set(
        "print",
        native((stream, context) => {
            const value = evalValue(stream.next(), context);
            console.log(value);
        }),
    );

    return context;
}

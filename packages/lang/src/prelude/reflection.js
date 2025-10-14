import { native } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Num, Str, Word } from "../values.js";
import { evalNext } from "../evaluator.js";
import { inspectValue, moldValue } from "./helpers.js";

export function installReflection(context) {
    // print <value>
    // Print a value to console
    context.set(
        "print",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            // Unwrap for display
            if (isa(value, Num) || isa(value, Str)) {
                console.log(value.value);
            } else {
                console.log(value);
            }
        }),
    );

    // mold <value>
    // Serialize a value to valid Bassline code
    context.set(
        "mold",
        native(async (stream, context) => {
            // Evaluate the argument to get the actual value
            const value = await evalNext(stream, context);
            return new Str(moldValue(value));
        }),
    );

    // inspect - deep inspection of any value
    context.set(
        "inspect",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return inspectValue(value);
        }),
    );

    // help - list available functions or get help for a specific function
    context.set(
        "help",
        native(async (stream, context) => {
            // Check if there's an argument (function name to get help for)
            const next = stream.peek();

            if (next === undefined) {
                // No argument - list all available functions
                const functions = [];
                for (const [sym] of context.bindings) {
                    const spelling = sym.description;
                    // Skip internal metadata
                    if (spelling.startsWith("_")) continue;
                    functions.push(spelling);
                }

                // Sort alphabetically
                functions.sort();

                return {
                    type: "help",
                    topic: "all",
                    functions,
                };
            }

            // Get help for specific function
            const nameValue = stream.next();
            let name;

            if (isa(nameValue, Word)) {
                name = nameValue.spelling.description;
            } else {
                return { type: "error", message: "help expects a word" };
            }

            const normalized = Symbol.for(name.toUpperCase());
            if (!context.bindings.has(normalized)) {
                return {
                    type: "help",
                    topic: name,
                    found: false,
                    message: `No function found: ${name}`,
                };
            }

            const value = context.bindings.get(normalized);

            // Return help info based on what it is
            if (value?.call) {
                return {
                    type: "help",
                    topic: name,
                    found: true,
                    kind: "native",
                    description: "Built-in native function",
                };
            }

            if (
                value instanceof Context &&
                value.bindings.has(Symbol.for("_FUNCTION"))
            ) {
                const argNames = value.bindings.get(Symbol.for("_ARGNAMES")) ||
                    [];
                const argEval = value.bindings.get(Symbol.for("_ARGEVAL")) ||
                    [];

                return {
                    type: "help",
                    topic: name,
                    found: true,
                    kind: "function",
                    args: argNames.map((argName, i) => ({
                        name: argName.description,
                        literal: !argEval[i],
                    })),
                };
            }

            return {
                type: "help",
                topic: name,
                found: true,
                kind: "value",
                valueType: typeof value,
            };
        }),
    );
}

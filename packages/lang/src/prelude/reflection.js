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
                const doc = value[Symbol.for("DOC")];
                const args = value[Symbol.for("ARGS")];
                const examples = value[Symbol.for("EXAMPLES")];

                return {
                    type: "help",
                    topic: name,
                    found: true,
                    kind: "native",
                    args: args ? args.map(arg => ({ name: arg, literal: false })) : [],
                    doc: doc || null,
                    examples: examples || null,
                    description: doc || "Built-in native function",
                };
            }

            if (value instanceof Context && value._function) {
                const argNames = value._argNames || [];
                const argEval = value._argEval || [];
                const doc = value.get(Symbol.for("DOC"));
                const examples = value.get(Symbol.for("EXAMPLES"));

                return {
                    type: "help",
                    topic: name,
                    found: true,
                    kind: "function",
                    args: argNames.map((argName, i) => ({
                        name: argName.description,
                        literal: !argEval[i],
                    })),
                    doc: doc ? (isa(doc, Str) ? doc.value : String(doc)) : null,
                    examples: examples,
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

    // doc <function> <doc-string>
    // Add documentation to a function
    context.set(
        "doc",
        native(async (stream, context) => {
            const funcName = stream.next();
            const docString = await evalNext(stream, context);

            if (!isa(funcName, Word)) {
                throw new Error(
                    "doc expects a function name as first argument",
                );
            }

            const name = funcName.spelling;
            const func = context.get(name);

            if (!func || !(func instanceof Context) || !func._function) {
                throw new Error(`${name.description} is not a function`);
            }

            // Set documentation
            func.set(Symbol.for("DOC"), docString);

            return func;
        }),
    );

    // describe 'word
    // Get detailed description of a function or value (takes literal word)
    context.set(
        "describe",
        native(async (stream, context) => {
            const nameValue = stream.next();

            if (!isa(nameValue, Word)) {
                throw new Error("describe expects a word argument");
            }

            const name = nameValue.spelling;
            const value = context.get(name);

            if (!value) {
                return new Str(`${name.description} is not defined.`);
            }

            // For functions, show signature + doc
            if (value instanceof Context && value._function) {
                const argNames = value._argNames || [];
                const argEval = value._argEval || [];
                const doc = value.get(Symbol.for("DOC"));

                const argList = argNames.map((name, i) =>
                    argEval[i] ? name.description : `'${name.description}`
                ).join(" ");

                const signature = `${name.description}: func [${argList}]`;
                const docText = doc
                    ? (isa(doc, Str) ? doc.value : String(doc))
                    : "No documentation available.";

                const description = `${signature}\n\n${docText}`;
                return new Str(description);
            }

            // For native functions
            if (value?.call) {
                const doc = value[Symbol.for("DOC")];
                const args = value[Symbol.for("ARGS")];
                const examples = value[Symbol.for("EXAMPLES")];

                if (doc || args) {
                    // Format native with documentation
                    const argList = args ? args.join(" ") : "";
                    const signature = `${name.description}: native [${argList}]`;
                    const docText = doc || "No documentation available.";

                    let output = `${signature}\n\n${docText}`;

                    if (examples && examples.length > 0) {
                        output += "\n\nExamples:";
                        for (const example of examples) {
                            output += `\n  ${example}`;
                        }
                    }

                    return new Str(output);
                }

                return new Str(
                    `${name.description}: Built-in native function\n\nNo documentation available.`,
                );
            }

            // For other values, show type and molded representation
            const molded = moldValue(value);
            const typeStr = value.constructor?.name || typeof value;
            return new Str(`${name.description}: ${typeStr}\n\nValue: ${molded}`);
        }),
    );
}

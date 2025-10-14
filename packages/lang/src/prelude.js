import { Context } from "./context.js";
import { evalValue, native } from "./natives.js";
import { isa, isSelfEvaluating } from "./utils.js";
import { Block, LitWord, Num, Paren, SetWord, Str, Word } from "./values.js";
import { gadgetNative } from "./dialects/gadget.js";
import { linkNative } from "./dialects/link.js";

// Main evaluator for prelude (top-level bassline code)
export function ex(context, code) {
    if (!isa(code, Block) && !isa(code, Paren)) {
        throw new Error("ex can only be called with a block or paren!");
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
            } // If it's a function, call it
            else if (value?._function) {
                result = callFunction(value, stream, context);
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

    // Paren forces evaluation
    if (isa(val, Paren)) {
        return ex(context, val);
    }

    if (isa(val, Word)) {
        const resolved = context.get(val.spelling);
        // If it's callable, call it
        if (resolved?.call) {
            return resolved.call(stream, context);
        }
        // If it's a function, call it
        if (resolved?._function) {
            return callFunction(resolved, stream, context);
        }
        return resolved;
    }
    return val; // Self-evaluating
}

// Call a function (context) with arguments
function callFunction(funcContext, stream, evalContext) {
    // Create new context extending the function
    const callContext = new Context(funcContext);

    // Bind arguments
    funcContext._argNames.forEach((argName, i) => {
        const shouldEval = funcContext._argEval[i];

        if (shouldEval) {
            // Evaluate argument in calling context
            const argValue = evalNext(stream, evalContext);
            callContext.set(argName, argValue);
        } else {
            // Pass literally - just consume from stream
            const argValue = stream.next();
            callContext.set(argName, argValue);
        }
    });

    // Execute body in call context
    const body = funcContext.get(Symbol.for("BODY"));
    return ex(callContext, body);
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

    // % <a> <b>
    // Modulo (remainder)
    context.set(
        "%",
        native((stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a % b);
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

    // --- Special values ---
    context.set("none", null);

    // --- Iteration & Control Flow ---

    // foreach <word> <series> <body>
    // Iterate over a block, binding each item to word
    context.set(
        "foreach",
        native((stream, context) => {
            const itemWord = stream.next();
            if (!isa(itemWord, Word)) {
                throw new Error("foreach expects a word as first argument");
            }

            const series = evalNext(stream, context);
            const body = stream.next();

            if (!isa(body, Block)) {
                throw new Error("foreach expects a block as body");
            }

            let items;
            if (isa(series, Block)) {
                items = series.items;
            } else if (Array.isArray(series)) {
                items = series;
            } else {
                throw new Error("foreach expects a block or array to iterate");
            }

            let result;
            for (const item of items) {
                // Bind item to the word in context
                context.set(itemWord.spelling, item);
                // Execute body
                result = ex(context, body);
            }

            return result; // Return last result
        }),
    );

    // repeat <n> <body>
    // Repeat body n times
    context.set(
        "repeat",
        native((stream, context) => {
            const n = evalValue(stream.next(), context);
            const body = stream.next();

            if (!isa(body, Block)) {
                throw new Error("repeat expects a block as body");
            }

            let result;
            for (let i = 0; i < n; i++) {
                result = ex(context, body);
            }

            return result; // Return last result
        }),
    );

    // while <condition> <body>
    // Loop while condition is true
    context.set(
        "while",
        native((stream, context) => {
            const conditionBlock = stream.next();
            const body = stream.next();

            if (!isa(conditionBlock, Block)) {
                throw new Error("while expects a block as condition");
            }
            if (!isa(body, Block)) {
                throw new Error("while expects a block as body");
            }

            let result;
            while (true) {
                const conditionResult = ex(context, conditionBlock);
                // Treat falsy values as false
                if (!conditionResult) break;
                result = ex(context, body);
            }

            return result;
        }),
    );

    // if <condition> <body>
    // Execute body if condition is true
    context.set(
        "if",
        native((stream, context) => {
            const condition = evalNext(stream, context);
            const body = stream.next();

            if (!isa(body, Block)) {
                throw new Error("if expects a block as body");
            }

            // Execute body if condition is truthy
            if (condition) {
                return ex(context, body);
            }

            return null;
        }),
    );

    // either <condition> <true-body> <false-body>
    // Execute true-body if condition is true, else false-body
    context.set(
        "either",
        native((stream, context) => {
            const condition = evalNext(stream, context);
            const trueBody = stream.next();
            const falseBody = stream.next();

            if (!isa(trueBody, Block)) {
                throw new Error("either expects a block as true body");
            }
            if (!isa(falseBody, Block)) {
                throw new Error("either expects a block as false body");
            }

            if (condition) {
                return ex(context, trueBody);
            } else {
                return ex(context, falseBody);
            }
        }),
    );

    // --- Series Operations ---

    // first <series>
    // Get first element of a block
    context.set(
        "first",
        native((stream, context) => {
            const series = evalNext(stream, context);
            if (isa(series, Block)) {
                return series.items[0];
            }
            if (Array.isArray(series)) {
                return series[0];
            }
            throw new Error("first expects a block or array");
        }),
    );

    // last <series>
    // Get last element of a block
    context.set(
        "last",
        native((stream, context) => {
            const series = evalNext(stream, context);
            if (isa(series, Block)) {
                return series.items[series.items.length - 1];
            }
            if (Array.isArray(series)) {
                return series[series.length - 1];
            }
            throw new Error("last expects a block or array");
        }),
    );

    // length <series>
    // Get length of a block or string
    context.set(
        "length",
        native((stream, context) => {
            const series = evalNext(stream, context);
            if (isa(series, Block)) {
                return new Num(series.items.length);
            }
            if (isa(series, Str)) {
                return new Num(series.value.length);
            }
            if (Array.isArray(series)) {
                return new Num(series.length);
            }
            if (typeof series === "string") {
                return new Num(series.length);
            }
            throw new Error("length expects a block, string, or array");
        }),
    );

    // append <series> <value>
    // Append value to a block (creates new block)
    context.set(
        "append",
        native((stream, context) => {
            const series = evalNext(stream, context);
            const value = evalNext(stream, context);

            if (isa(series, Block)) {
                return new Block([...series.items, value]);
            }
            if (Array.isArray(series)) {
                return [...series, value];
            }
            throw new Error("append expects a block or array");
        }),
    );

    // insert <series> <value>
    // Insert value at beginning of block (creates new block)
    context.set(
        "insert",
        native((stream, context) => {
            const series = evalNext(stream, context);
            const value = evalNext(stream, context);

            if (isa(series, Block)) {
                return new Block([value, ...series.items]);
            }
            if (Array.isArray(series)) {
                return [value, ...series];
            }
            throw new Error("insert expects a block or array");
        }),
    );

    // at <series> <index>
    // Get slice of block starting at index (1-based)
    context.set(
        "at",
        native((stream, context) => {
            const series = evalNext(stream, context);
            const index = evalValue(stream.next(), context);

            if (isa(series, Block)) {
                return new Block(series.items.slice(index - 1));
            }
            if (Array.isArray(series)) {
                return series.slice(index - 1);
            }
            throw new Error("at expects a block or array");
        }),
    );

    // pick <series> <index>
    // Get element at index (1-based)
    context.set(
        "pick",
        native((stream, context) => {
            const series = evalNext(stream, context);
            const index = evalValue(stream.next(), context);

            if (isa(series, Block)) {
                return series.items[index - 1];
            }
            if (Array.isArray(series)) {
                return series[index - 1];
            }
            throw new Error("pick expects a block or array");
        }),
    );

    // empty? <series>
    // Check if series is empty
    context.set(
        "empty?",
        native((stream, context) => {
            const series = evalNext(stream, context);
            if (isa(series, Block)) {
                return series.items.length === 0;
            }
            if (isa(series, Str)) {
                return series.value.length === 0;
            }
            if (Array.isArray(series)) {
                return series.length === 0;
            }
            if (typeof series === "string") {
                return series.length === 0;
            }
            return false;
        }),
    );

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
            const block = evalNext(stream, context);

            if (!isa(block, Block)) {
                throw new Error("in expects a block as second argument");
            }

            return ex(targetContext, block);
        }),
    );

    // --- Functions ---

    // func <args-block> <body-block>
    // Create a function context
    context.set(
        "func",
        native((stream, context) => {
            const argsBlock = stream.next();
            const bodyBlock = stream.next();

            if (!isa(argsBlock, Block)) {
                throw new Error("func expects a block of arguments");
            }
            if (!isa(bodyBlock, Block)) {
                throw new Error("func expects a body block");
            }

            // Create function context extending current scope
            const funcContext = new Context(context);
            funcContext._function = true;
            funcContext._argNames = [];
            funcContext._argEval = []; // Track which args to evaluate

            // Process argument list
            const argStream = argsBlock.stream();
            while (!argStream.done()) {
                const arg = argStream.next();

                if (isa(arg, LitWord)) {
                    // 'x - literal arg, don't evaluate
                    funcContext.set(arg.spelling, null);
                    funcContext._argNames.push(arg.spelling);
                    funcContext._argEval.push(false);
                } else if (isa(arg, Word)) {
                    // x - normal arg, evaluate
                    funcContext.set(arg.spelling, null);
                    funcContext._argNames.push(arg.spelling);
                    funcContext._argEval.push(true);
                } else {
                    throw new Error(
                        `Invalid argument in func: ${arg.constructor.name}`,
                    );
                }
            }

            // Store body
            funcContext.set("body", bodyBlock);

            return funcContext;
        }),
    );

    // --- Utilities ---

    // print <value>
    // Print a value to console
    context.set(
        "print",
        native((stream, context) => {
            const value = evalNext(stream, context);
            // Unwrap for display
            if (isa(value, Num) || isa(value, Str)) {
                console.log(value.value);
            } else {
                console.log(value);
            }
        }),
    );

    // --- Serialization ---

    // mold <value>
    // Serialize a value to valid Bassline code
    context.set(
        "mold",
        native((stream, context) => {
            // Evaluate the argument to get the actual value
            const value = evalNext(stream, context);
            return new Str(moldValue(value));
        }),
    );

    // --- Type Predicates ---

    context.set(
        "block?",
        native((stream, _context) => {
            const value = stream.next();
            return isa(value, Block);
        }),
    );

    context.set(
        "paren?",
        native((stream, _context) => {
            const value = stream.next();
            return isa(value, Paren);
        }),
    );

    context.set(
        "word?",
        native((stream, _context) => {
            const value = stream.next();
            return isa(value, Word);
        }),
    );

    context.set(
        "num?",
        native((stream, _context) => {
            const value = stream.next();
            return isa(value, Num);
        }),
    );

    context.set(
        "str?",
        native((stream, _context) => {
            const value = stream.next();
            return isa(value, Str);
        }),
    );

    context.set(
        "context?",
        native((stream, context) => {
            const value = evalNext(stream, context);
            return value instanceof Context;
        }),
    );

    // --- Reflection ---

    // inspect - deep inspection of any value
    context.set(
        "inspect",
        native((stream, context) => {
            const value = evalNext(stream, context);
            return inspectValue(value);
        }),
    );

    // help - list available functions or get help for a specific function
    context.set(
        "help",
        native((stream, context) => {
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

    // --- View Dialect ---

    // view <block>
    // Create a view description from a block
    context.set(
        "view",
        native((stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("view expects a block");
            }

            // Parse the view block into a view description
            const components = [];
            const viewStream = block.stream();

            while (!viewStream.done()) {
                const componentName = viewStream.next();

                if (!isa(componentName, Word)) {
                    // Skip non-words (could be values)
                    continue;
                }

                // Get lowercase component name (case-insensitive)
                const name = componentName.spelling.description.toLowerCase();

                // Parse component arguments
                const args = [];
                while (!viewStream.done()) {
                    const next = viewStream.peek();

                    // If it's a word that looks like a component name, stop
                    if (
                        isa(next, Word) &&
                        ["text", "button", "input", "row", "column"].includes(
                            next.spelling.description.toLowerCase(),
                        )
                    ) {
                        break;
                    }

                    const arg = viewStream.next();

                    // Evaluate the argument
                    if (isa(arg, Block)) {
                        // Blocks are kept as-is (for button actions)
                        args.push({ type: "block", value: arg });
                    } else if (isa(arg, Paren)) {
                        // Parens are evaluated
                        const result = ex(context, arg);
                        args.push({ type: "value", value: result });
                    } else if (isa(arg, Word)) {
                        // Words are looked up
                        const value = context.get(arg.spelling);
                        args.push({ type: "value", value });
                    } else if (isa(arg, Str) || isa(arg, Num)) {
                        // Literals
                        args.push({ type: "value", value: arg });
                    } else {
                        args.push({ type: "value", value: arg });
                    }
                }

                components.push({
                    component: name,
                    args,
                });
            }

            return {
                type: "view",
                components,
            };
        }),
    );

    // to-string <value>
    // Convert value to string representation
    context.set(
        "to-string",
        native((stream, context) => {
            const value = evalNext(stream, context);

            if (isa(value, Num)) {
                return new Str(String(value.value));
            }
            if (isa(value, Str)) {
                return value;
            }
            if (typeof value === "number") {
                return new Str(String(value));
            }
            if (typeof value === "string") {
                return new Str(value);
            }
            if (typeof value === "boolean") {
                return new Str(String(value));
            }
            return new Str(String(value));
        }),
    );

    // system - reference to the prelude context itself
    context.set("system", context);

    return context;
}

// Deep inspection of a value for UI display
function inspectValue(val) {
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
function moldValue(val) {
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

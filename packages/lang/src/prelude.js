import { Context } from "./context.js";
import { evalValue, native } from "./natives.js";
import { isa, isSelfEvaluating } from "./utils.js";
import { Block, LitWord, Num, Paren, SetWord, Str, Word } from "./values.js";
import { gadgetNative } from "./dialects/gadget.js";
import { linkNative } from "./dialects/link.js";
import {
    awaitTask,
    cancelTask,
    createTask,
    getAllTasks,
    getTask,
    getTaskStats,
    getTaskStatus,
} from "./async.js";
import {
    createContact,
    describeContact,
    deserializeContact,
    hasCapability,
    serializeContact,
    validateContact,
} from "./contact.js";

// Main evaluator for prelude (top-level bassline code)
export async function ex(context, code) {
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
            result = await evalNext(stream, context);
            context.set(current.spelling, result);
            continue;
        }

        // Word lookup/call
        if (isa(current, Word)) {
            const value = context.get(current.spelling);

            // If callable (native or dialect), invoke it
            if (value?.call) {
                result = await value.call(stream, context);
            } // If it's a function, call it
            else if (value?._function) {
                result = await callFunction(value, stream, context);
            } else {
                result = value;
            }
            continue;
        }
    }

    return result;
}

// Evaluate next value from stream
async function evalNext(stream, context) {
    const val = stream.next();

    // Paren forces evaluation
    if (isa(val, Paren)) {
        return await ex(context, val);
    }

    if (isa(val, Word)) {
        const resolved = context.get(val.spelling);
        // If it's callable, call it
        if (resolved?.call) {
            return await resolved.call(stream, context);
        }
        // If it's a function, call it
        if (resolved?._function) {
            return await callFunction(resolved, stream, context);
        }
        return resolved;
    }
    return val; // Self-evaluating
}

// Call a function (context) with arguments
async function callFunction(funcContext, stream, evalContext) {
    // Create new context extending the function
    const callContext = new Context(funcContext);

    // Bind arguments
    for (let i = 0; i < funcContext._argNames.length; i++) {
        const argName = funcContext._argNames[i];
        const shouldEval = funcContext._argEval[i];

        if (shouldEval) {
            // Evaluate argument in calling context
            const argValue = await evalNext(stream, evalContext);
            callContext.set(argName, argValue);
        } else {
            // Pass literally - just consume from stream
            const argValue = stream.next();
            callContext.set(argName, argValue);
        }
    }

    // Execute body in call context
    const body = funcContext.get(Symbol.for("BODY"));
    return await ex(callContext, body);
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
        native(async (stream, context) => {
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
        native(async (stream, context) => {
            const gadget = evalValue(stream.next(), context);
            const input = evalValue(stream.next(), context);
            gadget.receive(input);
        }),
    );

    // current <gadget>
    // Get current state of a gadget
    context.set(
        "current",
        native(async (stream, context) => {
            const gadget = evalValue(stream.next(), context);
            return gadget.current();
        }),
    );

    // --- Arithmetic ---

    // + <a> <b>
    context.set(
        "+",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a + b);
        }),
    );

    // - <a> <b>
    context.set(
        "-",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a - b);
        }),
    );

    // * <a> <b>
    context.set(
        "*",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a * b);
        }),
    );

    // / <a> <b>
    context.set(
        "/",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a / b);
        }),
    );

    // % <a> <b>
    // Modulo (remainder)
    context.set(
        "%",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a % b);
        }),
    );

    // --- Comparison ---

    // = <a> <b>
    context.set(
        "=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a === b;
        }),
    );

    // < <a> <b>
    context.set(
        "<",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a < b;
        }),
    );

    // > <a> <b>
    context.set(
        ">",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a > b;
        }),
    );

    // <= <a> <b>
    context.set(
        "<=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a <= b;
        }),
    );

    // >= <a> <b>
    context.set(
        ">=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a >= b;
        }),
    );

    // not= <a> <b>
    context.set(
        "not=",
        native(async (stream, context) => {
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
        native(async (stream, context) => {
            const itemWord = stream.next();
            if (!isa(itemWord, Word)) {
                throw new Error("foreach expects a word as first argument");
            }

            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
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
        native(async (stream, context) => {
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
        native(async (stream, context) => {
            const condition = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const condition = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const value = await evalNext(stream, context);

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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const value = await evalNext(stream, context);

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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
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
        native(async (stream, context) => {
            const targetContext = evalValue(stream.next(), context);
            const block = await evalNext(stream, context);

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
        native(async (stream, context) => {
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

    // --- Serialization ---

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

    // --- Type Predicates ---

    context.set(
        "block?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Block);
        }),
    );

    context.set(
        "paren?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Paren);
        }),
    );

    context.set(
        "word?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Word);
        }),
    );

    context.set(
        "num?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Num);
        }),
    );

    context.set(
        "str?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Str);
        }),
    );

    context.set(
        "context?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return value instanceof Context;
        }),
    );

    // --- Reflection ---

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

    // --- View Dialect ---

    // view <block>
    // Create a view description from a block
    context.set(
        "view",
        native(async (stream, context) => {
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

                // Parse component arguments and event handlers
                const args = [];
                const handlers = {};

                while (!viewStream.done()) {
                    const next = viewStream.peek();

                    // If it's a word that looks like a component name, stop
                    if (
                        isa(next, Word) &&
                        ["text", "button", "input", "row", "column", "panel"].includes(
                            next.spelling.description.toLowerCase(),
                        )
                    ) {
                        break;
                    }

                    const arg = viewStream.next();

                    // Check for event handler keywords (on-click, on-change, etc.)
                    if (isa(arg, Word) && arg.spelling.description.toLowerCase().startsWith("on-")) {
                        const eventName = arg.spelling.description.toLowerCase();
                        const actionBlock = viewStream.next();
                        if (isa(actionBlock, Block)) {
                            // Store handler as executable source string using mold
                            handlers[eventName] = moldValue(actionBlock);
                        }
                        continue;
                    }

                    // Evaluate the argument
                    if (isa(arg, Block)) {
                        // Blocks are kept as-is (for legacy button actions or nested views)
                        args.push({ type: "block", value: arg });
                    } else if (isa(arg, Paren)) {
                        // Parens are evaluated
                        const result = await ex(context, arg);
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
                    handlers,
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
        native(async (stream, context) => {
            const value = await evalNext(stream, context);

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

    // --- HTTP Operations ---

    // fetch <url>
    // HTTP GET request, returns response body as string
    context.set(
        "fetch",
        native(async (stream, context) => {
            const url = evalValue(stream.next(), context);
            const urlStr = isa(url, Str) ? url.value : String(url);

            try {
                const response = await fetch(urlStr);
                const text = await response.text();
                return new Str(text);
            } catch (error) {
                throw new Error(`fetch failed: ${error.message}`);
            }
        }),
    );

    // post <url> <data>
    // HTTP POST request with JSON body
    context.set(
        "post",
        native(async (stream, context) => {
            const url = evalValue(stream.next(), context);
            const data = await evalNext(stream, context);

            const urlStr = isa(url, Str) ? url.value : String(url);

            // Convert data to JSON
            let body;
            if (data instanceof Context) {
                const obj = {};
                for (const [sym, value] of data.bindings) {
                    obj[sym.description] = isa(value, Num)
                        ? value.value
                        : isa(value, Str)
                        ? value.value
                        : value;
                }
                body = JSON.stringify(obj);
            } else {
                body = JSON.stringify(data);
            }

            try {
                const response = await fetch(urlStr, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body,
                });
                const text = await response.text();
                return new Str(text);
            } catch (error) {
                throw new Error(`post failed: ${error.message}`);
            }
        }),
    );

    // --- JSON Operations ---

    // parse-json <str>
    // Parse JSON string into Bassline values
    context.set(
        "parse-json",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const jsonStr = isa(str, Str) ? str.value : String(str);

            try {
                const parsed = JSON.parse(jsonStr);
                return jsToBassline(parsed, context);
            } catch (error) {
                throw new Error(`parse-json failed: ${error.message}`);
            }
        }),
    );

    // to-json <value>
    // Convert Bassline value to JSON string
    context.set(
        "to-json",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            const jsValue = basslineToJs(value);
            return new Str(JSON.stringify(jsValue));
        }),
    );

    // --- String Operations ---

    // split <str> <delimiter>
    // Split string by delimiter
    context.set(
        "split",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const delimiter = evalValue(stream.next(), context);

            const strVal = isa(str, Str) ? str.value : String(str);
            const delim = isa(delimiter, Str)
                ? delimiter.value
                : String(delimiter);

            const parts = strVal.split(delim);
            return new Block(parts.map((p) => new Str(p)));
        }),
    );

    // join <list> <delimiter>
    // Join list items with delimiter
    context.set(
        "join",
        native(async (stream, context) => {
            const list = await evalNext(stream, context);
            const delimiter = evalValue(stream.next(), context);

            const delim = isa(delimiter, Str)
                ? delimiter.value
                : String(delimiter);

            let items;
            if (isa(list, Block)) {
                items = list.items;
            } else if (Array.isArray(list)) {
                items = list;
            } else {
                throw new Error("join expects a block or array");
            }

            const strings = items.map((item) => {
                if (isa(item, Str)) return item.value;
                if (isa(item, Num)) return String(item.value);
                return String(item);
            });

            return new Str(strings.join(delim));
        }),
    );

    // trim <str>
    // Remove leading/trailing whitespace
    context.set(
        "trim",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const strVal = isa(str, Str) ? str.value : String(str);
            return new Str(strVal.trim());
        }),
    );

    // uppercase <str>
    // Convert to uppercase
    context.set(
        "uppercase",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const strVal = isa(str, Str) ? str.value : String(str);
            return new Str(strVal.toUpperCase());
        }),
    );

    // lowercase <str>
    // Convert to lowercase
    context.set(
        "lowercase",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const strVal = isa(str, Str) ? str.value : String(str);
            return new Str(strVal.toLowerCase());
        }),
    );

    // --- Context/Map Operations ---

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

    // --- Async Operations ---

    // Create ASYNC_TASKS global context
    const asyncTasksContext = new Context();
    context.set("ASYNC_TASKS", asyncTasksContext);

    // Helper to update ASYNC_TASKS context with current tasks
    function updateAsyncTasksContext() {
        const tasks = getAllTasks();
        tasks.forEach((task) => {
            const taskContext = new Context();
            taskContext.set("id", new Str(task.id));
            taskContext.set("name", new Str(task.name));
            taskContext.set("status", new Str(task.status));
            taskContext.set("startTime", new Num(task.startTime));
            if (task.endTime) {
                taskContext.set("endTime", new Num(task.endTime));
                taskContext.set(
                    "duration",
                    new Num(task.endTime - task.startTime),
                );
            }
            asyncTasksContext.set(task.id, taskContext);
        });
    }

    // async [block]
    // Execute block asynchronously, return task handle immediately
    context.set(
        "async",
        native(async (stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("async expects a block");
            }

            // Create task that executes the block
            const task = createTask(async () => {
                return await ex(context, block);
            }, { name: "async block" });

            // Update ASYNC_TASKS context
            updateAsyncTasksContext();

            // Return task handle as a context
            const taskHandle = new Context();
            taskHandle.set("id", new Str(task.id));
            taskHandle.set("type", new Str("task"));
            taskHandle._taskId = task.id; // Store internal reference
            return taskHandle;
        }),
    );

    // spawn-async [block]
    // Alias for async (same behavior)
    context.set(
        "spawn-async",
        native(async (stream, context) => {
            const block = stream.next();

            if (!isa(block, Block)) {
                throw new Error("spawn-async expects a block");
            }

            const task = createTask(async () => {
                return await ex(context, block);
            }, { name: "spawn-async block" });

            updateAsyncTasksContext();

            const taskHandle = new Context();
            taskHandle.set("id", new Str(task.id));
            taskHandle.set("type", new Str("task"));
            taskHandle._taskId = task.id;
            return taskHandle;
        }),
    );

    // await <task-handle>
    // Wait for task to complete and return result
    context.set(
        "await",
        native(async (stream, context) => {
            const taskHandle = await evalNext(stream, context);

            // Extract task ID from handle
            let taskId;
            if (taskHandle instanceof Context && taskHandle._taskId) {
                taskId = taskHandle._taskId;
            } else if (isa(taskHandle, Str)) {
                taskId = taskHandle.value;
            } else {
                throw new Error("await expects a task handle or task ID");
            }

            const task = getTask(taskId);
            if (!task) {
                throw new Error(`Task not found: ${taskId}`);
            }

            // Wait for task to complete
            const result = await awaitTask(task);

            // Update context
            updateAsyncTasksContext();

            return result;
        }),
    );

    // status <task-handle>
    // Get task status: "pending" | "complete" | "error" | "not-found"
    context.set(
        "status",
        native(async (stream, context) => {
            const taskHandle = await evalNext(stream, context);

            let taskId;
            if (taskHandle instanceof Context && taskHandle._taskId) {
                taskId = taskHandle._taskId;
            } else if (isa(taskHandle, Str)) {
                taskId = taskHandle.value;
            } else {
                throw new Error("status expects a task handle or task ID");
            }

            const status = getTaskStatus(taskId);
            return new Str(status);
        }),
    );

    // cancel <task-handle>
    // Cancel a running task (best effort)
    context.set(
        "cancel",
        native(async (stream, context) => {
            const taskHandle = await evalNext(stream, context);

            let taskId;
            if (taskHandle instanceof Context && taskHandle._taskId) {
                taskId = taskHandle._taskId;
            } else if (isa(taskHandle, Str)) {
                taskId = taskHandle.value;
            } else {
                throw new Error("cancel expects a task handle or task ID");
            }

            const cancelled = cancelTask(taskId);
            updateAsyncTasksContext();
            return cancelled;
        }),
    );

    // task-stats
    // Get statistics about async tasks
    context.set(
        "task-stats",
        native(async () => {
            const stats = getTaskStats();
            const statsContext = new Context();
            statsContext.set("total", new Num(stats.total));
            statsContext.set("pending", new Num(stats.pending));
            statsContext.set("complete", new Num(stats.complete));
            statsContext.set("error", new Num(stats.error));
            statsContext.set("cancelled", new Num(stats.cancelled || 0));
            return statsContext;
        }),
    );

    // --- Contact Protocol ---

    // Create runtime contact automatically
    const runtimeContact = createContact(
        typeof window !== "undefined" ? "Browser REPL" : "Bassline Runtime",
        [], // No endpoints yet
        {},
    );

    // Helper to convert contact to Bassline Context
    function contactToContext(contact) {
        const contactContext = new Context();
        contactContext.set("id", new Str(contact.id));
        contactContext.set("name", new Str(contact.name));

        // Endpoints as block of strings
        const endpointsBlock = new Block(
            contact.endpoints.map((e) => new Str(e)),
        );
        contactContext.set("endpoints", endpointsBlock);

        // Capabilities as block of strings
        const capabilitiesBlock = new Block(
            contact.capabilities.map((c) => new Str(c)),
        );
        contactContext.set("capabilities", capabilitiesBlock);

        contactContext.set("timestamp", new Num(contact.timestamp));

        // Store internal reference
        contactContext._contact = contact;

        return contactContext;
    }

    // Helper to extract contact from Context
    function contextToContact(ctx) {
        if (ctx._contact) {
            return ctx._contact;
        }

        // Extract from context
        const id = ctx.get(Symbol.for("ID"));
        const name = ctx.get(Symbol.for("NAME"));
        const endpoints = ctx.get(Symbol.for("ENDPOINTS"));
        const capabilities = ctx.get(Symbol.for("CAPABILITIES"));

        return {
            id: isa(id, Str) ? id.value : String(id),
            name: isa(name, Str) ? name.value : String(name),
            endpoints: endpoints && isa(endpoints, Block)
                ? endpoints.items.map((e) => isa(e, Str) ? e.value : String(e))
                : [],
            capabilities: capabilities && isa(capabilities, Block)
                ? capabilities.items.map((c) =>
                    isa(c, Str) ? c.value : String(c)
                )
                : [],
            timestamp: Date.now(),
        };
    }

    // RUNTIME_CONTACT - global contact for this runtime
    context.set("RUNTIME_CONTACT", contactToContext(runtimeContact));

    // make-contact <name> <endpoints-block>
    // Create a new contact
    context.set(
        "make-contact",
        native(async (stream, context) => {
            const name = evalValue(stream.next(), context);
            const endpoints = await evalNext(stream, context);

            const nameStr = isa(name, Str) ? name.value : String(name);

            let endpointsArray = [];
            if (isa(endpoints, Block)) {
                endpointsArray = endpoints.items.map((e) =>
                    isa(e, Str) ? e.value : String(e)
                );
            }

            const contact = createContact(nameStr, endpointsArray);
            return contactToContext(contact);
        }),
    );

    // parse-contact <json-str>
    // Deserialize contact from JSON string
    context.set(
        "parse-contact",
        native(async (stream, context) => {
            const jsonStr = evalValue(stream.next(), context);
            const json = isa(jsonStr, Str) ? jsonStr.value : String(jsonStr);

            try {
                const contact = deserializeContact(json);
                return contactToContext(contact);
            } catch (error) {
                throw new Error(`parse-contact failed: ${error.message}`);
            }
        }),
    );

    // to-contact-json <contact>
    // Serialize contact to JSON string
    context.set(
        "to-contact-json",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("to-contact-json expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const json = serializeContact(contact);
            return new Str(json);
        }),
    );

    // contact-has? <contact> <capability>
    // Check if contact has a capability
    context.set(
        "contact-has?",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);
            const capability = evalValue(stream.next(), context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("contact-has? expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const capStr = isa(capability, Str)
                ? capability.value
                : String(capability);
            return hasCapability(contact, capStr);
        }),
    );

    // describe-contact <contact>
    // Get human-readable description of contact
    context.set(
        "describe-contact",
        native(async (stream, context) => {
            const contactCtx = await evalNext(stream, context);

            if (!(contactCtx instanceof Context)) {
                throw new Error("describe-contact expects a contact context");
            }

            const contact = contextToContact(contactCtx);
            const description = describeContact(contact);
            return new Str(description);
        }),
    );

    // --- Remote Operations ---

    // Create REMOTE_PEERS global context
    const remotePeersContext = new Context();
    context.set("REMOTE_PEERS", remotePeersContext);

    // Helper to deserialize RPC response value
    function deserializeRPCValue(value) {
        if (!value || typeof value !== "object") {
            return value;
        }

        if (value.type === "num") {
            return new Num(value.value);
        }
        if (value.type === "str") {
            return new Str(value.value);
        }
        if (value.type === "block") {
            return new Block(value.items.map(deserializeRPCValue));
        }
        if (value.type === "context") {
            const ctx = new Context();
            for (const [key, val] of Object.entries(value.bindings)) {
                ctx.set(key, deserializeRPCValue(val));
            }
            return ctx;
        }

        return value;
    }

    // remote connect <url-or-contact>
    // Connect to a remote Bassline runtime
    context.set(
        "remote",
        native(async (stream, context) => {
            const command = stream.next();

            if (!isa(command, Word)) {
                throw new Error(
                    "remote expects a command (connect, exec, disconnect)",
                );
            }

            const commandStr = command.spelling.description.toLowerCase();

            if (commandStr === "connect") {
                const urlOrContact = await evalNext(stream, context);

                let url;
                if (isa(urlOrContact, Str)) {
                    url = urlOrContact.value;
                } else if (urlOrContact instanceof Context) {
                    // Extract URL from contact endpoints
                    const endpoints = urlOrContact.get(Symbol.for("ENDPOINTS"));
                    if (
                        endpoints && isa(endpoints, Block) &&
                        endpoints.items.length > 0
                    ) {
                        url = endpoints.items[0].value;
                    } else {
                        throw new Error("Contact has no endpoints");
                    }
                } else {
                    throw new Error(
                        "remote connect expects a URL string or contact",
                    );
                }

                // Only available in browser
                if (typeof WebSocket === "undefined") {
                    throw new Error(
                        "WebSocket not available in this environment",
                    );
                }

                // Import WebSocket client dynamically
                const { createRPCClient } = await import(
                    "./transports/websocket-client.js"
                );

                // Create connection
                const rpcClient = createRPCClient(url, {
                    maxReconnectAttempts: 3,
                });

                // Connect
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("Connection timeout"));
                    }, 5000);

                    rpcClient.on("open", () => {
                        clearTimeout(timeout);

                        // Create peer handle
                        const peerHandle = new Context();
                        peerHandle.set("url", new Str(url));
                        peerHandle.set("status", new Str("connected"));
                        peerHandle.set("connected-at", new Num(Date.now()));
                        peerHandle._rpcClient = rpcClient;

                        // Store in REMOTE_PEERS
                        remotePeersContext.set(url, peerHandle);

                        resolve(peerHandle);
                    });

                    rpcClient.on("error", (error) => {
                        clearTimeout(timeout);
                        reject(error);
                    });

                    rpcClient.connect();
                });
            } else if (commandStr === "exec") {
                const peerHandle = await evalNext(stream, context);
                const codeBlock = stream.next();

                if (
                    !(peerHandle instanceof Context) || !peerHandle._rpcClient
                ) {
                    throw new Error(
                        "remote exec expects a peer handle from remote connect",
                    );
                }

                if (!isa(codeBlock, Block)) {
                    throw new Error("remote exec expects a code block");
                }

                // Serialize the code block to Bassline code string
                const code = codeBlock.items
                    .map((item) => {
                        if (isa(item, Num)) return String(item.value);
                        if (isa(item, Str)) return `"${item.value}"`;
                        if (isa(item, Word)) return item.spelling.description;
                        return String(item);
                    })
                    .join(" ");

                // Execute on remote via RPC
                const task = createTask(async () => {
                    const result = await peerHandle._rpcClient.call("eval", {
                        code,
                    });

                    if (!result.ok) {
                        throw new Error(
                            result.error || "Remote execution failed",
                        );
                    }

                    return deserializeRPCValue(result.value);
                }, { name: `remote exec: ${code.substring(0, 50)}...` });

                updateAsyncTasksContext();

                // Return task handle
                const taskHandle = new Context();
                taskHandle.set("id", new Str(task.id));
                taskHandle.set("type", new Str("task"));
                taskHandle._taskId = task.id;
                return taskHandle;
            } else if (commandStr === "disconnect") {
                const peerHandle = await evalNext(stream, context);

                if (
                    !(peerHandle instanceof Context) || !peerHandle._rpcClient
                ) {
                    throw new Error("remote disconnect expects a peer handle");
                }

                peerHandle._rpcClient.disconnect();

                // Update status
                peerHandle.set("status", new Str("disconnected"));

                return true;
            } else {
                throw new Error(`Unknown remote command: ${commandStr}`);
            }
        }),
    );

    // system - reference to the prelude context itself
    context.set("system", context);

    return context;
}

// Helper: Convert JS value to Bassline value
function jsToBassline(value, parentContext) {
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
function basslineToJs(value) {
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

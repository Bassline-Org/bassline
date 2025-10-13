import {
    BlockCell,
    GetWordCell,
    LitWordCell,
    NoneCell,
    NumberCell,
    ParenCell,
    PathCell,
    RefinementCell,
    SetWordCell,
    StringCell,
    WordCell,
} from "./index.js";
import net from "net";
import { Context, GLOBAL } from "../context.js";
import { ApplicableCell } from "./base.js";

// Update the existing mold helper to be more comprehensive:
function mold(cell) {
    if (cell instanceof NoneCell) {
        return "none";
    }

    if (cell instanceof NumberCell) {
        return String(cell.value);
    }

    // Strings with proper escaping
    if (cell instanceof StringCell) {
        const str = cell.buffer.join("");
        const escaped = str
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t")
            .replace(/\r/g, "\\r");
        return '"' + escaped + '"';
    }

    // Word types
    if (cell instanceof SetWordCell) {
        return String(cell.spelling.description || cell.spelling) + ":";
    }
    if (cell instanceof GetWordCell) {
        return ":" + String(cell.spelling.description || cell.spelling);
    }
    if (cell instanceof LitWordCell) {
        return "'" + String(cell.spelling.description || cell.spelling);
    }
    if (cell instanceof WordCell) {
        return String(cell.spelling.description || cell.spelling);
    }
    if (cell instanceof RefinementCell) {
        return "/" + String(cell.spelling.description || cell.spelling);
    }

    // Series types
    if (cell instanceof BlockCell) {
        const items = [];
        let pos = cell.head();
        while (!pos.isTail()) {
            items.push(mold(pos.first()));
            pos = pos.next();
        }
        return "[" + items.join(" ") + "]";
    }

    if (cell instanceof ParenCell) {
        const items = [];
        let pos = cell.head();
        while (!pos.isTail()) {
            items.push(mold(pos.first()));
            pos = pos.next();
        }
        return "(" + items.join(" ") + ")";
    }

    if (cell instanceof PathCell) {
        const items = [];
        let pos = cell.head();
        while (!pos.isTail()) {
            // For paths, don't use full mold, just get the word/number
            const part = pos.first();
            if (part instanceof NumberCell) {
                items.push(String(part.value));
            } else if (part instanceof WordCell || part.typeName === "word") {
                items.push(String(part.spelling.description || part.spelling));
            } else {
                items.push(mold(part));
            }
            pos = pos.next();
        }
        return items.join("/");
    }

    // Objects (contexts)
    if (cell instanceof Context) {
        return "#[object!]"; // Or could do make object! [...]
    }

    // Functions
    if (cell.typeName === "function") {
        return "#[function!]";
    }

    // Natives
    if (cell.typeName === "native") {
        return "#[native!]";
    }

    // Fallback
    return `#[${cell.typeName}!]`;
}

/**
 * Native function cell - built-in operations implemented in JavaScript
 */
export class NativeFn extends ApplicableCell {
    isNativeCell = true;
    constructor(fn) {
        super();
        this.fn = fn;
    }
    evaluate(control, word) {
        if (!this.fn) {
            throw new Error(
                "No evaluation set for this native function! " + word.spelling,
                "Please set it properly: ",
                this,
            );
        }
        return this.fn(control, word);
    }
}

export function nativeFn(name, fn) {
    const native = new NativeFn(fn);
    GLOBAL.set(name, native);
    return native;
}

/**
 * Registers a new native type, for use with make!
 * @param {*} name
 * @param {*} builder - A function with two arguments: the spec and the word
 * @returns {void}
 */
export function nativeType(name, builder) {
    let typeName = name;
    if (!typeName.endsWith("!")) {
        typeName += "!";
    }
    if (builder.length !== 2) {
        throw new Error(
            `Data type builder must take exactly two arguments! Received a function with ${builder.length} arguments!`,
        );
    }
    builder.isNativeType = true;
    GLOBAL.set(typeName, builder);
}

// /**
//  * Check if a value is "truthy" in REBOL terms
//  * In REBOL: none and false are false, everything else is true
//  */
// function isTrue(cell) {
//     if (cell instanceof NoneCell) return false;
//     if (cell instanceof NumberCell && cell.value === 0) return false;
//     return true;
// }
// /**
//  * Recursively compose a block
//  * - Parens get evaluated and their result spliced in
//  * - Nested blocks get composed recursively
//  * - Everything else stays literal
//  */
// function composeBlock(block, evaluator) {
//     const results = [];
//     let pos = block.head();

//     while (!pos.isTail()) {
//         const cell = pos.first();

//         if (cell instanceof ParenCell) {
//             // Evaluate paren and include result
//             const result = evaluator.doBlock(cell);
//             results.push(result);
//         } else if (cell instanceof BlockCell) {
//             // Recursively compose nested blocks
//             const composed = composeBlock(cell, evaluator);
//             results.push(composed);
//         } else {
//             // Everything else stays literal (unevaluated)
//             results.push(cell);
//         }

//         pos = pos.next();
//     }

//     return make.block(results);
// }

// /**
//  * Create and return all native functions
//  * This is a function so it executes after NativeCell is defined
//  */
// export const NATIVES = {
//     "func": new NativeCell("func", [":spec", ":body"], ([spec, body]) => {
//         return makeFunc(spec, body);
//     }),
//     "mold": new NativeCell("mold", ["value"], ([value]) => {
//         return make.string(mold(value));
//     }),

//     "make": new NativeCell(
//         "make",
//         [":type", "spec"],
//         ([type, spec], evaluator) => {
//             // Check if type is the word 'object!'
//             if (
//                 type.typeName === "word" &&
//                 type.spelling === normalize("object!")
//             ) {
//                 return makeObject(spec, evaluator);
//             }

//             throw new Error(`make: unsupported type ${type.typeName}`);
//         },
//     ),
//     "spawn-async": new NativeCell(
//         "spawn-async",
//         [":body"],
//         ([body], evaluator) => {
//             // Execute body asynchronously (non-blocking)
//             if (!isSeries(body)) {
//                 throw new Error("spawn-async: body must be a block");
//             }

//             // Bind body to current context
//             const bodyCopy = deepCopy(body);
//             bind(bodyCopy, GLOBAL);

//             // Execute in next tick (simple async)
//             setImmediate(() => {
//                 try {
//                     evaluator.doBlock(bodyCopy);
//                 } catch (e) {
//                     console.error("Async task error:", e);
//                 }
//             });

//             return make.none();
//         },
//     ),
//     "shell": new NativeCell("shell", ["command"], ([command]) => {
//         if (!(command instanceof StringCell)) {
//             throw new Error("shell: command must be a string");
//         }

//         const cmd = command.buffer.join("");

//         try {
//             const output = execSync(cmd, { encoding: "utf8" });
//             return make.string(output);
//         } catch (e) {
//             throw new Error(`shell: command failed: ${e.message}`);
//         }
//     }),

//     "spawn": new NativeCell("spawn", ["command"], ([command]) => {
//         if (!(command instanceof StringCell)) {
//             throw new Error("spawn: command must be a string");
//         }

//         const cmd = command.buffer.join("");

//         // Parse command and args
//         const parts = cmd.split(" ");
//         const proc = spawn(parts[0], parts.slice(1));

//         // Return process object
//         const procObj = new Context();
//         procObj.set(normalize("pid"), make.num(proc.pid));

//         // Add methods to write/read
//         procObj.set(
//             normalize("write"),
//             new NativeCell("write", ["data"], ([data]) => {
//                 const str = data.buffer.join("");
//                 proc.stdin.write(str + "\n");
//                 return make.none();
//             }),
//         );

//         // Store output
//         let output = "";
//         proc.stdout.on("data", (data) => {
//             output += data.toString();
//         });

//         procObj.set(
//             normalize("read"),
//             new NativeCell("read", [], () => {
//                 const result = output;
//                 output = ""; // Clear buffer
//                 return make.string(result);
//             }),
//         );

//         return procObj;
//     }),
//     "wait": new NativeCell("wait", ["seconds"], ([seconds]) => {
//         if (!(seconds instanceof NumberCell)) {
//             throw new Error("wait: argument must be a number");
//         }

//         // Synchronous sleep (blocks)
//         const ms = seconds.value * 1000;
//         const start = Date.now();
//         while (Date.now() - start < ms) {
//             // Busy wait (not ideal but simple)
//         }

//         return make.none();
//     }),

//     "forever": new NativeCell("forever", [":body"], ([body], evaluator) => {
//         if (!isSeries(body)) {
//             throw new Error("forever: body must be a block");
//         }

//         const bodyCopy = deepCopy(body);
//         bind(bodyCopy, GLOBAL);

//         // Run forever (blocking)
//         // Can break with error or external signal
//         while (true) {
//             evaluator.doBlock(bodyCopy);
//         }
//     }),
//     "foreach": new NativeCell(
//         "foreach",
//         [":word", "series", ":body"],
//         ([word, series, body], evaluator) => {
//             if (!isSeries(series)) {
//                 throw new Error("foreach: second argument must be a series");
//             }
//             if (!isAnyWord(word)) {
//                 throw new Error("foreach: first argument must be a word");
//             }
//             if (!isSeries(body)) {
//                 throw new Error("foreach: body must be a block");
//             }

//             // Create context for iteration variable
//             const loopContext = new Context();
//             loopContext.set(word.spelling, make.none());

//             // Bind body to loop context
//             const bodyCopy = deepCopy(body);
//             bind(bodyCopy, loopContext);

//             let result = make.none();
//             let pos = series.head();

//             while (!pos.isTail()) {
//                 const element = pos.first();

//                 // Set iteration variable
//                 loopContext.set(word.spelling, element);

//                 // Execute body
//                 result = evaluator.doBlock(bodyCopy);

//                 pos = pos.next();
//             }

//             return result;
//         },
//     ),
//     "listen": new NativeCell("listen", ["port"], ([port]) => {
//         if (!(port instanceof NumberCell)) {
//             throw new Error("listen: port must be a number");
//         }
//         const portNum = port.value;

//         const server = net.createServer();
//         const serverObj = new Context();

//         server.on("connection", (socket) => {
//             let buffer = "";

//             socket.on("data", (data) => {
//                 buffer += data.toString();

//                 // Process complete messages (newline delimited)
//                 const lines = buffer.split("\n");
//                 buffer = lines.pop() || ""; // Keep incomplete line

//                 lines.forEach((line) => {
//                     if (line.trim()) {
//                         try {
//                             // Parse and emit message event
//                             const msg = parse(line);
//                             bind(msg, GLOBAL);

//                             // Get evaluator from somewhere... this is tricky
//                             // For now, store raw message
//                             const msgData = make.block([msg.first()]);

//                             // Emit to server's message handlers
//                             const handlersKey = normalize(`__handlers_message`);
//                             const handlers = serverObj.get(handlersKey);

//                             if (handlers && isSeries(handlers)) {
//                                 let pos = handlers.head();
//                                 while (!pos.isTail()) {
//                                     const handler = pos.first();
//                                     const eventCtx = new Context();
//                                     eventCtx.set(
//                                         normalize("data"),
//                                         msg.first(),
//                                     );

//                                     const handlerCopy = deepCopy(handler);
//                                     bind(handlerCopy, eventCtx);

//                                     // Need evaluator... store for async use
//                                     const globalEval = new Evaluator();
//                                     globalEval.doBlock(handlerCopy);

//                                     pos = pos.next();
//                                 }
//                             }
//                         } catch (e) {
//                             console.error("Parse error:", e.message);
//                         }
//                     }
//                 });
//             });

//             socket.on("error", (err) => {
//                 console.error("Socket error:", err.message);
//             });
//         });

//         server.listen(portNum, () => {
//             console.log(`Server listening on port ${portNum}`);
//         });

//         serverObj.set(normalize("port"), make.num(portNum));

//         return serverObj;
//     }),
//     "connect": new NativeCell("connect", ["host", "port"], ([host, port]) => {
//         if (!(host instanceof StringCell)) {
//             throw new Error("connect: host must be a string");
//         }
//         if (!(port instanceof NumberCell)) {
//             throw new Error("connect: port must be a number");
//         }

//         const hostStr = host.buffer.join("");
//         const portNum = port.value;

//         const socket = net.connect(portNum, hostStr);
//         const connObj = new Context();

//         let buffer = "";

//         socket.on("data", (data) => {
//             buffer += data.toString();

//             const lines = buffer.split("\n");
//             buffer = lines.pop() || "";

//             lines.forEach((line) => {
//                 if (line.trim()) {
//                     try {
//                         const msg = parse(line);
//                         bind(msg, GLOBAL);

//                         const handlersKey = normalize(`__handlers_message`);
//                         const handlers = connObj.get(handlersKey);

//                         if (handlers && isSeries(handlers)) {
//                             let pos = handlers.head();
//                             while (!pos.isTail()) {
//                                 const handler = pos.first();
//                                 const eventCtx = new Context();
//                                 eventCtx.set(normalize("data"), msg.first());

//                                 const handlerCopy = deepCopy(handler);
//                                 bind(handlerCopy, eventCtx);

//                                 const globalEval = new Evaluator();
//                                 globalEval.doBlock(handlerCopy);

//                                 pos = pos.next();
//                             }
//                         }
//                     } catch (e) {
//                         console.error("Parse error:", e.message);
//                     }
//                 }
//             });
//         });

//         socket.on("connect", () => {
//             console.log("Connected to server");
//         });

//         socket.on("error", (err) => {
//             console.error("Connection error:", err.message);
//         });

//         // Send method
//         connObj.set(
//             normalize("send"),
//             new NativeCell("send", ["data"], ([data]) => {
//                 const str = mold(data);
//                 socket.write(str + "\n");
//                 return make.none();
//             }).freeze(),
//         );

//         return connObj;
//     }),

//     "on": new NativeCell(
//         "on",
//         ["emitter", ":event", ":handler"],
//         ([emitter, event, handler], evaluator) => {
//             if (!(emitter instanceof Context)) {
//                 throw new Error("on: first argument must be an object");
//             }

//             const eventName = String(
//                 event.spelling.description || event.spelling,
//             );
//             const handlersKey = normalize(`__handlers_${eventName}`);

//             // Get or create handlers list
//             let handlers = emitter.get(handlersKey);
//             if (!handlers) {
//                 handlers = make.block([]);
//                 emitter.set(handlersKey, handlers);
//             }

//             // Add handler (clone it for binding later)
//             const handlerCopy = deepCopy(handler);
//             handlers.buffer.push(handlerCopy);

//             return make.none();
//         },
//     ),

//     "emit": new NativeCell(
//         "emit",
//         ["emitter", ":event", "data"],
//         ([emitter, event, data], evaluator) => {
//             if (!(emitter instanceof Context)) {
//                 throw new Error("emit: first argument must be an object");
//             }

//             const eventName = String(
//                 event.spelling.description || event.spelling,
//             );
//             const handlersKey = normalize(`__handlers_${eventName}`);
//             const handlers = emitter.get(handlersKey);

//             if (handlers && isSeries(handlers)) {
//                 let pos = handlers.head();
//                 while (!pos.isTail()) {
//                     const handler = pos.first();

//                     // Create context with event data
//                     const eventCtx = new Context();
//                     eventCtx.set(normalize("data"), data);

//                     // Bind handler to event context, then execute
//                     const handlerCopy = deepCopy(handler);
//                     bind(handlerCopy, eventCtx);

//                     try {
//                         evaluator.doBlock(handlerCopy);
//                     } catch (e) {
//                         console.error(
//                             `Event handler error (${eventName}):`,
//                             e.message,
//                         );
//                     }

//                     pos = pos.next();
//                 }
//             }

//             return make.none();
//         },
//     ),
//     "reduce": new NativeCell("reduce", [":block"], ([block], evaluator) => {
//         if (!isSeries(block)) {
//             throw new Error("reduce: argument must be a block");
//         }

//         const results = [];
//         let pos = block.head();

//         while (!pos.isTail()) {
//             const cell = pos.first();
//             const result = cell.step(pos, evaluator);
//             results.push(result.value);
//             pos = pos.skip(result.consumed);
//         }

//         const resultBlock = make.block(results);
//         bind(resultBlock, GLOBAL);
//         return resultBlock;
//     }),
//     "compose": new NativeCell("compose", [":block"], ([block], evaluator) => {
//         if (!isSeries(block)) {
//             throw new Error("compose: argument must be a block");
//         }

//         const composed = composeBlock(block, evaluator);
//         bind(composed, GLOBAL);
//         return composed;
//     }),
//     // Arithmetic
//     "+": new NativeCell("+", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(
//                 `+: requires numbers, got ${a.typeName} and ${b.typeName}`,
//             );
//         }
//         return make.num(a.value + b.value);
//     }),

//     "-": new NativeCell("-", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`-: requires numbers`);
//         }
//         return make.num(a.value - b.value);
//     }),

//     "*": new NativeCell("*", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`*: requires numbers`);
//         }
//         return make.num(a.value * b.value);
//     }),

//     "/": new NativeCell("/", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`/: requires numbers`);
//         }
//         if (b.value === 0) {
//             throw new Error(`/: division by zero`);
//         }
//         return make.num(a.value / b.value);
//     }),

//     "mod": new NativeCell("mod", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`mod: requires numbers`);
//         }
//         return make.num(a.value % b.value);
//     }),

//     // Comparison
//     "=": new NativeCell("=", ["a", "b"], ([a, b]) => {
//         if (a instanceof NumberCell && b instanceof NumberCell) {
//             return a.value === b.value ? make.num(1) : make.num(0);
//         }
//         if (a instanceof NoneCell && b instanceof NoneCell) {
//             return make.num(1);
//         }
//         return make.num(0);
//     }),

//     "<": new NativeCell("<", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`<: requires numbers`);
//         }
//         return a.value < b.value ? make.num(1) : make.num(0);
//     }),

//     ">": new NativeCell(">", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`>: requires numbers`);
//         }
//         return a.value > b.value ? make.num(1) : make.num(0);
//     }),

//     "<=": new NativeCell("<=", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`<=: requires numbers`);
//         }
//         return a.value <= b.value ? make.num(1) : make.num(0);
//     }),

//     ">=": new NativeCell(">=", ["a", "b"], ([a, b]) => {
//         if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
//             throw new Error(`>=: requires numbers`);
//         }
//         return a.value >= b.value ? make.num(1) : make.num(0);
//     }),

//     // Logic
//     "and": new NativeCell("and", [":a", ":b"], ([a, b], evaluator) => {
//         const aVal = evaluator.evaluate(a);
//         if (!isTrue(aVal)) {
//             return aVal;
//         }
//         return evaluator.evaluate(b);
//     }),

//     "or": new NativeCell("or", [":a", ":b"], ([a, b], evaluator) => {
//         const aVal = evaluator.evaluate(a);
//         if (isTrue(aVal)) {
//             return aVal;
//         }
//         return evaluator.evaluate(b);
//     }),

//     "not": new NativeCell("not", ["value"], ([value]) => {
//         return isTrue(value) ? make.num(0) : make.num(1);
//     }),

//     // Control Flow
//     "if": new NativeCell(
//         "if",
//         ["cond", ":body"],
//         ([cond, body], evaluator) => {
//             if (isTrue(cond)) {
//                 return evaluator.doBlock(body);
//             }
//             return make.none();
//         },
//     ),

//     "either": new NativeCell("either", [
//         "cond",
//         ":true-branch",
//         ":false-branch",
//     ], ([cond, trueBranch, falseBranch], evaluator) => {
//         return isTrue(cond)
//             ? evaluator.doBlock(trueBranch)
//             : evaluator.doBlock(falseBranch);
//     }),

//     "while": new NativeCell(
//         "while",
//         [":cond", ":body"],
//         ([cond, body], evaluator) => {
//             let result = make.none();
//             while (true) {
//                 const condResult = evaluator.doBlock(cond);
//                 if (!isTrue(condResult)) break;
//                 result = evaluator.doBlock(body);
//             }
//             return result;
//         },
//     ),

//     "loop": new NativeCell(
//         "loop",
//         ["count", ":body"],
//         ([count, body], evaluator) => {
//             if (!(count instanceof NumberCell)) {
//                 throw new Error(`loop: count must be a number`);
//             }
//             let result = make.none();
//             for (let i = 0; i < count.value; i++) {
//                 result = evaluator.doBlock(body);
//             }
//             return result;
//         },
//     ),

//     // Series operations
//     "first": new NativeCell("first", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`first: requires series, got ${s.typeName}`);
//         }
//         return s.first();
//     }),

//     "next": new NativeCell("next", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`next: requires series`);
//         }
//         return s.next();
//     }),

//     "back": new NativeCell("back", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`back: requires series`);
//         }
//         return s.back();
//     }),

//     "head": new NativeCell("head", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`head: requires series`);
//         }
//         return s.head();
//     }),

//     "tail": new NativeCell("tail", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`tail: requires series`);
//         }
//         return s.tail();
//     }),

//     "tail?": new NativeCell("tail?", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`tail?: requires series`);
//         }
//         return s.isTail() ? make.num(1) : make.num(0);
//     }),

//     "length?": new NativeCell("length?", ["series"], ([s]) => {
//         if (!isSeries(s)) {
//             throw new Error(`length?: requires series`);
//         }
//         return make.num(s.length());
//     }),

//     "append": new NativeCell(
//         "append",
//         ["series", "value"],
//         ([s, value]) => {
//             if (!isSeries(s)) {
//                 throw new Error(`append: requires series`);
//             }
//             s.buffer.push(value);
//             return s;
//         },
//     ),

//     // Type predicates
//     "number?": new NativeCell("number?", ["value"], ([value]) => {
//         return value instanceof NumberCell ? make.num(1) : make.num(0);
//     }),

//     "block?": new NativeCell("block?", ["value"], ([value]) => {
//         return value instanceof BlockCell ? make.num(1) : make.num(0);
//     }),

//     "word?": new NativeCell("word?", ["value"], ([value]) => {
//         return value.typeName === "word" ? make.num(1) : make.num(0);
//     }),

//     "none?": new NativeCell("none?", ["value"], ([value]) => {
//         return value instanceof NoneCell ? make.num(1) : make.num(0);
//     }),

//     "function?": new NativeCell("function?", ["value"], ([value]) => {
//         return value.typeName === "function" ? make.num(1) : make.num(0);
//     }),

//     "series?": new NativeCell("series?", ["value"], ([value]) => {
//         return isSeries(value) ? make.num(1) : make.num(0);
//     }),

//     // Utility
//     "print": new NativeCell("print", ["value"], ([value]) => {
//         console.log(mold(value));
//         return make.none();
//     }),

//     "probe": new NativeCell("probe", ["value"], ([value]) => {
//         console.log(mold(value));
//         return value;
//     }),

//     "load": new NativeCell("load", ["source"], ([source]) => {
//         // Parse string or read file
//         let sourceStr;

//         if (source instanceof StringCell) {
//             sourceStr = source.buffer.join("");
//         } else {
//             throw new Error("load: argument must be a string");
//         }

//         // Check if it looks like a filename
//         if (sourceStr.endsWith(".bl")) {
//             sourceStr = fs.readFileSync(sourceStr, "utf8");
//         }

//         console.log("Loading file:", sourceStr);
//         // Parse to cells (unbound)
//         return parse(sourceStr);
//     }),

//     "do": new NativeCell("do", ["code"], ([code], evaluator) => {
//         let block;

//         if (code instanceof StringCell) {
//             const str = code.buffer.join("");

//             // If it's a filename, read it
//             if (str.endsWith(".bl")) {
//                 console.log("Reading file:", str);
//                 const source = fs.readFileSync(str, "utf8");
//                 block = parse(source);
//             } else {
//                 block = parse(str);
//             }
//         } else {
//             block = code;
//         }

//         // IMPORTANT: Prescan before binding!
//         prescan(block, GLOBAL);

//         // Now bind and execute
//         bindAll(block, GLOBAL);
//         console.log("Context:", GLOBAL);
//         return evaluator.doBlock(block);
//     }),

//     "quote": new NativeCell("quote", [":value"], ([value]) => {
//         return value;
//     }),

//     "type?": new NativeCell("type?", ["value"], ([value]) => {
//         return make.word(value.typeName);
//     }),
// };

// // Export helpers too
// export { isTrue, mold };

// /**
//  * Register all native functions in the global context
//  */
// export function setupNatives() {
//     for (const [name, nativeCell] of Object.entries(NATIVES)) {
//         GLOBAL.set(normalize(name), nativeCell.freeze());
//     }
// }

// setupNatives();

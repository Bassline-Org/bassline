import { parse } from "./parser.js";
import { BlockCell, isAnyWord, StringCell, WordCell } from "./cells/index.js";
import { Context, GLOBAL } from "./context.js";
import { bind, loadBinding } from "./bind.js";
import { nativeFn, nativeType } from "./cells/natives.js";
import fs from "fs";
import { ObjectCell } from "./cells/objects.js";

const SYSTEM = new WordCell("SYSTEM");
SYSTEM.binding = GLOBAL;

/**
 * Parses and evalutes a source code string
 * @param {*} source - The source code or an array of cells
 * @param {*} context - The context to evaluate in
 * @returns {ReCell} Result of evaluation
 */
export function evaluate(source) {
    let stream = source;
    if (source.isSeries) {
        stream = source.buffer;
    }
    let cursor = 0;
    const controller = {
        peek: (offset = 0) => stream[cursor + offset],
        evalNext: () => {
            const cell = controller.next();
            return cell.evaluate(controller);
        },
        next: () => {
            return stream[cursor++];
        },
        result: null,
    };
    try {
        while (controller.peek() !== undefined) {
            const cell = controller.next();
            controller.result = cell.evaluate(controller);
        }
    } catch (e) {
        console.error(`=== EVALUATOR ERROR ===`);
        throw e;
    }
    return controller.result;
}

export function load(source) {
    if (typeof source === "string") {
        return load(parse(source));
    }
    loadBinding(source);
    return evaluate(source);
}

/**
 * MAKE - creates a new data type instance
 * This is used for building native data types, such as objects
 * This is a low level operation, and probably you should use something else
 * @param {*} control The evaluator control object
 * @returns The new data type instance
 */
export function make(stream) {
    const builder = stream.evalNext();
    if (!builder) {
        throw new Error("Invalid MAKE No next cell!", this, word, builder);
    }
    const spec = stream.evalNext();
    if (!spec) {
        throw new Error("Invalid MAKE No spec cell!", this, word, spec);
    }
    return builder(stream, spec);
}

nativeType("object!", (stream, spec) => {
    const obj = new ObjectCell();
    loadBinding(spec.buffer, obj.context);
    //const boundSpec = bind(spec, obj.self());
    // Then we evaluate the spec in the context of the object
    // This gives us access to the object's self reference & local bindings
    spec.evaluate(stream);
    return obj;
});
nativeFn("make", make);
nativeFn("load", load);
nativeFn("print", (stream) => {
    const next = stream.evalNext();
    console.log(next);
});
nativeFn("bind", (stream) => {
    const words = stream.evalNext();
    const knownWord = stream.evalNext();
    return words.buffer.map((word) => bind(word, knownWord));
});
nativeFn("do", (stream) => {
    return evaluate(stream.evalNext());
});

const example = `
b: 456
a: make object! [
    b: 123
]
a/b
`;

console.log(load(example));

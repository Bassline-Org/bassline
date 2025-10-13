import { parse } from "./parser.js";
import { isAnyWord, StringCell } from "./cells/index.js";
import { Context, GLOBAL } from "./context.js";
import { bind } from "./bind.js";
import { nativeFn, nativeType } from "./cells/natives.js";
import { ObjectCell } from "./cells/objects.js";

/**
 * Parses and evalutes a source code string
 * @param {*} source - The source code or an array of cells
 * @param {*} context - The context to evaluate in
 * @returns {ReCell} Result of evaluation
 */
export function evaluate(source, context = GLOBAL) {
    let stream = source;
    if (source.isSeries) {
        stream = source.buffer;
    }
    if (typeof source === "string") {
        stream = parse(source);
    }
    let cursor = 0;
    const controller = {
        peek: (offset = 0) => stream[cursor + offset],
        evalNext: () => {
            const cell = controller.next();
            return cell.evaluate(controller, context);
        },
        next: () => {
            const cell = stream[cursor++];
            if (isAnyWord(cell) && !cell.binding) {
                cell.binding = context;
            }
            return cell;
        },
        result: null,
    };
    try {
        while (controller.peek() !== undefined) {
            const cell = controller.next();
            controller.result = cell.evaluate(controller, context);
        }
    } catch (e) {
        console.error(`=== EVALUATOR ERROR ===`);
        throw e;
    }
    return controller.result;
}

function load(control, word) {
    const next = control.next();
    if (!next) {
        throw new Error("Invalid LOAD! No next cell!", this, word, next);
    }
    const path = next.evaluate(control);
    if (!(path instanceof StringCell)) {
        throw new Error(
            "Invalid LOAD! Path must be a string!",
            this,
            word,
            path,
        );
    }
    const source = fs.readFileSync(path.buffer, "utf8");
    return evaluate(source);
}

/**
 * MAKE - creates a new data type instance
 * This is used for building native data types, such as objects
 * This is a low level operation, and probably you should use something else
 * @param {*} control The evaluator control object
 * @param {*} word The make word, (used for context binding)
 * @returns The new data type instance
 */
export function make(control, word) {
    const builder = control.evalNext();
    if (!builder) {
        throw new Error("Invalid MAKE No next cell!", this, word, builder);
    }
    const spec = control.evalNext();
    if (!spec) {
        throw new Error("Invalid MAKE No spec cell!", this, word, spec);
    }
    return builder(word, spec);
}

nativeType("object!", (word, spec) => {
    const obj = new ObjectCell();
    // @goose first we bind the spec, in the context of the word
    // This gives us the right bindings for whatever outside of the object
    const boundSpec = bind(spec, word);
    // Then we evaluate the spec in the context of the object
    // This gives us access to the object's self reference & local bindings
    evaluate(boundSpec, obj.context);
    return obj;
});
nativeType("func!", (word, spec) => {
    const functionContext = new Context();
    const args = spec.at(0);
    const body = spec.at(1);
});
const SYSTEM = new ObjectCell();
SYSTEM.context = GLOBAL;
GLOBAL.set("system", SYSTEM);

nativeFn("make", make);
nativeFn("load", load);
nativeFn("print", (c, w) => {
    console.log(c.evalNext());
});
nativeFn("bind", (c, w) => {
    const words = c.evalNext();
    if (!w.binding) {
        throw new Error("Invalid BIND! No binding!", this, w);
    }
    return words.buffer.map((word) => bind(word, w));
});
nativeFn("do", (c, w) => {
    const block = c.evalNext();
    return evaluate(block, w.binding);
});

const example = `
a: 123
foo: make object! [
    self/a: 456
]
words: [ a ]
print (bind words system)
print (bind words foo)
`;

const result = parse(example);
console.log(result);

const result2 = evaluate(result);
console.log(result2);

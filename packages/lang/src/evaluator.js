import { parse } from "./parser.js";
import { isAnyWord, StringCell } from "./cells/index.js";
import { GLOBAL } from "./context.js";
import { nativeFn } from "./cells/natives.js";

/**
 * Parses and evalutes a source code string
 * @param {*} source
 * @returns {ReCell} Result of evaluation
 */
export function evaluate(source) {
    let stream = parse(source);
    let cursor = 0;
    const controller = {
        peek: (offset = 0) => stream[cursor + offset],
        next: () => {
            const cell = stream[cursor++];
            if (isAnyWord(cell) && !cell.binding) {
                cell.binding = GLOBAL;
            }
            return cell;
        },
        result: null,
    };
    try {
        while (controller.peek() !== undefined) {
            const cell = controller.next();
            controller.result = cell.evaluate(controller);
        }
    } catch (e) {
        console.error(`stream: \n${JSON.stringify(stream, null, 2)}\n`);
        console.error(`control: \n${JSON.stringify(controller)}\n`);
        console.error(`result: \n${JSON.stringify(controller.result)}\n`);
        throw e;
    }
    return controller.result;
}

export function evaluator(arr) {
    let cursor = 0;
    let stream = arr;
    return {
        peek: (offset = 0) => stream[cursor + offset],
        seek: (count) => {
            cursor += count;
            return stream[cursor];
        },
        next: () => {
            const cell = stream[cursor++];
            if (isAnyWord(cell) && !cell.binding) {
                cell.binding = GLOBAL;
            }
            return cell;
        },
        queue: (cell) => {
            if (Array.isArray(cell)) {
                cursor += cell.length;
                stream = [...cell, ...stream];
            } else {
                cursor++;
                stream = [cell, ...stream];
            }
        },
    };
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
    const source = fs.readFileSync(path.buffer.data, "utf8");
    return evaluate(source);
}

nativeFn("load", load);
nativeFn("print", (c, w) => {
    const next = c.next();
    console.log(next);
    console.log(next.evaluate(c));
});

const example = `
foo: 123
print "hi mom!"
print foo
`;

const result = evaluate(example);
console.log(result);

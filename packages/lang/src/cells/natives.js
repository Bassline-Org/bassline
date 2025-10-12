import { BlockCell, make, NoneCell, NumberCell, ParenCell } from "./index.js";
import { isSeries } from "./series.js";
import { GLOBAL } from "../context.js";
import { normalize } from "../spelling.js";
import { ReCell } from "./base.js";
import { series } from "./series.js";
import { makeFunc } from "./index.js";
import { makeObject } from "./objects.js";
import { bind } from "../bind.js";
import {
    BlockCell,
    GetWordCell,
    LitWordCell,
    make,
    NoneCell,
    NumberCell,
    ParenCell,
    PathCell,
    RefinementCell,
    SetWordCell,
    StringCell,
    WordCell,
} from "./index.js";

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
        const str = cell.buffer.data.join("");
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
export class NativeCell extends ReCell {
    constructor(name, spec, impl) {
        super();
        this.name = name;
        this.spec = spec; // Array like ['arg1', ':arg2'] - : means don't evaluate
        this.impl = impl; // JavaScript function (args, evaluator) => result
    }

    isApplicable() {
        return true;
    }

    step(codeStream, evaluator) {
        const args = [];
        let pos = series.next(codeStream);
        let totalConsumed = 1;

        for (let i = 0; i < this.spec.length; i++) {
            if (series.isTail(pos)) {
                throw new Error(
                    `${this.name}: expected ${this.spec.length} arguments, got ${i}`,
                );
            }

            const argSpec = this.spec[i];
            const shouldEvaluate = !argSpec.startsWith(":");

            if (shouldEvaluate) {
                // Step through to fully evaluate (applies functions if needed)
                const cell = series.first(pos);
                const result = cell.step(pos, evaluator);
                args.push(result.value);
                totalConsumed += result.consumed;
                pos = pos.skip(result.consumed);
            } else {
                // Don't evaluate - pass the cell directly
                args.push(series.first(pos));
                totalConsumed += 1;
                pos = pos.next();
            }
        }

        const value = this.impl(args, evaluator);
        return { value, consumed: totalConsumed };
    }
}
/**
 * Check if a value is "truthy" in REBOL terms
 * In REBOL: none and false are false, everything else is true
 */
function isTrue(cell) {
    if (cell instanceof NoneCell) return false;
    if (cell instanceof NumberCell && cell.value === 0) return false;
    return true;
}
/**
 * Recursively compose a block
 * - Parens get evaluated and their result spliced in
 * - Nested blocks get composed recursively
 * - Everything else stays literal
 */
function composeBlock(block, evaluator) {
    const results = [];
    let pos = block.head();

    while (!pos.isTail()) {
        const cell = pos.first();

        if (cell instanceof ParenCell) {
            // Evaluate paren and include result
            const result = evaluator.doBlock(cell);
            results.push(result);
        } else if (cell instanceof BlockCell) {
            // Recursively compose nested blocks
            const composed = composeBlock(cell, evaluator);
            results.push(composed);
        } else {
            // Everything else stays literal (unevaluated)
            results.push(cell);
        }

        pos = pos.next();
    }

    return make.block(results);
}

/**
 * Create and return all native functions
 * This is a function so it executes after NativeCell is defined
 */
export const NATIVES = {
    "func": new NativeCell("func", [":spec", ":body"], ([spec, body]) => {
        return makeFunc(spec, body);
    }),
    "mold": new NativeCell("mold", ["value"], ([value]) => {
        return make.string(mold(value));
    }),

    "make": new NativeCell(
        "make",
        [":type", "spec"],
        ([type, spec], evaluator) => {
            // Check if type is the word 'object!'
            if (
                type.typeName === "word" &&
                type.spelling === normalize("object!")
            ) {
                return makeObject(spec, evaluator);
            }

            throw new Error(`make: unsupported type ${type.typeName}`);
        },
    ),
    "reduce": new NativeCell("reduce", [":block"], ([block], evaluator) => {
        if (!isSeries(block)) {
            throw new Error("reduce: argument must be a block");
        }

        const results = [];
        let pos = block.head();

        while (!pos.isTail()) {
            const cell = pos.first();
            const result = cell.step(pos, evaluator);
            results.push(result.value);
            pos = pos.skip(result.consumed);
        }

        const resultBlock = make.block(results);
        bind(resultBlock, GLOBAL);
        return resultBlock;
    }),
    "compose": new NativeCell("compose", [":block"], ([block], evaluator) => {
        if (!isSeries(block)) {
            throw new Error("compose: argument must be a block");
        }

        const composed = composeBlock(block, evaluator);
        bind(composed, GLOBAL);
        return composed;
    }),
    // Arithmetic
    "+": new NativeCell("+", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(
                `+: requires numbers, got ${a.typeName} and ${b.typeName}`,
            );
        }
        return make.num(a.value + b.value);
    }),

    "-": new NativeCell("-", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`-: requires numbers`);
        }
        return make.num(a.value - b.value);
    }),

    "*": new NativeCell("*", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`*: requires numbers`);
        }
        return make.num(a.value * b.value);
    }),

    "/": new NativeCell("/", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`/: requires numbers`);
        }
        if (b.value === 0) {
            throw new Error(`/: division by zero`);
        }
        return make.num(a.value / b.value);
    }),

    "mod": new NativeCell("mod", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`mod: requires numbers`);
        }
        return make.num(a.value % b.value);
    }),

    // Comparison
    "=": new NativeCell("=", ["a", "b"], ([a, b]) => {
        if (a instanceof NumberCell && b instanceof NumberCell) {
            return a.value === b.value ? make.num(1) : make.num(0);
        }
        if (a instanceof NoneCell && b instanceof NoneCell) {
            return make.num(1);
        }
        return make.num(0);
    }),

    "<": new NativeCell("<", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`<: requires numbers`);
        }
        return a.value < b.value ? make.num(1) : make.num(0);
    }),

    ">": new NativeCell(">", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`>: requires numbers`);
        }
        return a.value > b.value ? make.num(1) : make.num(0);
    }),

    "<=": new NativeCell("<=", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`<=: requires numbers`);
        }
        return a.value <= b.value ? make.num(1) : make.num(0);
    }),

    ">=": new NativeCell(">=", ["a", "b"], ([a, b]) => {
        if (!(a instanceof NumberCell) || !(b instanceof NumberCell)) {
            throw new Error(`>=: requires numbers`);
        }
        return a.value >= b.value ? make.num(1) : make.num(0);
    }),

    // Logic
    "and": new NativeCell("and", [":a", ":b"], ([a, b], evaluator) => {
        const aVal = evaluator.evaluate(a);
        if (!isTrue(aVal)) {
            return aVal;
        }
        return evaluator.evaluate(b);
    }),

    "or": new NativeCell("or", [":a", ":b"], ([a, b], evaluator) => {
        const aVal = evaluator.evaluate(a);
        if (isTrue(aVal)) {
            return aVal;
        }
        return evaluator.evaluate(b);
    }),

    "not": new NativeCell("not", ["value"], ([value]) => {
        return isTrue(value) ? make.num(0) : make.num(1);
    }),

    // Control Flow
    "if": new NativeCell(
        "if",
        ["cond", ":body"],
        ([cond, body], evaluator) => {
            if (isTrue(cond)) {
                return evaluator.doBlock(body);
            }
            return make.none();
        },
    ),

    "either": new NativeCell("either", [
        "cond",
        ":true-branch",
        ":false-branch",
    ], ([cond, trueBranch, falseBranch], evaluator) => {
        return isTrue(cond)
            ? evaluator.doBlock(trueBranch)
            : evaluator.doBlock(falseBranch);
    }),

    "while": new NativeCell(
        "while",
        [":cond", ":body"],
        ([cond, body], evaluator) => {
            let result = make.none();
            while (true) {
                const condResult = evaluator.doBlock(cond);
                if (!isTrue(condResult)) break;
                result = evaluator.doBlock(body);
            }
            return result;
        },
    ),

    "loop": new NativeCell(
        "loop",
        ["count", ":body"],
        ([count, body], evaluator) => {
            if (!(count instanceof NumberCell)) {
                throw new Error(`loop: count must be a number`);
            }
            let result = make.none();
            for (let i = 0; i < count.value; i++) {
                result = evaluator.doBlock(body);
            }
            return result;
        },
    ),

    // Series operations
    "first": new NativeCell("first", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`first: requires series, got ${s.typeName}`);
        }
        return s.first();
    }),

    "next": new NativeCell("next", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`next: requires series`);
        }
        return s.next();
    }),

    "back": new NativeCell("back", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`back: requires series`);
        }
        return s.back();
    }),

    "head": new NativeCell("head", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`head: requires series`);
        }
        return s.head();
    }),

    "tail": new NativeCell("tail", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`tail: requires series`);
        }
        return s.tail();
    }),

    "tail?": new NativeCell("tail?", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`tail?: requires series`);
        }
        return s.isTail() ? make.num(1) : make.num(0);
    }),

    "length?": new NativeCell("length?", ["series"], ([s]) => {
        if (!isSeries(s)) {
            throw new Error(`length?: requires series`);
        }
        return make.num(s.length());
    }),

    "append": new NativeCell(
        "append",
        ["series", "value"],
        ([s, value]) => {
            if (!isSeries(s)) {
                throw new Error(`append: requires series`);
            }
            s.buffer.data.push(value);
            return s;
        },
    ),

    // Type predicates
    "number?": new NativeCell("number?", ["value"], ([value]) => {
        return value instanceof NumberCell ? make.num(1) : make.num(0);
    }),

    "block?": new NativeCell("block?", ["value"], ([value]) => {
        return value instanceof BlockCell ? make.num(1) : make.num(0);
    }),

    "word?": new NativeCell("word?", ["value"], ([value]) => {
        return value.typeName === "word" ? make.num(1) : make.num(0);
    }),

    "none?": new NativeCell("none?", ["value"], ([value]) => {
        return value instanceof NoneCell ? make.num(1) : make.num(0);
    }),

    "function?": new NativeCell("function?", ["value"], ([value]) => {
        return value.typeName === "function" ? make.num(1) : make.num(0);
    }),

    "series?": new NativeCell("series?", ["value"], ([value]) => {
        return isSeries(value) ? make.num(1) : make.num(0);
    }),

    // Utility
    "print": new NativeCell("print", ["value"], ([value]) => {
        console.log(mold(value));
        return make.none();
    }),

    "probe": new NativeCell("probe", ["value"], ([value]) => {
        console.log(mold(value));
        return value;
    }),

    "do": new NativeCell("do", ["code"], ([code], evaluator) => {
        bind(code, GLOBAL);
        return evaluator.doBlock(code);
    }),

    "quote": new NativeCell("quote", [":value"], ([value]) => {
        return value;
    }),

    "type?": new NativeCell("type?", ["value"], ([value]) => {
        return make.word(value.typeName);
    }),
};

// Export helpers too
export { isTrue, mold };

/**
 * Register all native functions in the global context
 */
export function setupNatives() {
    for (const [name, nativeCell] of Object.entries(NATIVES)) {
        GLOBAL.set(normalize(name), nativeCell.freeze());
    }
}

setupNatives();

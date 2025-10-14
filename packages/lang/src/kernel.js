import { Context } from "./context.js";
import * as c from "./cells/index.js";
import { parse } from "./parser.js";

export const GLOBAL = new Context();

class Stream {
    constructor(array) {
        this.array = array;
        this.index = 0;
    }
    next() {
        return this.array[this.index++];
    }
    done() {
        return this.array.length <= this.index;
    }
    forEach(fn) {
        while (!this.done()) {
            fn(this.next());
        }
    }
}

function doBlock({ block }) {
    const stream = new Stream(block.value);
    let result;
    stream.forEach((cell) => {
        result = cell.evaluate({ stream });
    });
    return result;
}

function load(source) {
    if (typeof source === "string") {
        return load(parse(source));
    }
    if (source instanceof c.Block) {
        return block.setupContext(GLOBAL);
    }
    if (!Array.isArray(source)) {
        throw new Error(
            "Input for load must be a Block, source string, or an array!",
            source,
        );
    }
    const block = new c.Block({ value: source });
    block.setupContext(GLOBAL);
    return doBlock({ block });
}

class Parse extends c.NativeFn {
    evaluate({ stream }) {
        const toParse = stream.next().evaluate({ stream });
        if (toParse instanceof c.Str) {
            return new c.Block({ value: parse(toParse.value) })
                .setupContext(GLOBAL);
        }
    }
}

class Bind extends c.NativeFn {
    evaluate({ stream }) {
        const words = stream.next().evaluate({ stream });
        const knownWord = stream.next().evaluate({ stream });
        if (knownWord instanceof c.AnyWord) {
            return words.bind(knownWord);
        } else {
            throw new Error("Known word not any word!", knownWord);
        }
    }
}

class BindP extends c.NativeFn {
    evaluate({ stream }) {
        const value = stream.next().evaluate({ stream });
        if (value.context) {
            return value.context;
        } else {
            return undefined;
        }
    }
}

class DoBlock extends c.NativeFn {
    evaluate({ stream }) {
        const cell = stream.next().evaluate({ stream });
        if (cell instanceof c.Block) {
            return doBlock({ block: cell });
        } else {
            return cell.evaluate({ stream });
        }
    }
}

const example = `
    words: [a b c]
    a: 1
    b: 2
    c: 3
    d: bind words 'a
`;

GLOBAL.set("parse", new Parse());
GLOBAL.set("do", new DoBlock());
GLOBAL.set("bind", new Bind());
GLOBAL.set("bind?", new BindP());

const parsed = parse(example);
const result = load(parsed);
console.log(result);

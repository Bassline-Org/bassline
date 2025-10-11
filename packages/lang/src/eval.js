import { parse } from "./parser.js";

export class Scalar {}

export class Num extends Scalar {
    constructor(value) {
        super();
        this.value = value;
    }
}

export class Word extends Scalar {
    constructor(value) {
        super();
        this.value = value;
    }
}

export class Series {
    constructor(items) {
        this.items = items;
    }

    at(key) {
        return this.items[key];
    }

    length() {
        return this.items.length;
    }
}
export class Tuple extends Series {}
export class Block extends Series {}
export class Tag extends Series {
    constructor(raw) {
        const match = raw.match(/<(\w+)(.*)>/);
        const tagName = match[1];
        const attrString = match[2];

        const attrs = { _tag: tagName };
        const attrRegex = /(\w+)=["']([^"']+)["']/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrString))) {
            attrs[attrMatch[1]] = attrMatch[2];
        }

        super(attrs);
        this.tag = tagName;
        this.attrs = attrs;
    }

    at(key) {
        return this.items[key];
    }
}

export class Url extends Series {
    constructor(value) {
        const match = value.match(/^([a-z][a-z0-9+.-]*):\/\/([^\/]+)(\/.*)?$/i);
        if (!match) {
            const simpleMatch = value.match(/^([a-z][a-z0-9+.-]*):(.*)$/i);
            if (simpleMatch) {
                super({ scheme: simpleMatch[1], rest: simpleMatch[2] });
            } else {
                super({ value });
            }
        } else {
            super({
                scheme: match[1],
                host: match[2],
                path: match[3] || "/",
            });
        }
        this.value = value;
    }

    at(key) {
        return this.items[key];
    }
}

export class Path extends Series {
    constructor(root, refinements) {
        super(refinements);
        this.root = root;
    }
}

export class Str extends Series {}

export const GrammarProto = {};

export function createGrammar() {
    return Object.create(GrammarProto);
}

class Evaluator {
    pos = 0;
    constructor(parsed, env = {}) {
        this.values = parsed;
        this.dialectWords = createGrammar();
        this.env = Object.create(env);
    }

    peek() {
        return this.values[this.pos];
    }

    next() {
        if (this.peek() === undefined) return undefined;
        return this.values[this.pos++];
    }

    hasMore() {
        return this.peek() !== undefined;
    }

    getWord(word) {
        return this.env[word];
    }

    setWord(word) {
        const value = this.step();
        this.env[word] = value;
        return value;
    }

    step(env) {
        return this.eval(this.next(), env);
    }

    evalWord(value) {
        if (value.endsWith(":")) {
            const word = value.slice(0, -1);
            return this.setWord(word);
        }
        if (value.startsWith(":")) {
            const word = value.slice(1);
            return this.getWord(word);
        }
        return value;
    }

    evalPrimitive(parsed) {
        return parsed.value;
    }

    evalParen({ items }) {
        return items.map((v) => this.eval(v));
    }

    evalBlock({ items }) {
        return new Block(items);
    }

    evalUrl({ value }) {
        return new Url(value);
    }

    evalPath({ items }) {
        const root = items[0];
        const refinements = items.slice(1);
        const rootValue = this.eval(root);
        const refinementValues = refinements.map((v) => this.eval(v));
        return new Path(rootValue, refinementValues);
    }

    evalTag({ value }) {
        return new Tag(value);
    }

    evalTuple({ value }) {
        return new Tuple(value);
    }

    eval(parsed) {
        const { type, primitive } = parsed;
        if (primitive) {
            return this.evalPrimitive(parsed);
        }
        if (type === "word") {
            return this.evalWord(parsed);
        }
        if (type === "paren") {
            return this.evalParen(parsed);
        }
        if (type === "block") {
            return this.evalBlock(parsed);
        }
        if (type === "url") {
            return this.evalUrl(parsed);
        }
        if (type === "path") {
            return this.evalPath(parsed);
        }
        if (type === "tag") {
            return this.evalTag(parsed);
        }
        if (type === "tuple") {
            return this.evalTuple(parsed);
        }
        throw new Error(`Unknown type: ${type}`);
    }
    run() {
        let result;
        while (this.hasMore()) {
            result = this.step();
        }
        return result;
    }
}

Object.assign(GrammarProto, {
    print() {
        const v = this.step();
        console.log(v);
    },
    do() {
        const v = this.step();
        if (v instanceof Block) {
            const evaluator = new Evaluator(v.items, this.env);
            return evaluator.run();
        } else {
            throw new Error("do block expected");
        }
    },
});

const source = `
  foo: do [
    a: 123
    b: 456
    print :a
    print :b
    :a
  ]
  print :foo
  `;
const ast = parse(source);
const evaluator = new Evaluator(ast);

evaluator.run();

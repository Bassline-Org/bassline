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

    getWord(word, env) {
        return env[word];
    }

    setWord(word, env) {
        const value = this.step();
        env[word] = value;
        return value;
    }

    step(env = this.env) {
        return this.eval(this.next(), env);
    }

    eval(parsed, env = this.env) {
        const { type, value, items } = parsed;
        switch (type) {
            case "word":
                if (value.endsWith(":")) {
                    const word = value.slice(0, -1);
                    return this.setWord(word, env);
                }
                if (value.startsWith(":")) {
                    const word = value.slice(1);
                    return this.getWord(word, env);
                }
                if (this.dialectWords[value]) {
                    return this.dialectWords[value].call(this, env);
                }
                return new Word(value);
            case "paren":
                return items.map((v) => this.eval(v, env));
            case "block":
                return new Block(items);
            case "number":
                return new Num(value);
            case "string":
                return new Str(value);
            case "url":
                return new Url(value);
            case "path":
                const [root, ...refinements] = value.split("/");
                const rootValue = this.eval(root, env);
                const refinementValues =
                    (Array.isArray(refinements) ? refinements : [refinements])
                        .map((v) => this.eval(v, env));
                return new Path(rootValue, refinementValues);
            case "tag":
                return new Tag(value);
            case "tuple":
                return new Tuple(value);
        }
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

const result = evaluator.run();

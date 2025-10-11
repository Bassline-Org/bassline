import {
    Block,
    Num,
    Paren,
    Path,
    Series,
    Str,
    Tag,
    Tuple,
    Url,
    Word,
} from "./nodes.js";
import { parse } from "./parser.js";

export const GrammarProto = {};

export function createGrammar() {
    return Object.create(GrammarProto);
}

export class Evaluator {
    constructor(values, env = {}) {
        this.values = values;
        this.pos = 0;
        this.env = env;
        this.dialectWords = createGrammar();
    }

    peek() {
        return this.values[this.pos];
    }

    peekNext() {
        return this.values[this.pos + 1];
    }

    next() {
        if (this.pos >= this.values.length) return undefined;
        return this.values[this.pos++];
    }

    hasMore() {
        return this.pos < this.values.length;
    }

    getWord(name) {
        if (name in this.env) {
            return this.env[name];
        }
        throw new Error(`Undefined word: ${name}`);
    }

    setWord(name, value) {
        this.env[name] = value;
        return value;
    }

    eval(value) {
        if (value instanceof Num) {
            return value.value;
        }

        if (value instanceof Str) {
            return value.value;
        }

        if (value instanceof Word) {
            if (value.isSetter()) {
                const name = value.getName();
                const nextValue = this.step();
                return this.setWord(name, nextValue);
            }

            if (value.isGetter()) {
                const name = value.getName();
                return this.getWord(name);
            }

            const handler = this.dialectWords[value.value];
            if (handler) {
                return handler.call(this);
            }

            // Otherwise it's just a symbol
            return value.value;
        }

        // Paths evaluate root and apply refinements
        if (value instanceof Path) {
            let result = this.eval(value.root);
            for (const refinement of value.items) {
                if (result instanceof Series) {
                    const refinementValue = this.eval(refinement);
                    result = result.at(refinementValue);
                } else if (typeof result === "object" && result !== null) {
                    result = result[this.eval(refinement)];
                } else {
                    console.log("node: ", value);
                    throw new Error(`Cannot refine ${typeof result}`);
                }
            }

            return result;
        }

        if (value instanceof Paren) {
            const evaluator = new Evaluator(value.items, this.env);
            return evaluator.run();
        }

        if (
            value instanceof Tag ||
            value instanceof Url ||
            value instanceof Tuple ||
            value instanceof Block
        ) {
            return value;
        }

        throw new Error(`Cannot evaluate: ${value}`);
    }

    step() {
        const value = this.next();
        if (value === undefined) return undefined;
        const result = this.eval(value);
        this.lastResult = result;
        return result;
    }

    run() {
        while (this.hasMore()) {
            this.step();
        }
        return this.lastResult;
    }
}

export function installDialect(words, grammarObj = GrammarProto) {
    Object.assign(grammarObj, words);
}

const coreDialect = {
    print() {
        const value = this.step();
        console.log(value);
        return value;
    },

    do() {
        const block = this.step();
        if (!(block instanceof Block)) {
            throw new Error("do expects a block");
        }

        const evaluator = new Evaluator(block.items, this.env);
        return evaluator.run();
    },

    if() {
        const condition = this.step();
        const thenBlock = this.step();
        const elseBlock = this.step();

        if (!(thenBlock instanceof Block)) {
            throw new Error("if: no then block provided!", thenBlock);
        }
        if (!(elseBlock instanceof Block)) {
            throw new Error("if: no else block provided!", elseBlock);
        }

        if (condition) {
            const evaluator = new Evaluator(thenBlock.items, this.env);
            return evaluator.run();
        } else {
            const evaluator = new Evaluator(elseBlock.items, this.env);
            return evaluator.run();
        }
    },

    context() {
        const block = this.step();
        const env = Object.create(this.env);
        const evaluator = new Evaluator(block.items, env);
        evaluator.run();
        return evaluator.env;
    },

    async fetch() {
        const url = this.step();
        return await fetch(url.value);
    },

    async waitFor() {
        const promise = this.step();
        const body = this.step();
        await promise;
        const evaluator = new Evaluator(body.items, this.env);
        return evaluator.run();
    },

    async import() {
        const path = this.step();
        return await import(path);
    },

    async js() {
        const fn = this.step();
        const arg = this.step();
        const [f, a] = await Promise.all([fn, arg]);
        console.log("fn: ", f);
        console.log("arg: ", a);
        return f(a);
    },

    ["+"]() {
        return this.lastResult + this.step();
    },
    ["*"]() {
        return this.lastResult * this.step();
    },
    ["-"]() {
        return this.lastResult - this.step();
    },
    ["/"]() {
        return this.lastResult / this.step();
    },
};

installDialect(coreDialect);

const source = `
  a: 10
  b: 20
  url: https://google.com
  tag: <link href="asdfasdf">
  ctx: context [
    foo: context [
        bar: :a
    ]
    baz: :b
  ]
  print :tag
  print :tag/href
  mod: import "./parser.js"
  goog: fetch https://google.com
  waitFor :goog [
    print :goog
  ]
  waitFor :mod [
    print :mod
  ]
  print "should be before goog"
`;

const parsed = parse(source);
//console.log("parsed: ", parsed);
const evaluator = new Evaluator(parsed);
const result = evaluator.run();
console.log("result: ", result);

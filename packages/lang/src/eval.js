import {
    Block,
    Num,
    Paren,
    Path,
    Scalar,
    Series,
    Str,
    Tag,
    Tuple,
    Url,
    Word,
} from "./nodes.js";
import { parse } from "./parser.js";

export const GrammarProto = {};

function assert(pred, msg) {
    if (!pred) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

function isNil(value) {
    return value === undefined || value === null;
}

function notNil(value) {
    return !isNil(value);
}

function assertIs(value, type) {
    assert(value instanceof type, `Expected ${type}, got ${value}`);
}

export class Evaluator {
    constructor(values, env = {}) {
        this.values = values;
        this.pos = 0;
        this.env = Object.create(GrammarProto);
        Object.assign(this.env, env);
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
        console.log(this.env);
        throw new Error(`Undefined word: ${name}`);
    }

    setWord(name, value) {
        this.env[name] = value;
        return value;
    }

    resolveRefinement(head, tail) {
        if (head instanceof Promise) {
            return head.then((v) => resolveRefinement(v, tail));
        }
        if (tail instanceof Series) {
            const key = this.eval(tail.first);
            const result = head.get ? head.get(key) : head[key];
            return resolveRefinement(result, tail.rest);
        }
        if (tail instanceof Scalar) {
            const key = this.eval(tail.value);
            return head.get ? head.get(key) : head[key];
        }
        throw new Error(`Cannot resolve refinement: ${tail}`);
    }

    eval(value) {
        if (value instanceof Promise) {
            return value.then((v) => this.eval(v));
        }

        if (value instanceof Num) {
            return value.value;
        }

        if (value instanceof Str) {
            return value.value;
        }

        if (value instanceof Word) {
            if (value.isQuoted()) {
                return value.value;
            }
            if (value.isSetter()) {
                const name = value.getName();
                const nextValue = this.step();
                return this.setWord(name, nextValue);
            }

            if (value.isGetter()) {
                const name = value.getName();
                return this.getWord(name);
            }

            const binding = this.env[value.value];
            if (typeof binding === "function") {
                return binding.call(this);
            }
            if (binding === undefined) {
                console.log("undefined word: ", value);
                throw new Error(`Undefined word: ${value}`);
            }
            return binding;
        }

        if (value instanceof Path) {
            return this.resolveRefinement(this.eval(value.first), value.rest);
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

    stepTimes(n) {
        return Array.from({ length: n }, () => this.step());
    }

    run() {
        while (this.hasMore()) {
            this.step();
        }
        return this.lastResult;
    }
}

export function installDialect(words) {
    Object.assign(GrammarProto, {
        ...words,
    });
}

const coreDialect = {
    print() {
        const value = this.step();
        assert(notNil(value), "print required a value!");
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

    reduce() {
        const block = this.step();
        block.items = block.items.map((item) => this.eval(item));
        return block;
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

    ["true"]() {
        return true;
    },
    ["false"]() {
        return false;
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

const otherSource = `
    drucken: [print]
    do drucken
`;
const parsed = parse(otherSource);
const evaluator = new Evaluator(parsed);
const result = evaluator.run();
console.log("result: ", result);

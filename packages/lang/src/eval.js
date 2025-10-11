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
    constructor() {
        // Only store global scope
        this.globalEnv = Object.create(GrammarProto);
    }

    getWord(name) {
        if (name instanceof Promise) {
            return name.then((v) => this.getWord(v));
        }
        if (name in this.env) {
            return this.env[name];
        }
        throw new Error(`Undefined word: ${name}`);
    }

    setWord(name, value) {
        if (name instanceof Promise) {
            return name.then((v) => this.setWord(v, value));
        }
        this.env[name] = value;
        return value;
    }

    resolveRefinement(head, tail) {
        if (head instanceof Promise) {
            return head.then((v) => this.resolveRefinement(v, tail));
        }
        if (tail instanceof Series) {
            const key = this.eval(tail.first);
            const result = head.get ? head.get(key) : head[key];
            return this.resolveRefinement(result, tail.rest);
        }
        if (tail instanceof Scalar) {
            const key = this.eval(tail.value);
            return head.get ? head.get(key) : head[key];
        }
        throw new Error(`Cannot resolve refinement: ${tail}`);
    }

    eval(value) {
        if (value instanceof Promise) {
            return value.then(async (v) => await this.eval(v));
        }

        if (value instanceof Num) {
            return value.value;
        }

        if (value instanceof Str) {
            return value.value;
        }

        if (value instanceof Word) {
            if (value.isQuoted()) {
                return value.getName();
            }

            if (value.isSetter()) {
                const name = value.getName();
                const nextValue = this.step();
                this.setWord(name, nextValue);
                return nextValue;
            }

            if (value.isGetter()) {
                const name = value.getName();
                return this.getWord(name);
            }

            const binding = this.getWord(value.value);
            if (typeof binding === "function") {
                return binding.call(this);
            }
            return binding;
        }

        if (value instanceof Path) {
            const first = this.eval(value.first);
            return this.resolveRefinement(first, value.rest);
        }

        if (value instanceof Paren) {
            return this.run(value.items, this.env);
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
        // NOT async - keep promises as values!
        if (this.values.length === 0) return undefined;
        const [value, ...rest] = this.values;
        this.values = rest;
        const result = this.eval(value); // Don't await
        this.lastResult = result;
        return result;
    }

    run(values, env = null) {
        // NOT async - returns promise if last value is promise
        const saved = {
            values: this.values,
            env: this.env,
            lastResult: this.lastResult,
        };

        // Set up new evaluation context
        this.values = values;
        this.env = env || this.globalEnv;
        this.lastResult = undefined;

        // Run evaluation
        while (this.values.length > 0) {
            this.step(); // Don't await
        }
        const result = this.lastResult;

        // Restore previous state
        this.values = saved.values;
        this.env = saved.env;
        this.lastResult = saved.lastResult;

        return result; // Might be a promise
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
        return this.run(block.items, this.env);
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
            return this.run(thenBlock.items, this.env);
        } else {
            return this.run(elseBlock.items, this.env);
        }
    },

    when() {
        const condition = this.step();
        const thenBlock = this.step();
        if (condition) {
            return this.run(thenBlock.items, this.env);
        }
    },

    context() {
        const block = this.step();
        const newEnv = Object.create(this.env);
        this.run(block.items, newEnv);
        return newEnv;
    },

    async fetch() {
        const url = this.step();
        return await fetch(url.value);
    },

    async waitFor() {
        const promise = this.step();
        const body = this.step();
        await promise;
        return this.run(body.items, this.env);
    },

    async import() {
        const path = this.step();
        return await import(path);
    },

    js() {
        const fn = this.step();
        const arg = this.step();
        // Don't await - just call
        return fn(arg);
    },

    /// Environment ops
    get() {
        const key = this.step();
        assert(
            typeof key === "string" || typeof key === "number",
            "get requires a string or number key",
        );
        return this.getWord(key);
    },

    set() {
        const key = this.step();
        assert(
            typeof key === "string" || typeof key === "number",
            "set requires a string or number key",
        );
        const value = this.step();
        this.setWord(key, value);
        return value;
    },

    ["symbol"]() {
        if (this.values.length === 0) return undefined;
        const [n, ...rest] = this.values;
        this.values = rest;
        assertIs(n, Word);
        return n.getName();
    },

    fn() {
        const argListBlock = this.step();
        const body = this.step();
        const argList = argListBlock.items.map((item) => item.getName());
        const closureEnv = this.env; // Capture lexical env

        // Return function that gets called by the CALLING evaluator
        return function () {
            // Create NEW env that extends the closure
            const fnEnv = Object.create(closureEnv);

            // Bind arguments from the calling evaluator
            argList.forEach((arg) => {
                const nextArg = this.step();
                fnEnv[arg] = nextArg;
            });

            // Evaluate function body with captured closure + bound args
            return this.run(body.items, fnEnv);
        };
    },

    does() {
        const body = this.step();
        const capturedEnv = this.env;
        return async () => {
            return this.run(body.items, capturedEnv);
        };
    },

    /// Logics
    ["true"]() {
        return true;
    },
    ["false"]() {
        return false;
    },
    ["not"]() {
        return !this.step();
    },
    ["and"]() {
        return this.lastResult && this.step();
    },
    ["or"]() {
        return this.lastResult || this.step();
    },

    /// Math ops
    ["="]() {
        return this.lastResult === this.step();
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

    /// Async primitives
    async await() {
        const promise = this.step();
        return await promise;
    },

    all() {
        const block = this.step();
        const promises = block.items.map((item) => this.eval(item));
        return Promise.all(promises);
    },

    race() {
        const block = this.step();
        const promises = block.items.map((item) => this.eval(item));
        return Promise.race(promises);
    },

    any() {
        const block = this.step();
        const promises = block.items.map((item) => this.eval(item));
        return Promise.any(promises);
    },

    settled() {
        const block = this.step();
        const promises = block.items.map((item) => this.eval(item));
        return Promise.allSettled(promises);
    },

    timeout() {
        const ms = this.step();
        return new Promise((resolve) => setTimeout(resolve, ms));
    },

    background() {
        const block = this.step();
        // Run in background without awaiting
        this.run(block.items, this.env);
        return undefined;
    },
};

installDialect(coreDialect);

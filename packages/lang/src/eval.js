import {
    BasslineFunction,
    Block,
    File,
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
import * as fs from "fs";

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

        // tail is an array of remaining path segments
        if (Array.isArray(tail) && tail.length > 0) {
            const [first, ...rest] = tail;
            // Get the key name without evaluating
            const key = first instanceof Word
                ? first.getName()
                : this.eval(first);
            const result = head.get ? head.get(key) : head[key];
            if (rest.length > 0) {
                return this.resolveRefinement(result, rest);
            }
            return result;
        }

        // No more segments, return head
        return head;
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
            // Handle BasslineFunction
            if (binding instanceof BasslineFunction) {
                return binding.callWith(this);
            }
            // Handle dialect words (JavaScript functions)
            if (typeof binding === "function") {
                return binding.call(this);
            }
            return binding;
        }

        if (value instanceof Path) {
            const first = this.eval(value.first);
            const result = this.resolveRefinement(first, value.rest);
            // If the path resolves to a BasslineFunction, call it
            if (result instanceof BasslineFunction) {
                return result.callWith(this);
            }
            // If it's a dialect word (JavaScript function), call it
            if (typeof result === "function") {
                return result.call(this);
            }
            return result;
        }

        if (value instanceof Paren) {
            return this.run(value.items, this.env);
        }

        if (
            value instanceof Tag ||
            value instanceof Url ||
            value instanceof Tuple ||
            value instanceof Block ||
            value instanceof File
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

    fork() {
        // Create child evaluator with isolated state
        const child = Object.create(this);
        child.values = [];
        child.env = this.env; // Share environment (no new scope)
        child.lastResult = undefined;
        return child;
    }
}

export function installDialect(words) {
    Object.assign(GrammarProto, {
        ...words,
    });
}

const coreDialect = {
    async print() {
        const value = this.step();
        assert(notNil(value), "print required a value!");
        // Await if promise, otherwise print directly
        const toPrint = value instanceof Promise ? await value : value;
        console.log(toPrint);
        return toPrint;
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

    /// Loop constructs
    loop() {
        const count = this.step();
        const block = this.step();
        assert(typeof count === "number", "loop requires a number");
        assert(block instanceof Block, "loop requires a block");

        let result;
        for (let i = 0; i < count; i++) {
            try {
                result = this.run(block.items, this.env);
            } catch (e) {
                if (e.isBreak) {
                    break;
                } else if (e.isContinue) {
                    continue;
                }
                throw e;
            }
        }
        return result;
    },

    repeat() {
        // Get the word WITHOUT evaluating it
        if (this.values.length === 0) throw new Error("repeat requires a word");
        const [word, ...rest1] = this.values;
        this.values = rest1;
        assert(word instanceof Word, "repeat requires a word");

        const count = this.step();
        const block = this.step();
        assert(typeof count === "number", "repeat requires a number");
        assert(block instanceof Block, "repeat requires a block");

        const varName = word.getName();
        let result;
        for (let i = 1; i <= count; i++) {
            this.setWord(varName, i);
            try {
                result = this.run(block.items, this.env);
            } catch (e) {
                if (e.isBreak) {
                    break;
                } else if (e.isContinue) {
                    continue;
                }
                throw e;
            }
        }
        return result;
    },

    while() {
        const conditionBlock = this.step();
        const bodyBlock = this.step();
        assert(
            conditionBlock instanceof Block,
            "while requires a condition block",
        );
        assert(bodyBlock instanceof Block, "while requires a body block");

        let result;
        while (this.run(conditionBlock.items, this.env)) {
            try {
                result = this.run(bodyBlock.items, this.env);
            } catch (e) {
                if (e.isBreak) {
                    break;
                } else if (e.isContinue) {
                    continue;
                }
                throw e;
            }
        }
        return result;
    },

    foreach() {
        // Get the word WITHOUT evaluating it
        if (this.values.length === 0) {
            throw new Error("foreach requires a word");
        }
        const [word, ...rest1] = this.values;
        this.values = rest1;
        assert(word instanceof Word, "foreach requires a word");

        const series = this.step();
        const block = this.step();
        assert(block instanceof Block, "foreach requires a block");

        const varName = word.getName();
        let result;

        // Handle different series types
        let items;
        if (series instanceof Block) {
            items = series.items;
        } else if (Array.isArray(series)) {
            items = series;
        } else {
            throw new Error("foreach requires a series (block or array)");
        }

        for (const item of items) {
            this.setWord(varName, this.eval(item));
            try {
                result = this.run(block.items, this.env);
            } catch (e) {
                if (e.isBreak) {
                    break;
                } else if (e.isContinue) {
                    continue;
                }
                throw e;
            }
        }
        return result;
    },

    forever() {
        const block = this.step();
        assert(block instanceof Block, "forever requires a block");

        let result;
        while (true) {
            try {
                result = this.run(block.items, this.env);
            } catch (e) {
                if (e.isBreak) {
                    break;
                } else if (e.isContinue) {
                    continue;
                }
                throw e;
            }
        }
        return result;
    },

    break() {
        const err = new Error("break");
        err.isBreak = true;
        throw err;
    },

    continue() {
        const err = new Error("continue");
        err.isContinue = true;
        throw err;
    },

    /// Conditional selection
    either() {
        const condition = this.step();
        const thenBlock = this.step();
        const elseBlock = this.step();
        assert(thenBlock instanceof Block, "either requires a then block");
        assert(elseBlock instanceof Block, "either requires an else block");

        if (condition) {
            return this.run(thenBlock.items, this.env);
        } else {
            return this.run(elseBlock.items, this.env);
        }
    },

    switch() {
        const value = this.step();
        const casesBlock = this.step();
        assert(casesBlock instanceof Block, "switch requires a cases block");

        const cases = casesBlock.items;
        for (let i = 0; i < cases.length; i += 2) {
            const caseValue = this.eval(cases[i]);
            if (caseValue === value) {
                const action = cases[i + 1];
                if (action instanceof Block) {
                    return this.run(action.items, this.env);
                }
                return this.eval(action);
            }
        }
        return undefined;
    },

    case() {
        const casesBlock = this.step();
        assert(casesBlock instanceof Block, "case requires a cases block");

        const cases = casesBlock.items;
        for (let i = 0; i < cases.length; i += 2) {
            const condition = this.eval(cases[i]);
            if (condition) {
                const action = cases[i + 1];
                if (action instanceof Block) {
                    return this.run(action.items, this.env);
                }
                return this.eval(action);
            }
        }
        return undefined;
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

        // Return a BasslineFunction domain object
        return new BasslineFunction(argList, body, this.env);
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

    /// Comparison ops
    [">"]() {
        return this.lastResult > this.step();
    },
    [">="]() {
        return this.lastResult >= this.step();
    },
    ["<"]() {
        return this.lastResult < this.step();
    },
    ["<="]() {
        return this.lastResult <= this.step();
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

    async seq() {
        const block = this.step(); // Consume block synchronously
        if (!(block instanceof Block)) {
            throw new Error("seq expects a block");
        }

        // Execute items sequentially using fork
        // Give child all remaining items so it can consume what it needs
        let result;
        let index = 0;
        while (index < block.items.length) {
            const child = this.fork();
            const remaining = block.items.slice(index);
            result = child.run(remaining, child.env);

            // Figure out how many items were consumed
            const consumed = remaining.length - child.values.length;
            index += consumed;

            // Await promises before continuing to next item
            if (result instanceof Promise) {
                result = await result;
            }
        }
        return result;
    },

    fork() {
        const block = this.step(); // Consume block synchronously
        if (!(block instanceof Block)) {
            throw new Error("fork expects a block");
        }

        // Create child evaluator and run block in isolation
        const child = this.fork();
        return child.run(block.items, child.env);
    },

    /// File operations (synchronous, like REBOL)
    read() {
        const file = this.step();
        const path = file instanceof File ? file.path : file;
        return fs.readFileSync(path, "utf-8");
    },

    write() {
        const file = this.step();
        const content = this.step();
        const path = file instanceof File ? file.path : file;
        fs.writeFileSync(path, content, "utf-8");
        return file;
    },

    ["exists?"]() {
        const file = this.step();
        const path = file instanceof File ? file.path : file;
        try {
            fs.accessSync(path);
            return true;
        } catch {
            return false;
        }
    },

    delete() {
        const file = this.step();
        const path = file instanceof File ? file.path : file;
        fs.unlinkSync(path);
        return file;
    },

    ["dir?"]() {
        const file = this.step();
        const path = file instanceof File ? file.path : file;
        try {
            const stats = fs.statSync(path);
            return stats.isDirectory();
        } catch {
            return false;
        }
    },

    load() {
        const file = this.step();
        const path = file instanceof File ? file.path : file;
        const content = fs.readFileSync(path, "utf-8");
        return this.run(parse(content));
    },
};

installDialect(coreDialect);

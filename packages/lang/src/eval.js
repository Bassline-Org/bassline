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

    eval(value, stack) {
        if (value instanceof Num) {
            return value.value;
        }

        if (value instanceof Str) {
            return value.value;
        }

        if (value instanceof Word) {
            if (value.isSetter()) {
                const name = value.getName();
                const nextValue = this.step(stack);
                return this.setWord(name, nextValue);
            }

            if (value.isGetter()) {
                const name = value.getName();
                return this.getWord(name);
            }

            const handler = this.dialectWords[value.value];
            if (handler) {
                return handler.call(this, stack);
            }

            // Otherwise it's just a symbol
            return value.value;
        }

        // Paths evaluate root and apply refinements
        if (value instanceof Path) {
            let result = this.eval(new Word(value.root), stack);

            // Apply each refinement
            for (const refinement of value.items) {
                if (result instanceof Series) {
                    result = result.at(refinement);
                } else if (typeof result === "object" && result !== null) {
                    result = result[refinement];
                } else {
                    throw new Error(`Cannot refine ${typeof result}`);
                }
            }

            return result;
        }

        if (value instanceof Paren) {
            let result;
            for (const v in value.items) {
                result = this.eval(v, stack);
            }
            return result;
        }
        if (value instanceof Tag) return value;
        if (value instanceof Url) return value;
        if (value instanceof Tuple) return value;
        if (value instanceof Block) return value;

        throw new Error(`Cannot evaluate: ${value}`);
    }

    step(stack) {
        const value = this.next();
        if (value === undefined) return undefined;
        return this.eval(value, stack);
    }

    run() {
        let result;
        let stack = [];
        while (this.hasMore()) {
            result = this.step(stack);
            stack.push(result);
        }
        return result;
    }
}

export function installDialect(words, grammarObj = GrammarProto) {
    Object.assign(grammarObj, words);
}

const coreDialect = {
    print(stack) {
        const value = this.step(stack);
        console.log(value);
        return value;
    },

    do(_stack) {
        const block = this.step();
        if (!(block instanceof Block)) {
            throw new Error("do expects a block");
        }

        const evaluator = new Evaluator(block.items, {
            env: this.env,
            dialect: this.dialectWords,
        });
        return evaluator.run();
    },

    if() {
        const condition = this.step();
        const thenBlock = this.step();

        if (!(thenBlock instanceof Block)) {
            throw new Error("if expects a block");
        }

        if (condition) {
            const evaluator = new Evaluator(thenBlock.items, { env: this.env });
            evaluator.dialectWords = this.dialectWords;
            return evaluator.run();
        }

        return undefined;
    },

    context(stack) {
        const block = this.step(stack);
        const env = Object.create(this.env);
        const evaluator = new Evaluator(block.items, env);
        evaluator.run();
        return evaluator.env;
    },
};

installDialect(coreDialect);

const source = `
  a: 10
  b: 20
  url: https://google.com
  print :a
  print :b
  ctx: context [
    foo: context [
        bar: :a
    ]
    baz: :b
  ]
  print :ctx
  print :ctx/foo
  print :ctx/baz
  print :ctx/foo/bar
`;

const parsed = parse(source);
//console.log("parsed: ", parsed);
const evaluator = new Evaluator(parsed);
evaluator.run();

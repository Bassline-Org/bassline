import * as t from "./types.js";
const types = t.TYPES;
import { normalize } from "../../utils.js";
import { method } from "../../method.js";
import { bind } from "./types.js";
import { parse } from "../../parser.js";
import { doBlock } from "../../evaluator.js";

export const spec = (args) => {
    return args.map((arg) => {
        if (arg.startsWith(":")) {
            return t.getWord(arg.slice(1));
        }
        if (arg.startsWith("'")) {
            return t.litWord(arg.slice(1));
        }
        return t.word(arg);
    });
};

export const nativeFn = (fnSpec, body) => {
    return t.nativeFn({
        spec: spec(fnSpec),
        body,
    });
};
export const nativeMethod = (methodSpec, method) => {
    return t.nativeMethod({
        spec: spec(methodSpec),
        body: method,
    });
};

export const fn = (args, body, parent) => {
    const ctx = t.fn(new Map());
    bind(ctx, t.word("self"), ctx);
    if (parent) {
        bind(ctx, t.word("parent"), parent);
    }
    bind(ctx, t.word("args"), args);
    bind(ctx, t.word("body"), body);
    return ctx;
};

export { defLookup, lookup };

const [defLookup, lookup] = method();
defLookup(types.context, (context, word) => {
    if (t.isAnyWord(word)) {
        const bound = context.value.get(word.value);
        if (!bound) {
            console.log(context.value);
            throw new Error(
                `Word ${word.value.toString()} not found in context`,
            );
        }
        return bound;
    }
});
const lookupWithParent = (context, word) => {
    if (t.isAnyWord(word)) {
        const bound = context.value.get(word.value);
        if (!bound) {
            const parent = context.value.get(normalize("parent"));
            if (!parent) {
                throw new Error(
                    `Word ${word.value.toString()} not found in context, and no parent context found`,
                );
            }
            return lookupWithParent(parent, word);
        }
        return bound;
    }
    throw new Error(`Invalid word: ${word} for context: ${context.type}`);
};
defLookup(types.contextChain, lookupWithParent);
defLookup(types.fn, lookupWithParent);

const ctx = t.context(new Map());
bind(
    ctx,
    t.word("print"),
    nativeFn(["value"], (value, context, iter) => {
        console.log(value.value);
        return value;
    }),
);
const exampleArgs = parse("a b c");
const exampleBody = parse("print a print b print c");
const exampleFn = fn(exampleArgs, exampleBody, ctx);
bind(ctx, t.word("foo"), exampleFn);
//const binding = t.block([t.setWord("foo"), exampleFn]);
//console.log(doBlock(binding, ctx));

const expr = parse("bar: :foo bar foo 1 2 3 foo 4 5 6 foo 7 8 9");
console.log(doBlock(expr, ctx));

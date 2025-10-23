import * as t from "./types.js";
const types = t.TYPES;
import { normalize } from "../../utils.js";
import { method } from "../../method.js";

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

export const bind = (context, key, value) => {
    if (t.isContext(context) && t.isAnyWord(key)) {
        context.value.set(key.value, value);
        return value;
    }
    throw new Error(
        `Cannot bind word: ${key} to value: ${value} in context: ${context.type}`,
    );
};

// All evaluators have the signature: (value, evaluationContext, tokenIterator) => value
const [defEval, evaluate] = method();

const printMethod = nativeFn(["value"], (value, context, iter) => {
    console.log(value.value);
    return value;
});

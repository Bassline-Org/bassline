import * as t from "./types.js";
const types = t.TYPES;
import { normalize } from "../../utils.js";
import { method } from "../../method.js";
import { bind } from "./types.js";

//== Function Creators ==//
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

// == Lookup Methods ==//
export { defLookup, lookup };

const [defLookup, lookup] = method();
defLookup(types.context, (context, word) => {
    if (t.isAnyWord(word)) {
        const bound = context.value.get(word.value);
        if (bound) return bound;
        console.log(context.value);
        throw new Error(`Word ${word.value.toString()} not found in context`);
    }
    throw new Error(
        `Invalid word: ${word} for context: ${JSON.stringify(context.type)}`,
    );
});
const lookupWithParent = (context, word) => {
    if (t.isAnyWord(word)) {
        const bound = context.value.get(word.value);
        if (bound) return bound;
        const hasParent = context.value.has(normalize("parent"));
        if (hasParent) {
            const parent = context.value.get(normalize("parent"));
            return lookup(parent, word);
        } else {
            throw new Error(
                `Word ${word.value.toString()} not found in context, and no parent context found`,
            );
        }
    }
    throw new Error(`Invalid word: ${word} for context chain: ${context.type}`);
};
defLookup(types.contextChain, lookupWithParent);
defLookup(types.fn, lookupWithParent);

export default {
    "get": nativeMethod(["word"], lookup),
};

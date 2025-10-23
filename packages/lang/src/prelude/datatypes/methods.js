import * as t from "./types.js";
import { parse } from "../../parser.js";
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

export const [defLookup, lookup] = method();
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
defLookup(types.contextChain, (context, word) => {
    if (t.isAnyWord(word)) {
        const bound = context.value.get(word.value);
        if (!bound) {
            const parent = context.value.get(normalize("parent"));
            if (!parent) {
                throw new Error(
                    `Word ${word.value.toString()} not found in context, and no parent context found`,
                );
            }
            return lookup(parent, word);
        }
        return bound;
    }
    throw new Error(`Invalid word: ${word} for context: ${context.type}`);
});

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

export const collectArguments = (spec, context, iter) => {
    return spec.map((arg) => {
        const next = iter.next().value;
        if (arg.type === types.litWord) return next;
        if (arg.type === types.getWord) {
            if (t.isFunction(next)) return next;
            if (next.type === types.word) {
                return evaluate(t.getWord(next.value), context, iter);
            }
        }
        return evaluate(next, context, iter);
    });
};

const context = t.context(new Map());
const aFunc = nativeFn(["a"], (a) => {
    return t.number(a * 10);
});
const anotherFunc = nativeFn(["a"], (a) => {
    return t.string(`${a.value.toString()} is a string`);
});
t.bind(context, t.word("a"), t.number(1));
t.bind(context, t.word("anotherFunc"), anotherFunc);
t.bind(context, t.word("aFunc"), aFunc);

export const doBlock = (block, context) => {
    if (block.type === types.block || block.type === types.paren) {
        const iter = t.iter(block);
        let result = null;
        for (const curr of iter) {
            result = evaluate(curr, context, iter);
        }
        return result;
    }
    throw new Error(`Cannot evaluate block: ${JSON.stringify(block)}`);
};

export const reduceBlock = (block, context) => {
    if (block.type === types.block || block.type === types.paren) {
        const iter = t.iter(block);
        const result = iter.reduce(
            (acc, curr) => [...acc, evaluate(curr, context, iter)],
            [],
        );
        return t.block(result);
    }
    throw new Error(`Cannot evaluate block: ${JSON.stringify(block)}`);
};

const printMethod = nativeFn(["value"], (value, context, iter) => {
    console.log(value.value);
    return value;
});

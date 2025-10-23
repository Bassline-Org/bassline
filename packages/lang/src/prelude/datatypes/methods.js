import * as t from "./types.js";
const types = t.TYPES;

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

export const method = () => {
    const cases = {};
    return [
        (type, impl) => {
            cases[type] = impl;
        },
        (first, ...rest) => {
            const { type } = first;
            const impl = cases[type];
            if (impl) {
                return impl(first, ...rest);
            }
            throw new Error(
                `No implementation found for type: ${JSON.stringify(type)}`,
            );
        },
    ];
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

defEval(types.number, (value, context, iter) => value);
defEval(types.string, (value, context, iter) => value);
defEval(types.block, (value, context, iter) => value);
defEval(types.datatype, (value, context, iter) => value);
defEval(types.context, (value, context, iter) => value);
defEval(types.contextChain, (value, context, iter) => value);
defEval(types.paren, (value, context, iter) => {
    const parenIter = t.iter(value);
    return parenIter.reduce((acc, curr) => evaluate(curr, context, parenIter));
});
defEval(
    types.word,
    (value, context, iter) => evaluate(t.lookup(context, value), context, iter),
);
defEval(
    types.setWord,
    (value, context, iter) => {
        const next = iter.next().value;
        const nextValue = evaluate(next, context, iter);
        t.bind(context, value, nextValue);
        return nextValue;
    },
);
defEval(
    types.litWord,
    (value, context, iter) => {
        return t.word(value.value);
    },
);
defEval(
    types.getWord,
    (value, context, iter) => {
        const bound = t.lookup(context, value);
        if (t.isFunction(bound)) {
            return bound;
        } else {
            return evaluate(bound, context, iter);
        }
    },
);
defEval(
    types.nativeFn,
    (fn, context, iter) => {
        const { spec, body } = fn.value;
        const args = collectArguments(spec, context, iter);
        return body(...args, context, iter);
    },
);

const context = t.context(new Map());
const aFunc = nativeFn(["a"], (a) => {
    return t.number(a * 10);
});
const anotherFunc = nativeFn(["a"], (a) => {
    console.log(a.value);
    return t.string(`${a.value.toString()} is a string`);
});
t.bind(context, t.word("a"), t.number(1));
t.bind(context, t.word("anotherFunc"), anotherFunc);
t.bind(context, t.word("aFunc"), aFunc);

const samples = t.block([
    t.word("a"),
    t.getWord("a"),
    t.setWord("a"),
    t.number(123),
    t.string("a"),
    t.block([t.number(1), t.string("a")]),
    t.paren([nativeFn(["a"], (a) => t.number(a * 10)), t.number(2)]),
    t.setWord("foo"),
    t.word("anotherFunc"),
    t.word("anotherFunc"),
    t.word("a"),
    t.word("foo"),
]);

export const doBlock = (block, context) => {
    if (block.type === types.block || block.type === types.paren) {
        const iter = t.iter(block);
        return iter.reduce((acc, curr) => evaluate(curr, context, iter));
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

//console.log(doBlock(samples, context));
console.log(samples);
console.log(reduceBlock(samples, context));
console.log(context);

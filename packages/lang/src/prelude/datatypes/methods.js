import * as t from "./types.js";
import { parse } from "../../parser.js";
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
export const nativeMethod = (methodSpec, method) => {
    return t.nativeMethod({
        spec: spec(methodSpec),
        body: method,
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
                `No implementation found for type: ${JSON.stringify(first)}`,
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

const defEvalDirect = (...types) => {
    return types.forEach((type) => {
        defEval(type, (value, context, iter) => value);
    });
};

for (const type of t.DIRECT_TYPES.values()) {
    defEvalDirect(type, (value, _context, _iter) => value);
}
defEval(types.paren, (value, context, iter) => {
    let result = null;
    const parenIter = t.iter(value);
    for (const curr of parenIter) {
        result = evaluate(curr, context, parenIter);
    }
    return result;
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
defEval(
    types.nativeMethod,
    (method, context, iter) => {
        const { spec, body } = method.value;
        const args = collectArguments(spec, context, iter);
        return body(...args, context, iter);
    },
);

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

const exampleSource = `
foo: 123
bar: "hello"
baz: print print (print "hello")
print do [foo bar]
print reduce [foo bar baz]
`;

const exampleContext = t.context(new Map());

const doFn = nativeFn(
    ["block"],
    (block, context, iter) => doBlock(block, context),
);
const reduceFn = nativeFn(
    ["block"],
    (block, context, iter) => reduceBlock(block, context),
);
t.bind(exampleContext, t.word("do"), doFn);
t.bind(exampleContext, t.word("print"), printMethod);
t.bind(exampleContext, t.word("reduce"), reduceFn);
const example = parse(exampleSource);
console.log(doBlock(example, exampleContext));

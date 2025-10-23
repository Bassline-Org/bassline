import { method } from "./method.js";
import { lookup } from "./prelude/datatypes/methods.js";
import * as t from "./prelude/datatypes/types.js";
const types = t.TYPES;

/**
 * @typedef {{type: Symbol, value: any}} BasslineValue
 * @typedef {{type: Symbol, value: any}} BasslineContext
 * @typedef {Iterator<BasslineValue>} BasslineIterator
 * @typedef {(value: BasslineValue, context: BasslineContext, iter: BasslineIterator) => BasslineValue} EvaluatorFunction
 */

const evaluator = method();
/**
 * Defines a new evaluator for a given type.
 * @param {Symbol} type - The type to define the evaluator for.
 * @param {EvaluatorFunction} fn - The evaluator function.
 * @example
 * defEval(types.word, (value, context, iter) => {
 *     return value;
 * });
 * evaluate(types.word("foo"), context, iter);
 * @returns {void}
 */
export const defEval = evaluator[0];

/**
 * Polymorphic evaluator for bassline types
 * @param {BasslineValue} value - The value to evaluate.
 * @param {BasslineContext} context - The context to evaluate the value in.
 * @param {BasslineIterator} iter - The stream of values we are iterating over.
 * @returns {BasslineValue} The evaluated value.
 */
export const evaluate = evaluator[1];

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

for (const type of t.DIRECT_TYPES.values()) {
    defEval(type, (value, _context, _iter) => value);
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
defEval(
    types.fn,
    (fn, context, iter) => {
        const argSpec = lookup(context, t.word("args"));
        const body = lookup(context, t.word("body"));
        const localContext = t.contextChain(fn);
        const args = collectArguments(argSpec, localContext, iter);
        for (let i = 0; i < args.length; i++) {
            t.bind(localContext, argSpec[i], args[i]);
        }
        return doBlock(body, localContext);
    },
);

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

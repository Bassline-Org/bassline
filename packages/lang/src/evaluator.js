import { Stream } from "./stream.js";
import { Block, Paren, unset } from "./prelude/index.js";
import { method } from "./method.js";
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

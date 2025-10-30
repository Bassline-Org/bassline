/**
 * @typedef {import("./state.js").EvaluationState} EvaluationState
 */

import { parse } from "../../parser.js";
import { TYPES } from "./datatypes/types.js";
import { makeState, runUntilDone } from "./state.js";

/**
 * Collect arguments from the stream according to a function spec string.
 * The number of arguments is determined by parsing the spec string.
 *
 * Spec format examples:
 * - "a b" - two normal arguments (both evaluated)
 * - "'a :b c" - three arguments: lit-word (quoted), get-word (dereferenced), normal (evaluated)
 *
 * @param {EvaluationState} state - Current evaluation state
 * @param {string} spec - Spec string defining argument evaluation rules:
 *   - 'a (lit-word): don't evaluate, quote the value
 *   - :b (get-word): dereference but don't evaluate if function
 *   - a (normal word): evaluate normally
 * @returns {{values: Array<*>, state: EvaluationState}} Object with values array and updated state
 * @throws {Error} If spec is not a valid block or insufficient arguments
 */
export function takeN(state, spec) {
    const specBlock = parse(spec);
    if (specBlock.type !== TYPES.block) {
        throw new Error(`Function spec must be a block, got ${specBlock.type}`);
    }
    const specItems = specBlock.value;
    const n = specItems.length;

    const values = [];
    let currentState = state;

    for (let i = 0; i < n; i++) {
        if (currentState.stream.length === 0) {
            throw new Error(
                `Expected ${n} arguments, got ${values.length}`,
            );
        }

        const argSpec = specItems[i];
        const [head, ...tail] = currentState.stream;

        if (argSpec.type === TYPES.litWord) {
            values.push(head);
            currentState = makeState(
                tail,
                currentState.ctx,
                currentState.konts,
                currentState.dialect,
            );
        } else if (argSpec.type === TYPES.getWord) {
            if (head.type === TYPES.word) {
                const spelling = head.spelling || head.value;
                const bound = currentState.ctx.get 
                    ? currentState.ctx.get(spelling) 
                    : currentState.ctx[spelling];
                if (!bound) {
                    throw new Error(`Undefined word: ${spelling}`);
                }
                if (bound.type === TYPES.fn || bound.type === TYPES.nativeFn) {
                    values.push(bound);
                    currentState = makeState(
                        tail,
                        currentState.ctx,
                        currentState.konts,
                        currentState.dialect,
                    );
                } else {
                    const result = runUntilDone(currentState);
                    values.push(result.value);
                    currentState = makeState(
                        result.rest,
                        currentState.ctx,
                        currentState.konts,
                        currentState.dialect,
                    );
                }
            } else {
                const result = runUntilDone(currentState);
                values.push(result.value);
                currentState = makeState(
                    result.rest,
                    currentState.ctx,
                    currentState.konts,
                    currentState.dialect,
                );
            }
        } else {
            const result = runUntilDone(currentState);
            values.push(result.value);
            currentState = makeState(
                result.rest,
                currentState.ctx,
                currentState.konts,
                currentState.dialect,
            );
        }
    }

    return {
        values,
        state: currentState,
    };
}

/**
 * Function constructor - creates invocable values.
 * @param {Function} body - Function body that receives (state, ctx, k) -> nextState
 * @param {string|null} [spec=null] - Optional spec string like "a b" or "'a :b c" to control argument evaluation
 * @returns {Object} Function object with type TYPES.fn
 */
export function fn(body, spec = null) {
    if (typeof body === "object" && body.value && body.type === TYPES.fn) {
        return body;
    }
    const func = (state, ctx, k) => {
        return body(state, ctx, k);
    };
    func.spec = spec;
    return {
        type: TYPES.fn,
        value: func,
        spec: spec,
    };
}

/**
 * Build a CPS function that uses takeN with a spec.
 * @param {string} spec - Required spec string like "a b" specifying argument evaluation rules
 * @param {Function} compute - Function that receives evaluated arguments
 * @returns {Object} Function object with type TYPES.fn
 */
export function buildCpsFunction(spec, compute) {
    return fn((state, context, k) => {
        const { values, state: nextState } = takeN(state, spec);
        const result = compute(...values);
        return k(result, nextState);
    }, spec);
}


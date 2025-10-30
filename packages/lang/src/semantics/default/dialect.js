/**
 * @typedef {import("./state.js").EvaluationState} EvaluationState
 * @typedef {import("./state.js").EvaluationResult} EvaluationResult
 */

import { makeState, pushKont, popKont, setDefaultDialect } from "./state.js";
import { TYPES } from "./datatypes/types.js";
import { takeN } from "./functions.js";

/**
 * The do semantics are the default semantic rules for evaluation blocks.
 * This is the semantics at the top level, as top level expressions are implicitly wrapped in a block,
 * and passed into the do block. Which will evaluate all expressions in the block under these rules,
 * and return the final value of the block.
 * @type {import("./state.js").Dialect}
 */
export const doSemantics = {
    semantics: {
        /**
         * Handle word! type - look up the word in context and substitute its bound value.
         * @param {EvaluationState} state - Current evaluation state
         * @returns {EvaluationState} New state with bound value substituted for word
         * @throws {Error} If word is undefined in context
         */
        [TYPES.word](state) {
            const [head, ...tail] = state.stream;
            // head is a Value instance (Word), use its spelling property
            // spelling is a Symbol in the Value system
            const spelling = head.spelling || head.value;
            const bound = state.ctx.get ? state.ctx.get(spelling) : state.ctx[spelling];
            if (!bound) {
                const spellingStr = typeof spelling === 'symbol' ? spelling.description : spelling;
                throw new Error(`Undefined word: ${spellingStr}`);
            }
            return makeState(
                [bound, ...tail],
                state.ctx,
                state.konts,
                state.dialect,
            );
        },

        /**
         * Handle get-word! type - look up the word and return its bound value.
         * @param {EvaluationState} state - Current evaluation state
         * @returns {EvaluationState|EvaluationResult} New state or result with bound value
         * @throws {Error} If word is undefined in context
         */
        [TYPES.getWord](state) {
            const [head, ...tail] = state.stream;
            const spelling = head.spelling || head.value;
            const bound = state.ctx.get ? state.ctx.get(spelling) : state.ctx[spelling];
            if (!bound) {
                const spellingStr = typeof spelling === 'symbol' ? spelling.description : spelling;
                throw new Error(`Undefined word: ${spellingStr}`);
            }

            if (state.konts.length > 0) {
                const kontFrame = popKont(state);
                return kontFrame.k(bound, tail, kontFrame.state);
            }
            return { value: bound, rest: tail };
        },

        /**
         * Handle set-word! type - assign a value to a word in context.
         * Pushes a continuation to assign after evaluating the value.
         * @param {EvaluationState} state - Current evaluation state
         * @returns {EvaluationState} New state with continuation pushed for assignment
         */
        [TYPES.setWord](state) {
            const [head, ...tail] = state.stream;
            const spelling = head.spelling || head.value;
            const outerKonts = state.konts;
            return pushKont(
                makeState(tail, state.ctx, [], state.dialect),
                (val, rest, ctxState) => {
                    // ctx should be a ContextBase/ContextChain instance with set() method
                    if (ctxState.ctx && typeof ctxState.ctx.set === 'function') {
                        ctxState.ctx.set(spelling, val);
                    } else {
                        // Fallback for plain object contexts
                        ctxState.ctx[spelling] = val;
                    }
                    if (outerKonts.length > 0) {
                        const kontFrame = popKont({
                            ...ctxState,
                            konts: outerKonts,
                        });
                        return kontFrame.k(val, rest, kontFrame.state);
                    }
                    return { value: val, rest };
                },
            );
        },

        /**
         * Handle fn! type - invoke a user-defined function (PureFn).
         * @param {EvaluationState} state - Current evaluation state
         * @returns {EvaluationState|EvaluationResult} Next state or result from function invocation
         */
        [TYPES.fn](state) {
            const [head, ...tail] = state.stream;
            // head is a PureFn instance
            const pureFn = head;
            const fnState = makeState(
                tail,
                state.ctx,
                state.konts,
                state.dialect,
            );
            const outerKonts = state.konts;
            
            // Use PureFn's invoke method
            const result = pureFn.invoke(
                fnState,
                state.ctx,
                (value, nextState) => {
                    const restStream = nextState && nextState.stream
                        ? nextState.stream
                        : [];
                    if (outerKonts.length > 0) {
                        const kontFrame = popKont({
                            ...state,
                            konts: outerKonts,
                        });
                        return kontFrame.k(value, restStream, kontFrame.state);
                    }
                    return { value, rest: restStream };
                },
            );

            if (result && result.stream !== undefined) {
                return result;
            }
            return result;
        },

        /**
         * Handle native-fn! type - invoke a native function.
         * @param {EvaluationState} state - Current evaluation state
         * @returns {EvaluationState|EvaluationResult} Next state or result from function invocation
         */
        [TYPES.nativeFn](state) {
            const [head, ...tail] = state.stream;
            // head is a NativeFn instance
            const nativeFn = head;
            const fnState = makeState(
                tail,
                state.ctx,
                state.konts,
                state.dialect,
            );
            const outerKonts = state.konts;
            
            // Get spec string from NativeFn and use takeN to collect arguments
            // Spec is stored as a string and parsed by takeN
            const specString = nativeFn.spec;
            const { values, state: nextState } = takeN(fnState, specString);
            
            // Call the native function with collected arguments
            // Native functions receive (arg1, arg2, ..., context, continuation)
            // But continuation is optional and they usually just return the result
            const result = nativeFn.fn(...values, state.ctx);
            
            // Wrap result in continuation if needed
            const restStream = nextState && nextState.stream ? nextState.stream : [];
            if (outerKonts.length > 0) {
                const kontFrame = popKont({
                    ...state,
                    konts: outerKonts,
                });
                return kontFrame.k(result, restStream, kontFrame.state);
            }
            return { value: result, rest: restStream };
        },

        /**
         * Default handler for literal values (numbers, strings, blocks, etc.).
         * Returns the value directly, checking for continuations.
         * @param {EvaluationState} state - Current evaluation state
         * @returns {EvaluationResult} Result with the literal value
         */
        default(state) {
            const [head, ...tail] = state.stream;
            if (state.konts.length > 0) {
                const kontFrame = popKont(state);
                return kontFrame.k(head, tail, kontFrame.state);
            }
            return { value: head, rest: tail };
        },
    },
};

// Set default dialect in state.js to avoid circular dependency
setDefaultDialect(doSemantics);


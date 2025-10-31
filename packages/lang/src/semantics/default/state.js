/**
 * @typedef {Object} EvaluationState
 * @property {Array} stream - Array of remaining AST nodes to evaluate
 * @property {Object} ctx - Environment/context for variable lookup
 * @property {Array<ContinuationFrame>} konts - Stack of continuation frames
 * @property {Dialect} dialect - Semantic rules for interpreting types
 */

/**
 * @typedef {Object} ContinuationFrame
 * @property {Function} k - Continuation function (value, rest, state) => State|Result
 * @property {EvaluationState} state - State associated with this continuation
 * @property {string} [type] - Type of continuation (e.g., "assignment", "function-call", "block-eval")
 * @property {string} [description] - Human-readable description of what this continuation does
 * @property {Object} [source] - Source location info (if available) with line, column, filename
 * @property {Object} [contextSnapshot] - Snapshot of relevant context variables at continuation creation
 */

/**
 * @typedef {Object} EvaluationResult
 * @property {*} value - The evaluated value
 * @property {Array} rest - Remaining stream items after evaluation
 * @property {Object} [ctx] - Updated context (optional)
 */

/**
 * @typedef {Object} Dialect
 * @property {Object<string, SemanticHandler>} semantics - Map of type names to handler functions
 * @property {SemanticHandler} [default] - Default handler for unmatched types
 */

/**
 * @typedef {Function} SemanticHandler
 * @param {EvaluationState} state - Current evaluation state
 * @returns {EvaluationState|EvaluationResult} New state or result object
 */

/**
 * Create an evaluation state that carries everything needed to continue evaluation.
 * @param {Array|*} stream - Array of remaining items to evaluate (or single item)
 * @param {Object} ctx - Environment/context for variable lookup
 * @param {Array<ContinuationFrame>} [konts=[]] - Stack of continuation frames
 * @param {Dialect} [dialect] - Semantic rules for interpreting types (defaults to doSemantics)
 * @returns {EvaluationState} State object with stream, ctx, konts, and dialect properties
 */
let defaultDialectCache = null;

/**
 * Set the default dialect (called by dialect.js to avoid circular dependency).
 * @param {Dialect} dialect - The default dialect to use
 */
export function setDefaultDialect(dialect) {
    defaultDialectCache = dialect;
}

export function makeState(stream, ctx, konts = [], dialect = null) {
    // Default dialect will be set by dialect.js to avoid circular dependency
    if (!dialect && defaultDialectCache) {
        dialect = defaultDialectCache;
    }
    return {
        stream: Array.isArray(stream) ? stream : [stream],
        ctx,
        konts,
        dialect: dialect,
    };
}

/**
 * Push a continuation frame onto the continuation stack.
 * @param {EvaluationState} state - Current evaluation state
 * @param {Function} k - Continuation function (value, rest, state) => nextState
 * @param {Object} [metadata] - Optional metadata about the continuation
 * @param {string} [metadata.type] - Type of continuation (e.g., "assignment", "function-call", "block-eval")
 * @param {string} [metadata.description] - Human-readable description
 * @param {Object} [metadata.source] - Source location {line, column, filename}
 * @param {Object} [metadata.contextSnapshot] - Snapshot of relevant context variables
 * @returns {EvaluationState} New state with continuation pushed onto stack
 */
export function pushKont(state, k, metadata = {}) {
    const frame = { k, state: { ...state }, ...metadata };
    return { ...state, konts: [...state.konts, frame] };
}

/**
 * Pop a continuation frame from the continuation stack.
 * @param {EvaluationState} state - Current evaluation state
 * @returns {ContinuationFrame|null} Continuation frame with k, state, and metadata, or null if stack is empty
 */
export function popKont(state) {
    if (state.konts.length === 0) return null;
    const [frame, ...restKonts] = state.konts;
    // Ensure frame has k and state properties
    const result = {
        ...frame,
        state: { ...state, konts: restKonts },
    };
    return result;
}

/**
 * Perform a single step of evaluation.
 * @param {EvaluationState} state - Current evaluation state
 * @returns {EvaluationState|EvaluationResult} Either a new state or result object with value/rest
 * @throws {Error} If stream is empty
 */
export function step(state) {
    if (state.stream.length === 0) {
        throw new Error("Cannot step: stream is empty");
    }

    const [head] = state.stream;
    const handler = state.dialect.semantics[head.type] ??
        state.dialect.semantics.default;
    return handler(state);
}

/**
 * Run evaluation until we hit a continuation or return a value.
 * Continues stepping through the state machine until a result is produced.
 * @param {EvaluationState} state - Initial evaluation state
 * @returns {EvaluationResult} Result object with value, rest, and ctx properties
 * @throws {Error} If state is invalid, stream exhausted unexpectedly, or evaluation ends without value
 */
export function runUntilDone(state) {
    let currentState = state;

    while (true) {
        if (!currentState || !currentState.stream) {
            throw new Error(
                `Invalid state in runUntilDone: ${
                    JSON.stringify(currentState)
                }`,
            );
        }
        if (currentState.stream.length === 0) {
            const kontFrame = popKont(currentState);
            if (kontFrame) {
                throw new Error(
                    "Stream exhausted but continuation expects a value",
                );
            }
            throw new Error("Evaluation ended without returning a value");
        }

        const result = step(currentState);

        if (result.value !== undefined) {
            const kontFrame = popKont(currentState);
            if (kontFrame) {
                const nextResult = kontFrame.k(
                    result.value,
                    result.rest,
                    kontFrame.state,
                );
                if (nextResult && nextResult.stream !== undefined) {
                    currentState = nextResult;
                    continue;
                }
                if (nextResult && nextResult.value !== undefined) {
                    return {
                        value: nextResult.value,
                        rest: nextResult.rest ?? [],
                        ctx: nextResult.ctx ?? kontFrame.state.ctx,
                    };
                }
                throw new Error(
                    `Continuation returned invalid result: ${
                        JSON.stringify(nextResult)
                    }`,
                );
            }
            return {
                value: result.value,
                rest: result.rest ?? [],
                ctx: result.ctx ?? currentState.ctx,
            };
        }

        currentState = result;
    }
}

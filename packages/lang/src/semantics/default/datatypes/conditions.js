import { normalize } from "../../../utils.js";
import { ContextChain } from "../contexts.js";
import { Block, Datatype, LitWord, Value } from "./core.js";
import { nativeFn } from "./functions.js";
import * as t from "./types.js";
const { TYPES } = t;

// VERY IMPORTANT: I am not happy with this implementation of conditions.
// I WILL LIKELY BE RIPPING THIS APART!!!!

/**
 * Signal a condition with the current evaluation state.
 * This captures the state and evaluates the condition through the handler system.
 * @param {*} conditionType - Condition type (LitWord or string)
 * @param {Object} state - EvaluationState object with stream, ctx, konts, dialect
 * @param {Object} context - Context to create condition in
 * @param {Function} [registerRestarts] - Optional function to register restarts on condition
 * @returns {*} Result from condition handler or thrown MissingHandler if no handler
 */
export function signalCondition(
    conditionType,
    state,
    context,
    registerRestarts,
) {
    // Normalize condition type
    const type = typeof conditionType === "string"
        ? new LitWord(normalize(conditionType))
        : conditionType;

    // Create condition with current context
    const condition = new Condition(type, context);

    // Capture evaluation state
    condition.captureState(state);

    // Register additional restarts FIRST (so they can override defaults)
    if (registerRestarts) {
        registerRestarts(condition);
    }

    // Register default restarts AFTER (but only if not already registered)
    // This ensures custom restarts override defaults, but defaults fill in gaps
    registerDefaultRestarts(condition);

    // Return the condition - the dialect will handle it
    return condition;
}

export class MissingHandler extends Error {
    constructor(condition, iter) {
        super(`No handler found for condition: ${condition.type.description}`);
        this.condition = condition;
        this.iter = iter;
    }
}

const modes = {
    error: normalize("error"),
    warning: normalize("warning"),
    info: normalize("info"),
    debug: normalize("debug"),
    trace: normalize("trace"),
};

const error = nativeFn("", (context) => {
    context.set("mode", new LitWord(modes.error));
});
const warning = nativeFn("", (context) => {
    context.set("mode", new LitWord(modes.warning));
});
const info = nativeFn("", (context) => {
    context.set("mode", new LitWord(modes.info));
});

export class Condition extends ContextChain.typed(TYPES.condition) {
    constructor(type, context) {
        super(context);
        this.set("type", type);
        this.set("mode", new LitWord(modes.error));
        this.set("error-mode", error);
        this.set("warning-mode", warning);
        this.set("info-mode", info);
        // Evaluation state captured when condition is signaled
        this._evaluationState = null;
        // Restarts are stored as a map of name -> function
        this._restarts = new Map();
    }

    /**
     * Capture evaluation state at the point where condition was signaled.
     * @param {Object} state - EvaluationState object with stream, ctx, konts, dialect
     */
    captureState(state) {
        this._evaluationState = {
            stream: state.stream ? [...state.stream] : [],
            ctx: state.ctx,
            konts: state.konts ? [...state.konts] : [],
            dialect: state.dialect,
        };
        // Store in context for access via get
        this.set("stream", new Block(state.stream || []));
        this.set("context", state.ctx);
        this.set("continuations", new Block(state.konts || []));
    }

    /**
     * Get the captured evaluation state.
     * @returns {Object|null} EvaluationState object or null if not captured
     */
    getState() {
        return this._evaluationState;
    }

    /**
     * Register a restart function.
     * @param {string|Symbol} name - Restart name
     * @param {Function|NativeFn|PureFn} restartFn - Function to invoke when restart is called
     * @param {string} [spec] - Optional spec string for the restart (if it's a nativeFn)
     */
    registerRestart(name, restartFn, spec) {
        const nameSym = typeof name === "string" ? normalize(name) : name;
        // Overwrite any existing restart with the same name (allows custom restarts to override defaults)
        this._restarts.set(nameSym, { fn: restartFn, spec });
        // Also store in context for access
        this.set(nameSym, restartFn);
    }

    /**
     * Get all registered restarts.
     * @returns {Array<{name: Symbol, fn: Function, spec?: string}>} Array of restart info
     */
    getRestarts() {
        return Array.from(this._restarts.entries()).map(([name, info]) => ({
            name,
            fn: info.fn,
            spec: info.spec,
        }));
    }

    /**
     * Invoke a restart by name.
     * @param {string|Symbol} name - Restart name
     * @param {...*} args - Arguments to pass to restart function
     * @returns {*} Result from restart function
     * @throws {Error} If restart not found
     */
    invokeRestart(name, ...args) {
        const nameSym = typeof name === "string" ? normalize(name) : name;
        const restart = this._restarts.get(nameSym);
        if (!restart) {
            const nameStr = typeof nameSym === "symbol"
                ? nameSym.description
                : String(nameSym);
            throw new Error(`Restart "${nameStr}" not found`);
        }
        // Invoke the restart function
        // NativeFn stores the function in .fn property
        if (restart.fn && restart.fn.type === TYPES.nativeFn) {
            // It's a NativeFn - call its fn property with args and condition
            return restart.fn.fn(...args, this);
        }
        // Plain function
        if (typeof restart.fn === "function") {
            return restart.fn(...args, this);
        }
        throw new Error(`Restart "${nameSym.description}" is not invocable`);
    }
    static make(type, context) {
        return new Condition(type, context);
    }

    moldBody() {
        return this.relevantEntries().map(([key, value]) => {
            return `${key.description}: ${value.mold()}`;
        }).join("\n  ");
    }

    mold() {
        return `(make condition! [${
            this.get("type").mold()
        } [${this.moldBody()}]])`;
    }

    static make(args, context, iter) {
        const [type, restartsBlock] = args.items;
        const condition = new Condition(type, context);
        // Evaluate restartsBlock in condition context to register restarts
        evaluateBlock(restartsBlock, condition);
        return condition;
    }
}

// Common restart functions
const abortRestart = nativeFn("", (condition) => {
    // Abort - throw an error to unwind to top level
    throw new Error("Abort restart invoked");
});

const retryRestart = nativeFn("", (condition) => {
    // Retry - re-evaluate from the captured state
    const state = condition.getState();
    if (!state) {
        throw new Error("Cannot retry: no evaluation state captured");
    }
    // Return the state so evaluation can resume
    // This will be handled by the condition handler
    return state;
});

const useValueRestart = nativeFn("value", (value, condition) => {
    // Use-value - provide an alternative value and continue
    // Store the value in condition context
    condition.set("use-value", value);
    // Return modified state to continue evaluation
    const state = condition.getState();
    if (!state) {
        return { value, rest: [] };
    }
    if (state.stream && state.stream.length > 0) {
        // Get the first item to see what we're replacing
        const [head, ...rest] = state.stream;
        // Replace first item in stream with the provided value
        return {
            ...state,
            stream: [value, ...rest],
        };
    }
    return { value, rest: [] };
});

const storeValueRestart = nativeFn("value", (value, condition) => {
    // Store-value - store a value in context and retry
    condition.set("store-value", value);
    const state = condition.getState();
    if (!state) {
        throw new Error("Cannot store-value: no evaluation state captured");
    }

    // Get the word that was undefined (if available)
    // Use try-catch to handle case where word might not be set
    let word;
    try {
        word = condition.get("word");
    } catch (e) {
        // Word not set in condition, skip storing
        word = null;
    }

    if (word) {
        // Extract word string from Str object
        let wordStr;
        if (word.value !== undefined) {
            wordStr = word.value;
        } else if (word.to && typeof word.to === "function") {
            try {
                const wordVal = word.to(TYPES.string);
                wordStr = wordVal?.value || wordVal?.form?.()?.value ||
                    String(wordVal);
            } catch (e) {
                wordStr = String(word);
            }
        } else {
            wordStr = String(word);
        }

        // Store the value in the context for this word
        // Context.set() expects a normalized symbol, so normalize the word string
        const normalizedWord = normalize(wordStr);
        if (state.ctx && typeof state.ctx.set === "function") {
            try {
                state.ctx.set(normalizedWord, value);
            } catch (e) {
                // Fallback to direct property assignment
                state.ctx[normalizedWord] = value;
            }
        } else if (state.ctx) {
            state.ctx[normalizedWord] = value;
        }
    }

    // Return the state to retry evaluation
    return state;
});

const continueRestart = nativeFn("", (condition) => {
    // Continue - ignore error and continue (for warnings/info)
    // Just return the current state to continue evaluation
    const state = condition.getState();
    if (!state) {
        throw new Error("Cannot continue: no evaluation state captured");
    }
    return state;
});

// Helper to register default restarts on a condition
// Only registers if not already present (allows custom restarts to override)
export function registerDefaultRestarts(condition) {
    const useValueSym = normalize("use-value");
    const storeValueSym = normalize("store-value");
    const abortSym = normalize("abort");
    const retrySym = normalize("retry");
    const continueSym = normalize("continue");

    // Only register if not already present
    if (!condition._restarts.has(abortSym)) {
        condition.registerRestart("abort", abortRestart);
    }
    if (!condition._restarts.has(retrySym)) {
        condition.registerRestart("retry", retryRestart);
    }
    if (!condition._restarts.has(useValueSym)) {
        condition.registerRestart("use-value", useValueRestart, "value");
    }
    if (!condition._restarts.has(storeValueSym)) {
        condition.registerRestart("store-value", storeValueRestart, "value");
    }
    if (!condition._restarts.has(continueSym)) {
        condition.registerRestart("continue", continueRestart);
    }
}

export default {
    "condition!": new Datatype(Condition),
};

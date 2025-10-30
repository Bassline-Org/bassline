/**
 * Default semantics for evaluation.
 * Exports the dialect, state machine, functions, contexts, and polymorphic dispatch.
 */

export { doSemantics } from "./dialect.js";
export {
    makeState,
    popKont,
    pushKont,
    runUntilDone,
    setDefaultDialect,
    step,
} from "./state.js";
export { buildCpsFunction, fn, takeN } from "./functions.js";
export {
    context,
    ContextBase,
    ContextChain,
    contextChain,
    getMany,
    setMany,
} from "./contexts.js";
export { PureFn, pureFn } from "./pure-fn.js";
export { dispatchPolymorphic, polymorphicDispatch } from "./polymorphic.js";
export {
    composeBlock,
    evaluate,
    evaluateBlock,
    evaluateParen,
} from "./evaluate.js";

// Export datatypes
export * from "./datatypes/index.js";

// Re-export everything from datatypes and actions for convenience
import datatypes from "./datatypes/index.js";
import actions from "./actions.js";
import contexts from "./contexts.js";
import pureFn from "./pure-fn.js";

// Export actions (native functions) - export after import to avoid circular dependency
export { default as actions } from "./actions.js";

export default {
    ...datatypes,
    ...actions,
    ...contexts,
    ...pureFn,
};

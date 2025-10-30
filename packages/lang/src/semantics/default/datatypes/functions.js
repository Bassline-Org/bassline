import { Datatype, GetWord, Str, Value } from "./core.js";
import * as t from "./types.js";
const { TYPES } = t;

/**
 * Native functions are functions implemented in the host language
 * Unlike user-defined functions, they don't have a context
 * And unlike methods, they have a single implementation for all arguments
 *
 * The spec is stored as a string and will be parsed by the dialect/semantics layer when needed.
 */
export class NativeFn extends Value.typed(TYPES.nativeFn) {
    constructor(spec, fn) {
        // Store spec as string - parsing happens in dialect/semantics layer
        super({
            spec: spec, // Store spec string, not parsed items
            fn: fn,
        });
    }
    get spec() {
        // Return the spec string - dialect will parse it when needed
        return this.value.spec;
    }
    get fn() {
        return this.value.fn;
    }
    // Removed evaluate() - dialects handle function invocation through fn handler
    form() {
        // Spec is a string, so just display it
        return new Str(`native-fn! spec: ${this.spec}`);
    }
    mold() {
        // No mold for native functions
        return "";
    }
}

export const nativeFn = (spec, fn) => {
    return new NativeFn(spec, fn);
};

// Removed collectArguments - replaced by takeN in semantics/default/functions.js
// This function used the old iterator-based evaluation which has been replaced
// by the state machine evaluator

const makeFn = nativeFn("type value", (type, value, context) => {
    // Pass the raw value to the make method
    // Individual make methods handle their own evaluation needs
    return type.value.make(value, context);
});

export default {
    "native-fn!": new Datatype(NativeFn),
    "make": makeFn,
};

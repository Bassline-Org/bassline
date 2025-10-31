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
        super({
            spec: spec,
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
    form() {
        return new Str(`native-fn! spec: ${this.spec}`);
    }
    mold() {
        return "";
    }
}

export const nativeFn = (spec, fn) => {
    return new NativeFn(spec, fn);
};

const makeFn = nativeFn("type value", (type, value, context) => {
    return type.value.make(value, context);
});

export default {
    "native-fn!": new Datatype(NativeFn),
    "make": makeFn,
};

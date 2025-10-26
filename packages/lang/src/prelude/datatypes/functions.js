import { Datatype, GetWord, Str, Value } from "./core.js";
import * as t from "./types.js";
const { TYPES } = t;
import { parse } from "../../parser.js";

/**
 * Native functions are functions implemented in the host language
 * Unlike user-defined functions, they don't have a context
 * And unlike methods, they have a single implementation for all arguments
 */
export class NativeFn extends Value.typed(TYPES.nativeFn) {
    constructor(spec, fn) {
        super({
            spec: parse(spec),
            fn: fn,
        });
    }
    get spec() {
        return this.value.spec.items;
    }
    get fn() {
        return this.value.fn;
    }
    evaluate(context, iter) {
        //try {
        const args = collectArguments(this.spec, context, iter);
        return this.fn(...args, context, iter);
        //} catch (error) {
        //    const condition = new Condition(normalize("error"));
        //    return condition.evaluate(context, iter);
        //}
    }
    form() {
        return new Str(`native-fn! spec: [ ${this.spec.join(", ")} ]`);
    }
    mold() {
        // No mold for native functions
        return "";
    }
}

export const nativeFn = (spec, fn) => {
    return new NativeFn(spec, fn);
};

export function collectArguments(spec, context, iter) {
    //console.log("collectArguments: ", spec);
    return spec.map((arg) => {
        const next = iter.next().value;
        if (next === undefined) {
            console.error(
                "Expected argument, got undefined: ",
                arg,
                next,
                iter,
            );
            throw new Error("Expected argument, got undefined");
        }
        //console.log("next: ", next);
        if (arg.type === TYPES.litWord) return next;
        if (arg.type === TYPES.getWord) {
            if (t.isFunction(next)) return next;
            if (next.type === TYPES.word) {
                return new GetWord(next.spelling).evaluate(context, iter);
            }
        }
        return next.evaluate(context, iter);
    });
}

export const make = nativeFn("type value", (type, value, context, iter) => {
    return type.value.make(value, context, iter);
});

export default {
    "native-fn!": new Datatype(NativeFn),
    "make": make,
};

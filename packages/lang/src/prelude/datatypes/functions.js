import { ContextChain } from "./context.js";
import { Datatype, GetWord, Str, Value } from "./core.js";
import * as t from "./types.js";
const { TYPES } = t;
import { parse } from "../../parser.js";

export function collectArguments(spec, context, iter) {
    return spec.map((arg) => {
        const next = iter.next().value;
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
        const args = collectArguments(this.spec, context, iter);
        return this.fn(...args, context, iter);
    }
    form() {
        return new Str(`native-fn! spec: [ ${this.spec.join(", ")} ]`);
    }
}

export const nativeFn = (spec, fn) => {
    return new NativeFn(spec, fn);
};
export const unaryMethod = (selector, names = ["a"]) => {
    return new NativeMethod(names, selector);
};
export const binaryMethod = (selector, names = ["a", "b"]) => {
    return new NativeMethod(names, selector);
};
export const ternaryMethod = (selector, names = ["a", "b", "c"]) => {
    return new NativeMethod(names, selector);
};

export class NativeMethod extends NativeFn.typed(TYPES.nativeMethod) {
    constructor(spec, selector) {
        super(spec, ([target, ...args], context, iter) => {
            const method = target[selector];
            if (!method) {
                throw new Error(
                    `No method "${selector}" found on ${target.type}`,
                );
            }
            return method.call(target, ...args, context, iter);
        });
        this.selector = selector;
    }
    form() {
        console.log("NativeMethod form", this.spec, this.selector);
        return new Str(
            `native-method! spec: [ ${this.spec.join(", ")} ]`,
        );
    }
}

export class PureFn extends ContextChain.typed(TYPES.fn) {
    constructor(spec, body, parent) {
        super(parent);
        this.set("spec", spec);
        this.set("body", body);
    }
    evaluate(context, iter) {
        const localCtx = new ContextChain(context);
        const spec = this.get("spec");
        const body = this.get("body");
        const args = collectArguments(spec.items, localCtx, iter);
        return body.doBlock(args, localCtx);
    }
    mold() {
        const args = this.get("args");
        const body = this.get("body");
        return new Str(
            `(make pure-fn! ${args.mold().value} ${body.mold().value})`,
        );
    }
    static make(stream, context) {
        const args = stream.next().evaluate(stream, context).to("block!");
        const body = stream.next().evaluate(stream, context).to("block!");
        return new PureFn(args, body);
    }
}

export const make = nativeFn("type value", (type, value, context, iter) => {
    return type.make(value, context, iter);
});

export default {
    "native-fn!": new Datatype(NativeFn),
    "native-method!": new Datatype(NativeMethod),
    "fn!": new Datatype(PureFn),
    "make": make,
};

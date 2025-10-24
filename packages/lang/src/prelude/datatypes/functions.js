import { ContextChain } from "./context.js";
import {
    Condition,
    Datatype,
    GetWord,
    LitWord,
    Restart,
    Str,
    Value,
} from "./core.js";
import * as t from "./types.js";
const { TYPES } = t;
import { parse } from "../../parser.js";
import { normalize } from "../../utils.js";

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
        try {
            const args = collectArguments(this.spec, context, iter);
            return this.fn(...args, context, iter);
        } catch (error) {
            const condition = new Condition(normalize("error"));
            return condition.evaluate(context, iter);
        }
    }
    form() {
        return new Str(`native-fn! spec: [ ${this.spec.join(", ")} ]`);
    }
}

export const nativeFn = (spec, fn) => {
    return new NativeFn(spec, fn);
};

export class PureFn extends ContextChain.typed(TYPES.fn) {
    constructor(spec, body, parent) {
        super(parent);
        this.set("spec", spec);
        this.set("body", body);
    }
    evaluate(context, iter) {
        try {
            const localCtx = new ContextChain(context);
            const spec = this.get("spec");
            const body = this.get("body");
            const args = collectArguments(spec.items, localCtx, iter);
            args.forEach((arg, index) => {
                localCtx.set(spec.items[index], arg);
            });
            return body.doBlock(localCtx);
        } catch (error) {
            const condition = new Condition(normalize("error"));
            return condition.evaluate(context, iter);
        }
    }
    mold() {
        const args = this.get("args");
        const body = this.get("body");
        return new Str(
            `(make pure-fn! ${args.mold().value} ${body.mold().value})`,
        );
    }
    static make(value, context) {
        if (value.type !== TYPES.block) {
            throw new Error("Invalid value for make");
        }
        const [args, body] = value.items;
        return new PureFn(args, body, context);
    }
}

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

export const make = nativeFn("type value", (type, value, context, iter) => {
    return type.value.make(value, context, iter);
});

export default {
    "native-fn!": new Datatype(NativeFn),
    "fn!": new Datatype(PureFn),
    "make": make,
};

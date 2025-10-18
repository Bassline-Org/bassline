import { Context } from "./context.js";
import { Block, Datatype, Str, Value } from "./core.js";
import { normalizeString } from "../utils.js";
import { evaluate } from "../evaluator.js";
/**
 * Native functions are functions implemented in the host language
 * Unlike user-defined functions, they don't have a context
 * And unlike methods, they have a single implementation for all arguments
 */
export class NativeFn extends Value {
    static type = normalizeString("native-fn!");
    constructor(spec, fn) {
        super();
        this.fn = fn;
        this.spec = spec;
    }
    getArgs(stream, context) {
        return this.spec.map((arg) => {
            const value = stream.next();
            //console.log(value);
            if (arg.startsWith(":")) {
                return value;
            } else {
                return value.evaluate(stream, context);
            }
        });
    }
    evaluate(stream, context) {
        const args = this.getArgs(stream, context);
        const result = this.fn(args, stream, context);
        return result;
    }
    form() {
        return new Str(`native-fn! spec: [ ${this.spec.join(", ")} ]`);
    }
    mold() {
        return "native";
    }
}

export class NativeMethod extends NativeFn {
    static type = normalizeString("native-method!");
    constructor(spec, selector) {
        super(spec, ([target, ...args], stream, context) => {
            const method = target[selector];
            if (!method) {
                throw new Error(
                    `No method "${selector}" found on ${target.type}`,
                );
            }
            return (target[selector])(...args, stream, context);
        });
        this.selector = selector;
    }
    static unary(selector) {
        return new NativeMethod(["a"], selector);
    }
    static binary(selector) {
        return new NativeMethod(["a", "b"], selector);
    }
    static ternary(selector) {
        return new NativeMethod(["a", "b", "c"], selector);
    }
    static make(stream, context) {
        throw new Error(
            "Cannot use make with native-method! It's a primitive data type!",
        );
    }
    form() {
        return new Str(
            `native-method! spec: [ ${this.spec.join(", ")} ]`,
        );
    }
}

export class Fn extends Context {
    static type = normalizeString("fn!");
    constructor(parentContext, args, body) {
        super(parentContext);
        this.set("args", args);
        this.set("body", body);
    }

    evaluate(stream, context) {
        for (const arg of this.get("args").items) {
            this.set(
                arg.spelling,
                stream.next().evaluate(stream, context),
            );
        }
        const body = this.get("body");
        return evaluate(body, this);
    }
    form() {
        return new Str(`fn! [
    args: [${this.get("args").form().value}]
    body: ${this.get("body").form().value}
]`);
    }
    static make(stream, context) {
        const args = stream.next().to("block!");
        const body = stream.next().to("block!");
        return new Fn(context, args, body);
    }
}

export default {
    "native-fn!": new Datatype(NativeFn),
    "fn!": new Datatype(Fn),
    "native-method!": new Datatype(NativeMethod),
};

import { Context } from "./context.js";
import { Datatype, Value } from "./core.js";

/**
 * Native functions are functions implemented in the host language
 * Unlike user-defined functions, they don't have a context
 * And unlike methods, they have a single implementation for all arguments
 */
export class NativeFn extends Value {
    constructor(spec, fn, type = "native-fn!") {
        super(type);
        this.fn = fn;
        this.spec = spec;
    }
    getArgs(stream, context) {
        return this.spec.map((arg) => {
            const value = stream.next();
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
    print() {
        console.log(
            `native-fn! [ \n    spec: [${
                this.spec.join(", ")
            }] \n    host-fn: ${this.fn.toString()} \n ]`,
        );
        return this;
    }
    mold() {
        return "native";
    }
}

export class Method extends NativeFn {
    constructor(spec, selector, type = "method!") {
        super(spec, ([target, ...args]) => {
            const method = target[selector];
            if (!method) {
                throw new Error(
                    `No method "${selector}" found on ${target.type}`,
                );
            }
            return (target[selector])(...args);
        }, type);
        this.selector = selector;
    }
    static unary(selector) {
        return new Method(["a"], selector);
    }
    static binary(selector) {
        return new Method(["a", "b"], selector);
    }
    static ternary(selector) {
        return new Method(["a", "b", "c"], selector);
    }
    static make(stream, context) {
        throw new Error(
            "Cannot use make with method! It's a primitive data type!",
        );
    }
    print() {
        console.log(
            `method! [ \n    spec: [${
                this.spec.join(", ")
            }] \n    selector: ${this.selector} \n ]`,
        );
        return this;
    }
}

export class Fn extends Context {
    constructor(args, body, type = "fn!") {
        super(null, type);
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
        return this.get("body").evaluate(stream, this);
    }
    print() {
        console.log(
            `fn! [ \n    args: [${this.get("args").mold()}] \n    body: [${
                this.get("body").mold()
            }] \n bindings: ${this.bindings} ]`,
        );
        return this;
    }
}

export default {
    "native-fn!": new Datatype(NativeFn),
    "fn!": new Datatype(Fn),
    "method!": new Datatype(Method),
};

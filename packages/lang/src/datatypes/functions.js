import { Context } from "./context.js";
import { Datatype, Value } from "./core.js";

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
    constructor(spec, method, type = "method!") {
        super(spec, ([target, ...args]) => {
            return (target[method])(...args);
        }, type);
        this.method = method;
    }
    static make(stream, context) {
        throw new Error(
            "Cannot use make with method! It's a primitive data type!",
        );
    }
    static binary(method) {
        return new Method(["a", "b"], method);
    }
    static unary(method) {
        return new Method(["a"], method);
    }
    static ternary(method) {
        return new Method(["a", "b", "c"], method);
    }
    print() {
        console.log(
            `method! [ \n    spec: [${
                this.spec.join(", ")
            }] \n    name: ${this.method} \n ]`,
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

import { Context } from "./context.js";
import { Datatype, Value } from "./core.js";

export class NativeFn extends Value {
    constructor(spec, fn) {
        super("native-fn!");
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

export class Action extends NativeFn {
    constructor(spec, method) {
        super(spec, ([target, ...args]) => {
            return (target[method])(...args);
        });
        this.method = method;
        this.type = "action!";
    }
    static make(stream, context) {
        throw new Error(
            "Cannot make action! It's a primitive data type! Use fn! instead",
        );
    }
    static binary(method) {
        return new Action(["a", "b"], method);
    }
    static unary(method) {
        return new Action(["a"], method);
    }
    static ternary(method) {
        return new Action(["a", "b", "c"], method);
    }
    print() {
        console.log(
            `action! [ \n    spec: [${
                this.spec.join(", ")
            }] \n    method: ${this.method} \n ]`,
        );
        return this;
    }
}

export class Fn extends Context {
    constructor(args, body) {
        super();
        this.type = "fn!";
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
    mold() {
        return `fn [${this.get("args").mold()}] [${this.get("body").mold()}]`;
    }
}

export default {
    "native-fn!": new Datatype(NativeFn),
    "fn!": new Datatype(Fn),
    "action!": new Datatype(Action),
};

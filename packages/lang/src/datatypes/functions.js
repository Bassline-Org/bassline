import { Context } from "./context.js";
import { Value } from "./core.js";

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
        const result = this.fn(args, context);
        return result;
    }
    mold() {
        return "native";
    }
}

/// User defined function
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

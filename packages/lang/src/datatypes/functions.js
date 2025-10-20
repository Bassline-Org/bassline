import { ContextBase, ContextChain } from "./context.js";
import { Datatype, GetWord, LitWord, Str, Value, Word } from "./core.js";
import { normalizeString } from "../utils.js";
import { evaluate } from "../evaluator.js";

export function isCallable(value) {
    return value instanceof NativeFn ||
        value instanceof NativeMethod ||
        value instanceof PureFn;
}

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
        const argValues = [];
        for (let i = 0; i < this.spec.length; i++) {
            const arg = stream.next();
            const specArg = this.spec[i];
            // Lit word semantics - Get the next token literally
            if (specArg.startsWith("'")) {
                argValues[i] = arg;
                continue;
            }
            // Get word semantics - Evaluate, but if it's a function don't invoke
            if (specArg.startsWith(":")) {
                if (isCallable(arg)) {
                    argValues[i] = arg;
                    continue;
                }
                if (arg instanceof Word) {
                    const asGet = new GetWord(arg.spelling);
                    argValues[i] = asGet.evaluate(stream, context);
                    continue;
                }
            }
            // Normal semantics, just evaluate the argument
            argValues[i] = arg.evaluate(stream, context);
        }
        return argValues;
    }
    evaluate(stream, context) {
        const args = this.getArgs(stream, context);
        const result = this.fn(args, stream, context);
        return result;
    }
    form() {
        return new Str(`native-fn! spec: [ ${this.spec.join(", ")} ]`);
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
            return target[selector].call(target, ...args, stream, context);
        });
        this.selector = selector;
    }
    static unary(selector, names = ["a"]) {
        return new NativeMethod(names, selector);
    }
    static binary(selector, names = ["a", "b"]) {
        return new NativeMethod(names, selector);
    }
    static ternary(selector, names = ["a", "b", "c"]) {
        return new NativeMethod(names, selector);
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

export class PureFn extends ContextBase {
    static type = normalizeString("pure-fn!");
    constructor(args, body) {
        super();
        this.set("args", args);
        this.set("body", body);
    }
    getArgs(stream, context) {
        const argValues = [];
        const spec = this.get("args").items;
        for (let i = 0; i < spec.length; i++) {
            const arg = stream.next();
            const specArg = spec[i];
            // Lit word semantics
            if (specArg instanceof LitWord) {
                argValues[i] = arg;
                continue;
            }
            // Get word semantics - Evaluate, but if it's a function don't invoke
            if (specArg instanceof GetWord) {
                if (isCallable(arg)) {
                    argValues[i] = arg;
                    continue;
                }
                if (arg instanceof Word) {
                    const asGet = new GetWord(arg.spelling);
                    argValues[i] = asGet.evaluate(stream, context);
                    continue;
                }
            }
            // Normal semantics, just evaluate the argument
            argValues[i] = arg.evaluate(stream, context);
        }
        return argValues;
    }
    evaluate(stream, context) {
        const localCtx = new ContextChain(context);
        const args = this.get("args");
        const body = this.get("body");
        for (const arg of args.items) {
            if (arg instanceof GetWord) {
                localCtx.set(arg, stream.next());
            } else {
                localCtx.set(arg, stream.next().evaluate(stream, context));
            }
        }
        return evaluate(body, localCtx);
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

export default {
    "native-fn!": new Datatype(NativeFn),
    "native-method!": new Datatype(NativeMethod),
    "pure-fn!": new Datatype(PureFn),
};

import { Context } from "./datatypes/context.js";
import { Fn, NativeFn } from "./datatypes/functions.js";
import { isa, isSelfEvaluating } from "./utils.js";
import {
    Block,
    GetWord,
    LitWord,
    Paren,
    SetWord,
    Word,
} from "./datatypes/core.js";

// Main evaluator for prelude (top-level bassline code)
export async function ex(context, code) {
    if (!isa(code, Block) && !isa(code, Paren)) {
        const block = new Block([code]);
        return await ex(context, block);
    }

    let result;
    const stream = code.stream();

    while (!stream.done()) {
        result = await evalNext(stream, context);
    }

    return result;
}

// Evaluate next value from stream
export async function evalNext(stream, context) {
    const val = stream.next();

    // Paren forces evaluation
    if (isa(val, Paren)) {
        return await ex(context, val);
    }

    if (isa(val, GetWord)) {
        const resolved = context.get(val.spelling);
        return resolved;
    }
    if (isa(val, LitWord)) {
        return new Word(val.spelling);
    }

    if (isa(val, SetWord)) {
        const value = await evalNext(stream, context);
        context.set(val.spelling, value);
        return value;
    }

    if (isa(val, Fn)) {
        return await evalFn(val, stream, context);
    }

    if (isa(val, NativeFn)) {
        return await val.fn(stream, context);
    }

    if (isa(val, Word)) {
        const resolved = context.get(val.spelling);
        if (isa(resolved, NativeFn)) {
            return await resolved.fn(stream, context);
        }
        if (isa(resolved, Fn)) {
            return await evalFn(resolved, stream, context);
        }
        return resolved;
    }

    return val;
}

export async function evalFn(fn, stream, context) {
    const callContext = new Context(context);
    const args = fn.get("args");
    const body = fn.get("body");
    for (const arg of args.items) {
        if (arg instanceof GetWord) {
            const value = stream.next();
            callContext.set(arg.spelling, value);
        } else {
            const value = await evalNext(stream, context);
            callContext.set(arg.spelling, value);
        }
    }
    return await ex(callContext, body);
}

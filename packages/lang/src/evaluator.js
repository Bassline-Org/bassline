import { Context } from "./context.js";
import { NativeFn } from "./natives.js";
import { isa, isSelfEvaluating } from "./utils.js";
import { Block, GetWord, LitWord, Paren, SetWord, Word } from "./values.js";

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

    if (isa(val, Word)) {
        const resolved = context.get(val.spelling);
        if (isa(resolved, NativeFn)) {
            return await resolved.fn(stream, context);
        }
        return resolved;
    }

    return val;
}

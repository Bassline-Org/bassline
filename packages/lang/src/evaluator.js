import { Context } from "./context.js";
import { isa, isSelfEvaluating } from "./utils.js";
import { Block, LitWord, Paren, SetWord, Word } from "./values.js";

// Main evaluator for prelude (top-level bassline code)
export async function ex(context, code) {
    if (!isa(code, Block) && !isa(code, Paren)) {
        const block = new Block([code]);
        return await ex(context, block);
    }

    let result;
    const stream = code.stream();

    while (!stream.done()) {
        const current = stream.next();

        // Self-evaluating values (numbers, strings, blocks)
        if (isSelfEvaluating(current)) {
            result = current;
            continue;
        }

        if (isa(current, LitWord)) {
            result = new Word(current.spelling);
            continue;
        }

        // Assignment: var: value
        if (isa(current, SetWord)) {
            result = await evalNext(stream, context);
            context.set(current.spelling, result);
            continue;
        }

        // Word lookup/call
        if (isa(current, Word)) {
            const value = context.get(current.spelling);

            // If callable (native or dialect), invoke it
            if (value?.call) {
                result = await value.call(stream, context);
            } // If it's a function, call it
            else if (value?._function) {
                result = await callFunction(value, stream, context);
            } else {
                result = value;
            }
            continue;
        }
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

    if (isa(val, Word)) {
        const resolved = context.get(val.spelling);
        // If it's callable, call it
        if (resolved?.call) {
            return await resolved.call(stream, context);
        }
        // If it's a function, call it
        if (resolved?._function) {
            return await callFunction(resolved, stream, context);
        }
        return resolved;
    }
    return val; // Self-evaluating
}

// Call a function (context) with arguments
export async function callFunction(funcContext, stream, evalContext) {
    // Create new context extending the function
    const callContext = new Context(funcContext);

    // Bind arguments
    for (let i = 0; i < funcContext._argNames.length; i++) {
        const argName = funcContext._argNames[i];
        const shouldEval = funcContext._argEval[i];

        if (shouldEval) {
            // Evaluate argument in calling context
            const argValue = await evalNext(stream, evalContext);
            callContext.set(argName, argValue);
        } else {
            // Pass literally - just consume from stream
            const argValue = stream.next();
            callContext.set(argName, argValue);
        }
    }

    // Execute body in call context
    const body = funcContext.get(Symbol.for("BODY"));
    return await ex(callContext, body);
}

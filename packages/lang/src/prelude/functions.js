import { native, NativeFn } from "../natives.js";
import { Context } from "../context.js";
import { evalNext, ex } from "../evaluator.js";
import { GetWord } from "../values.js";

export function installFunctions(context) {
    // func <args-block> <body-block>
    // Create a function context
    context.set(
        "call",
        native(async (stream, context) => {
            const func = await evalNext(stream, context);
            if (func instanceof NativeFn) {
                console.log("native func");
                return await func.fn(stream, context);
            }
            if (func instanceof Context) {
                const args = func.get("args");
                const body = func.get("body");
                const callContext = new Context(context);
                for (const arg of args.items) {
                    if (arg instanceof GetWord) {
                        const value = await evalNext(stream, context);
                        callContext.set(arg.spelling, value);
                    } else {
                        const value = await evalNext(stream, context);
                        callContext.set(arg.spelling, value);
                    }
                }
                return await ex(callContext, body);
            }
        }),
    );
}

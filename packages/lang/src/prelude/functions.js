import { Fn, native } from "../datatypes/functions.js";
import { evalNext } from "../evaluator.js";

export function installFunctions(context) {
    // fn <args-block> <body-block>
    context.set(
        "fn",
        native(async (stream, context) => {
            const args = await evalNext(stream, context);
            const body = await evalNext(stream, context);
            return new Fn(context, args, body);
        }),
    );
    context.set(
        "fn?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return value instanceof Fn;
        }),
    );
}

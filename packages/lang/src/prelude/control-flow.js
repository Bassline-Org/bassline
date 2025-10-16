import { native } from "../datatypes/functions.js";
import { isa } from "../utils.js";
import { Block, Word } from "../datatypes/core.js";
import { evalNext, ex } from "../evaluator.js";

export function installControlFlow(context) {
    // while <condition> <body>
    // Loop while condition is true
    context.set(
        "while",
        native(async (stream, context) => {
            const conditionBlock = await evalNext(stream, context);
            const body = await evalNext(stream, context);

            if (!isa(conditionBlock, Block)) {
                throw new Error("while expects a block as condition");
            }
            if (!isa(body, Block)) {
                throw new Error("while expects a block as body");
            }

            let result;
            while (true) {
                const conditionResult = await ex(context, conditionBlock);
                // Treat falsy values as false
                if (!conditionResult) break;
                result = await ex(context, body);
            }

            return result;
        }),
    );

    // if <condition> <body> <else>
    // Execute body if condition is true
    context.set(
        "if",
        native(async (stream, context) => {
            const condition = await evalNext(stream, context);
            const ifTrue = stream.next();
            const ifFalse = stream.next();

            if (!isa(ifTrue, Block) || !isa(ifFalse, Block)) {
                throw new Error("if expects a block as body");
            }

            // Execute body if condition is truthy
            if (condition) {
                return await ex(context, ifTrue);
            } else {
                return await ex(context, ifFalse);
            }
        }),
    );
}

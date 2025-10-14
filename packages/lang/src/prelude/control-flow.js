import { native, evalValue } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Word } from "../values.js";
import { ex, evalNext } from "../evaluator.js";

export function installControlFlow(context) {
    // foreach <word> <series> <body>
    // Iterate over a block, binding each item to word
    context.set(
        "foreach",
        native(async (stream, context) => {
            const itemWord = stream.next();
            if (!isa(itemWord, Word)) {
                throw new Error("foreach expects a word as first argument");
            }

            const series = await evalNext(stream, context);
            const body = stream.next();

            if (!isa(body, Block)) {
                throw new Error("foreach expects a block as body");
            }

            let items;
            if (isa(series, Block)) {
                items = series.items;
            } else if (Array.isArray(series)) {
                items = series;
            } else {
                throw new Error("foreach expects a block or array to iterate");
            }

            let result;
            for (const item of items) {
                // Bind item to the word in context
                context.set(itemWord.spelling, item);
                // Execute body
                result = ex(context, body);
            }

            return result; // Return last result
        }),
    );

    // repeat <n> <body>
    // Repeat body n times
    context.set(
        "repeat",
        native(async (stream, context) => {
            const n = evalValue(stream.next(), context);
            const body = stream.next();

            if (!isa(body, Block)) {
                throw new Error("repeat expects a block as body");
            }

            let result;
            for (let i = 0; i < n; i++) {
                result = ex(context, body);
            }

            return result; // Return last result
        }),
    );

    // while <condition> <body>
    // Loop while condition is true
    context.set(
        "while",
        native(async (stream, context) => {
            const conditionBlock = stream.next();
            const body = stream.next();

            if (!isa(conditionBlock, Block)) {
                throw new Error("while expects a block as condition");
            }
            if (!isa(body, Block)) {
                throw new Error("while expects a block as body");
            }

            let result;
            while (true) {
                const conditionResult = ex(context, conditionBlock);
                // Treat falsy values as false
                if (!conditionResult) break;
                result = ex(context, body);
            }

            return result;
        }),
    );

    // if <condition> <body>
    // Execute body if condition is true
    context.set(
        "if",
        native(async (stream, context) => {
            const condition = await evalNext(stream, context);
            const body = stream.next();

            if (!isa(body, Block)) {
                throw new Error("if expects a block as body");
            }

            // Execute body if condition is truthy
            if (condition) {
                return ex(context, body);
            }

            return null;
        }),
    );

    // either <condition> <true-body> <false-body>
    // Execute true-body if condition is true, else false-body
    context.set(
        "either",
        native(async (stream, context) => {
            const condition = await evalNext(stream, context);
            const trueBody = stream.next();
            const falseBody = stream.next();

            if (!isa(trueBody, Block)) {
                throw new Error("either expects a block as true body");
            }
            if (!isa(falseBody, Block)) {
                throw new Error("either expects a block as false body");
            }

            if (condition) {
                return ex(context, trueBody);
            } else {
                return ex(context, falseBody);
            }
        }),
    );
}

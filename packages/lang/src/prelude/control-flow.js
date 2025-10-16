import { evalValue, native } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Word } from "../values.js";
import { evalNext, ex } from "../evaluator.js";

export function installControlFlow(context) {
    // foreach <word> <series> <body>
    // Iterate over a block, binding each item to word
    // Returns an array of all results
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

            const results = [];
            for (const item of items) {
                // Bind item to the word in context
                context.set(itemWord.spelling, item);
                // Execute body
                const result = await ex(context, body);
                results.push(result);
            }

            return results; // Return array of all results
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

import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block } from "../values.js";
import { evalNext } from "../evaluator.js";

export function installStrings(context) {
    // to-string <value>
    // Convert value to string representation
    context.set(
        "to-string",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return value?.mold?.() ?? String(value);
        }),
    );

    // split <str> <delimiter>
    // Split string by delimiter
    context.set(
        "split",
        native(async (stream, context) => {
            const str = await evalNext(stream, context);
            const delimiter = await evalNext(stream, context);

            const parts = str.split(delimiter);
            return new Block(parts);
        }),
    );

    // join <list> <delimiter>
    // Join list items with delimiter
    context.set(
        "join",
        native(async (stream, context) => {
            const list = await evalNext(stream, context);
            const delimiter = await evalNext(stream, context);
            const items = list.items.map((item) =>
                item?.mold?.() ?? String(item)
            );

            return items.join(delimiter);
        }),
    );

    // trim <str>
    // Remove leading/trailing whitespace
    context.set(
        "trim",
        native(async (stream, context) => {
            const str = await evalNext(stream, context);
            return str.trim();
        }),
    );

    // uppercase <str>
    // Convert to uppercase
    context.set(
        "uppercase",
        native(async (stream, context) => {
            const str = await evalNext(stream, context);
            return str.toUpperCase();
        }),
    );

    // lowercase <str>
    // Convert to lowercase
    context.set(
        "lowercase",
        native(async (stream, context) => {
            const str = await evalNext(stream, context);
            return str.toLowerCase();
        }),
    );
}

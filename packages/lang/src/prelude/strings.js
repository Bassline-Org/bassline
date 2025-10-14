import { native, evalValue } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Num, Str } from "../values.js";
import { evalNext } from "../evaluator.js";

export function installStrings(context) {
    // to-string <value>
    // Convert value to string representation
    context.set(
        "to-string",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);

            if (isa(value, Num)) {
                return new Str(String(value.value));
            }
            if (isa(value, Str)) {
                return value;
            }
            if (typeof value === "number") {
                return new Str(String(value));
            }
            if (typeof value === "string") {
                return new Str(value);
            }
            if (typeof value === "boolean") {
                return new Str(String(value));
            }
            return new Str(String(value));
        }),
    );

    // split <str> <delimiter>
    // Split string by delimiter
    context.set(
        "split",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const delimiter = evalValue(stream.next(), context);

            const strVal = isa(str, Str) ? str.value : String(str);
            const delim = isa(delimiter, Str)
                ? delimiter.value
                : String(delimiter);

            const parts = strVal.split(delim);
            return new Block(parts.map((p) => new Str(p)));
        }),
    );

    // join <list> <delimiter>
    // Join list items with delimiter
    context.set(
        "join",
        native(async (stream, context) => {
            const list = await evalNext(stream, context);
            const delimiter = evalValue(stream.next(), context);

            const delim = isa(delimiter, Str)
                ? delimiter.value
                : String(delimiter);

            let items;
            if (isa(list, Block)) {
                items = list.items;
            } else if (Array.isArray(list)) {
                items = list;
            } else {
                throw new Error("join expects a block or array");
            }

            const strings = items.map((item) => {
                if (isa(item, Str)) return item.value;
                if (isa(item, Num)) return String(item.value);
                return String(item);
            });

            return new Str(strings.join(delim));
        }),
    );

    // trim <str>
    // Remove leading/trailing whitespace
    context.set(
        "trim",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const strVal = isa(str, Str) ? str.value : String(str);
            return new Str(strVal.trim());
        }),
    );

    // uppercase <str>
    // Convert to uppercase
    context.set(
        "uppercase",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const strVal = isa(str, Str) ? str.value : String(str);
            return new Str(strVal.toUpperCase());
        }),
    );

    // lowercase <str>
    // Convert to lowercase
    context.set(
        "lowercase",
        native(async (stream, context) => {
            const str = evalValue(stream.next(), context);
            const strVal = isa(str, Str) ? str.value : String(str);
            return new Str(strVal.toLowerCase());
        }),
    );
}

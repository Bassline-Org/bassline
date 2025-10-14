import { native, evalValue } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Num, Str } from "../values.js";
import { evalNext } from "../evaluator.js";

export function installSeries(context) {
    // first <series>
    // Get first element of a block
    context.set(
        "first",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            if (isa(series, Block)) {
                return series.items[0];
            }
            if (Array.isArray(series)) {
                return series[0];
            }
            throw new Error("first expects a block or array");
        }),
    );

    // last <series>
    // Get last element of a block
    context.set(
        "last",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            if (isa(series, Block)) {
                return series.items[series.items.length - 1];
            }
            if (Array.isArray(series)) {
                return series[series.length - 1];
            }
            throw new Error("last expects a block or array");
        }),
    );

    // length <series>
    // Get length of a block or string
    context.set(
        "length",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            if (isa(series, Block)) {
                return new Num(series.items.length);
            }
            if (isa(series, Str)) {
                return new Num(series.value.length);
            }
            if (Array.isArray(series)) {
                return new Num(series.length);
            }
            if (typeof series === "string") {
                return new Num(series.length);
            }
            throw new Error("length expects a block, string, or array");
        }),
    );

    // append <series> <value>
    // Append value to a block (creates new block)
    context.set(
        "append",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const value = await evalNext(stream, context);

            if (isa(series, Block)) {
                return new Block([...series.items, value]);
            }
            if (Array.isArray(series)) {
                return [...series, value];
            }
            throw new Error("append expects a block or array");
        }),
    );

    // insert <series> <value>
    // Insert value at beginning of block (creates new block)
    context.set(
        "insert",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const value = await evalNext(stream, context);

            if (isa(series, Block)) {
                return new Block([value, ...series.items]);
            }
            if (Array.isArray(series)) {
                return [value, ...series];
            }
            throw new Error("insert expects a block or array");
        }),
    );

    // at <series> <index>
    // Get slice of block starting at index (1-based)
    context.set(
        "at",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const index = evalValue(stream.next(), context);

            if (isa(series, Block)) {
                return new Block(series.items.slice(index - 1));
            }
            if (Array.isArray(series)) {
                return series.slice(index - 1);
            }
            throw new Error("at expects a block or array");
        }),
    );

    // pick <series> <index>
    // Get element at index (1-based)
    context.set(
        "pick",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const index = evalValue(stream.next(), context);

            if (isa(series, Block)) {
                return series.items[index - 1];
            }
            if (Array.isArray(series)) {
                return series[index - 1];
            }
            throw new Error("pick expects a block or array");
        }),
    );

    // empty? <series>
    // Check if series is empty
    context.set(
        "empty?",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            if (isa(series, Block)) {
                return series.items.length === 0;
            }
            if (isa(series, Str)) {
                return series.value.length === 0;
            }
            if (Array.isArray(series)) {
                return series.length === 0;
            }
            if (typeof series === "string") {
                return series.length === 0;
            }
            return false;
        }),
    );
}

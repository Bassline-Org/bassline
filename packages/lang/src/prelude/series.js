import { evalValue, native } from "../natives.js";
import { isa } from "../utils.js";
import { Block, Num, Str } from "../values.js";
import { evalNext, ex } from "../evaluator.js";

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

    // reduce <block>
    // Evaluate each element in a block and return a new block with results
    context.set(
        "reduce",
        native(async (stream, context) => {
            const blockValue = await evalNext(stream, context);

            if (!isa(blockValue, Block)) {
                console.log(blockValue);
                throw new Error("reduce expects a block");
            }

            const results = [];
            for (const item of blockValue.items) {
                // Evaluate each item in the context
                const result = await ex(context, item);
                results.push(result);
            }

            return new Block(results);
        }, {
            doc: "Evaluates each element in a block and returns a new block containing the results.",
            args: ["block"],
            examples: [
                "x: 5",
                "y: 10",
                "reduce [x y (+ x y)]  ; => [5 10 15]",
                'name: "Alice"',
                "age: 30",
                'reduce [name age]  ; => ["Alice" 30]',
            ],
        }),
    );
}

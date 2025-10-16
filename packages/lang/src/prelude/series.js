import { native } from "../natives.js";
import { isa } from "../utils.js";
import { Block } from "../values.js";
import { evalNext, ex } from "../evaluator.js";

export function installSeries(context) {
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
            throw new Error("append expects a block");
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
            throw new Error("insert expects a block");
        }),
    );

    // at <series> <index>
    // Get slice of block starting at index (1-based)
    context.set(
        "at",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const index = await evalNext(stream, context);

            if (isa(series, Block)) {
                return new Block(series.items.slice(index - 1));
            }
            throw new Error("at expects a block");
        }),
    );

    // pick <series> <index>
    // Get element at index (1-based)
    context.set(
        "pick",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);
            const index = await evalNext(stream, context);

            if (isa(series, Block)) {
                return series.items[index - 1];
            }
            throw new Error("pick expects a block");
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
            if (typeof series === "string") {
                return series.length === 0;
            }
            throw new Error("empty? expects a block or string");
        }),
    );

    // reduce <block>
    // Evaluate each element in a block and return a new block with results
    context.set(
        "reduce",
        native(async (stream, context) => {
            const series = await evalNext(stream, context);

            if (!isa(series, Block)) {
                throw new Error("reduce expects a block");
            }

            const results = [];
            for (const item of series.items) {
                // Evaluate each item in the context
                const result = await ex(context, item);
                results.push(result);
            }

            return new Block(results);
        }, {
            doc: "Evaluates each element in a block and returns a new block containing the results.",
            args: new Block(["series"]),
            examples: new Block([
                "reduce [1 2 3]  ; => [1 2 3]",
                "reduce [1 2 3] (+)  ; => 6",
                "reduce [1 2 3] (*)  ; => 6",
                "reduce [1 2 3] (/)  ; => 0.16666666666666666",
                "reduce [1 2 3] (%)  ; => 0",
            ]),
        }),
    );
}

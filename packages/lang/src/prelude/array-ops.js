import { native } from "../datatypes/functions.js";
import { Block } from "../datatypes/core.js";
import { evalNext, ex } from "../evaluator.js";
import { isa } from "../utils.js";

export function installArrayOps(context) {
    // generates a sequence of numbers from 0 to n-1
    context.set(
        "iota",
        native(async (stream, context) => {
            const n = await evalNext(stream, context);
            const arr = Array.from({ length: n }, (_, i) => i);
            return new Block(arr);
        }, {
            doc: "Generates a sequence of numbers from 0 to n-1.",
            args: new Block(["n"]),
            examples: new Block([
                "iota 5  ; => [0 1 2 3 4]",
                "iota 10  ; => [0 1 2 3 4 5 6 7 8 9]",
            ]),
        }),
    );

    context.set(
        "map",
        native(async (stream, context) => {
            const fn = await evalNext(stream, context);
            const arr = await evalNext(stream, context);
            if (!(arr instanceof Block)) {
                throw new Error("map expects a block as second argument");
            }
            const results = [];
            for (const item of arr.items) {
                const s = new Block([fn, item]).stream();
                const result = await evalNext(s, context);
                results.push(result);
            }
            return new Block(results);
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

            if (!(series instanceof Block)) {
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

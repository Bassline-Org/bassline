import { native } from "../natives.js";
import { Block } from "../values.js";
import { evalNext } from "../evaluator.js";

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
}

import { evalValue, native } from "../natives.js";
import { Block, Num } from "../values.js";

export function installArrayOps(context) {
    // generates a sequence of numbers from 0 to n-1
    context.set(
        "iota",
        native(async (stream, context) => {
            const n = await evalValue(stream.next(), context);
            const arr = Array.from({ length: n }, (_, i) => new Num(i));
            return new Block(arr);
        }, {
            doc: "Generates a sequence of numbers from 0 to n-1.",
            args: ["n"],
            examples: [
                "iota 5  ; => [0 1 2 3 4]",
                "iota 10  ; => [0 1 2 3 4 5 6 7 8 9]",
            ],
        }),
    );
}

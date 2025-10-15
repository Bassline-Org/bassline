import { native, evalValue } from "../natives.js";
import { Num } from "../values.js";

export function installArithmetic(context) {
    // + <a> <b>
    context.set(
        "+",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a + b);
        }, {
            doc: "Adds two numbers together and returns the sum.",
            args: ["a", "b"],
            examples: [
                "+ 5 3  ; => 8",
                "+ 10 -3  ; => 7",
                "+ 2.5 1.5  ; => 4"
            ]
        }),
    );

    // - <a> <b>
    context.set(
        "-",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a - b);
        }, {
            doc: "Subtracts the second number from the first and returns the difference.",
            args: ["a", "b"],
            examples: [
                "- 10 3  ; => 7",
                "- 5 10  ; => -5",
                "- 100 25  ; => 75"
            ]
        }),
    );

    // * <a> <b>
    context.set(
        "*",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a * b);
        }, {
            doc: "Multiplies two numbers together and returns the product.",
            args: ["a", "b"],
            examples: [
                "* 6 7  ; => 42",
                "* 5 -2  ; => -10",
                "* 2.5 4  ; => 10"
            ]
        }),
    );

    // / <a> <b>
    context.set(
        "/",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a / b);
        }, {
            doc: "Divides the first number by the second and returns the quotient.",
            args: ["a", "b"],
            examples: [
                "/ 15 3  ; => 5",
                "/ 10 4  ; => 2.5",
                "/ 100 10  ; => 10"
            ]
        }),
    );

    // % <a> <b>
    // Modulo (remainder)
    context.set(
        "%",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a % b);
        }, {
            doc: "Returns the remainder of dividing the first number by the second (modulo operation).",
            args: ["a", "b"],
            examples: [
                "% 17 5  ; => 2",
                "% 10 3  ; => 1",
                "% 20 4  ; => 0"
            ]
        }),
    );
}

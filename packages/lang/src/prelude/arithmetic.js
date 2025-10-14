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
        }),
    );

    // - <a> <b>
    context.set(
        "-",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a - b);
        }),
    );

    // * <a> <b>
    context.set(
        "*",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a * b);
        }),
    );

    // / <a> <b>
    context.set(
        "/",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return new Num(a / b);
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
        }),
    );
}

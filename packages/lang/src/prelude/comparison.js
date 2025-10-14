import { native, evalValue } from "../natives.js";

export function installComparison(context) {
    // = <a> <b>
    context.set(
        "=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a === b;
        }),
    );

    // < <a> <b>
    context.set(
        "<",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a < b;
        }),
    );

    // > <a> <b>
    context.set(
        ">",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a > b;
        }),
    );

    // <= <a> <b>
    context.set(
        "<=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a <= b;
        }),
    );

    // >= <a> <b>
    context.set(
        ">=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a >= b;
        }),
    );

    // not= <a> <b>
    context.set(
        "not=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a !== b;
        }),
    );
}

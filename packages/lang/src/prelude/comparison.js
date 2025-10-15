import { native, evalValue } from "../natives.js";

export function installComparison(context) {
    // = <a> <b>
    context.set(
        "=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a === b;
        }, {
            doc: "Returns true if both values are equal, false otherwise.",
            args: ["a", "b"],
            examples: [
                "= 5 5  ; => true",
                "= 10 3  ; => false",
                '= "hello" "hello"  ; => true'
            ]
        }),
    );

    // < <a> <b>
    context.set(
        "<",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a < b;
        }, {
            doc: "Returns true if the first value is less than the second.",
            args: ["a", "b"],
            examples: [
                "< 3 5  ; => true",
                "< 10 5  ; => false",
                "< 5 5  ; => false"
            ]
        }),
    );

    // > <a> <b>
    context.set(
        ">",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a > b;
        }, {
            doc: "Returns true if the first value is greater than the second.",
            args: ["a", "b"],
            examples: [
                "> 10 5  ; => true",
                "> 3 5  ; => false",
                "> 5 5  ; => false"
            ]
        }),
    );

    // <= <a> <b>
    context.set(
        "<=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a <= b;
        }, {
            doc: "Returns true if the first value is less than or equal to the second.",
            args: ["a", "b"],
            examples: [
                "<= 3 5  ; => true",
                "<= 5 5  ; => true",
                "<= 10 5  ; => false"
            ]
        }),
    );

    // >= <a> <b>
    context.set(
        ">=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a >= b;
        }, {
            doc: "Returns true if the first value is greater than or equal to the second.",
            args: ["a", "b"],
            examples: [
                ">= 10 5  ; => true",
                ">= 5 5  ; => true",
                ">= 3 5  ; => false"
            ]
        }),
    );

    // not= <a> <b>
    context.set(
        "not=",
        native(async (stream, context) => {
            const a = evalValue(stream.next(), context);
            const b = evalValue(stream.next(), context);
            return a !== b;
        }, {
            doc: "Returns true if the values are not equal, false otherwise.",
            args: ["a", "b"],
            examples: [
                "not= 5 3  ; => true",
                "not= 5 5  ; => false",
                'not= "hello" "world"  ; => true'
            ]
        }),
    );
}

import { native } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, Word } from "../values.js";
import { evalNext } from "../evaluator.js";
import { NativeFn } from "../natives.js";

export function installTypes(context) {
    context.set(
        "block?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return isa(value, Block);
        }),
    );
    context.set(
        "word?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return isa(value, Word);
        }),
    );
    context.set(
        "num?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return typeof value === "number";
        }),
    );
    context.set(
        "str?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return typeof value === "string";
        }),
    );

    context.set(
        "context?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return value instanceof Context;
        }),
    );

    context.set(
        "native?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return isa(value, NativeFn);
        }),
    );
}

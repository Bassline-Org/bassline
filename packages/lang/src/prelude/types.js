import { native } from "../natives.js";
import { Context } from "../context.js";
import { isa } from "../utils.js";
import { Block, Paren, Word, Num, Str } from "../values.js";
import { evalNext } from "../evaluator.js";

export function installTypes(context) {
    context.set(
        "block?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Block);
        }),
    );

    context.set(
        "paren?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Paren);
        }),
    );

    context.set(
        "word?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Word);
        }),
    );

    context.set(
        "num?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Num);
        }),
    );

    context.set(
        "str?",
        native(async (stream, _context) => {
            const value = stream.next();
            return isa(value, Str);
        }),
    );

    context.set(
        "context?",
        native(async (stream, context) => {
            const value = await evalNext(stream, context);
            return value instanceof Context;
        }),
    );
}

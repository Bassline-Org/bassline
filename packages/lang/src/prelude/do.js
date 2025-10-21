import { NativeFn } from "./datatypes/index.js";
import { evaluate } from "../evaluator.js";
import { parse } from "../parser.js";

export default {
    "do": new NativeFn(["aBlock"], ([aBlock], stream, context) => {
        return evaluate(aBlock, context);
    }),
    "in": new NativeFn(["context", "block"], ([ctx, block]) => {
        return evaluate(block, ctx);
    }),
    "load": new NativeFn(["aString"], ([aString], stream, context) => {
        return parse(aString.value);
    }),
};

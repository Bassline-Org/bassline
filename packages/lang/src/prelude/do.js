import { NativeFn } from "../datatypes/index.js";
import { evaluate } from "../evaluator.js";

export default {
    "do": new NativeFn(["a"], ([a], stream, context) => {
        return evaluate(a.items, context);
    }),
    "in": new NativeFn(["context", "block"], ([ctx, block]) => {
        return evaluate(block, ctx);
    }),
};

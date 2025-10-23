import { method } from "../method.js";
import * as t from "./datatypes/types.js";
import { doBlock, evaluate, reduceBlock } from "../evaluator.js";
import { fn, nativeMethod } from "./datatypes/methods.js";
const { TYPES } = t;

export { defMake, make };
const [defMake, make] = method((first) => first.value);

const makeMethod = nativeMethod(["dataType", "value"], make);

defMake(TYPES.contextChain, (_, block, context, iter) => {
    const ctx = t.contextChain(new Map());
    t.bind(ctx, t.word("self"), ctx);
    t.bind(ctx, t.word("parent"), context);
    const result = doBlock(block, ctx);
    return result;
});

defMake(TYPES.fn, (_, block, context, iter) => {
    const reduced = reduceBlock(block, context);
    const args = reduced.value[0];
    const body = reduced.value[1];
    if (args.type !== TYPES.block || body.type !== TYPES.block) {
        throw new Error("Invalid fn block");
    }
    return fn(args, body, context);
});

defMake(TYPES.getWord, (_, word, context, iter) => {
    const spelling = word.value;
    return t.getWord(spelling);
});
defMake(TYPES.litWord, (_, word, context, iter) => {
    const spelling = word.value;
    return t.getWord(spelling);
});
defMake(TYPES.setWord, (_, word, context, iter) => {
    const spelling = word.value;
    return t.setWord(spelling);
});
defMake(TYPES.word, (_, word, context, iter) => {
    const spelling = word.value;
    return t.word(spelling);
});

export default {
    "make": makeMethod,
};

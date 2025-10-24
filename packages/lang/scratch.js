import functions from "./src/prelude/datatypes/functions.js";
import { parse } from "./src/parser.js";
//import { doBlock, reduceBlock } from "./src/evaluator.js";
import * as core from "./src/prelude/datatypes/core.js";
import coreTypes from "./src/prelude/datatypes/core.js";
import {
    context,
    contextChain,
    setMany,
} from "./src/prelude/datatypes/context.js";
import { nativeFn } from "./src/prelude/datatypes/functions.js";
const { word } = core;

const ctx = contextChain();
setMany(ctx, {
    ...coreTypes,
    ...functions,
});
ctx.set(
    word("print"),
    nativeFn("value", (value, context, iter) => {
        console.log(value);
        return value;
    }),
);
ctx.set(
    word("reduce"),
    nativeFn("list", (list, context, iter) => {
        return list.reduce(context, iter);
    }),
);

const expr = parse(`
    print :make
    `);
const result = expr.doBlock(ctx);
console.log(result);
//doBlock(parse(""), ctx);
//console.log(ctx);

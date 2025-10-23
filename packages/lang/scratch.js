import * as t from "./src/prelude/datatypes/types.js";
import { fn, lookup, nativeFn } from "./src/prelude/datatypes/methods.js";
import { parse } from "./src/parser.js";
import { doBlock, reduceBlock } from "./src/evaluator.js";
import makeFns from "./src/prelude/make.js";
const { bind } = t;

const ctx = t.context(new Map());
bind(
    ctx,
    t.word("print"),
    nativeFn(["value"], (value, context, iter) => {
        console.log(value);
        return value;
    }),
);
bind(
    ctx,
    t.word("reduce"),
    nativeFn(["list"], (list, context, iter) => {
        return reduceBlock(list, context);
    }),
);
const exampleArgs = parse(":a :b :c");
const exampleBody = parse("print :a print :b print :c");
const exampleFn = fn(exampleArgs, exampleBody, ctx);
t.setMany(ctx, makeFns);
//bind(ctx, t.word("foo"), exampleFn);
//const binding = t.block([t.setWord("foo"), exampleFn]);

const expr = parse("foo: make fn! [[a b] [a b]]");
doBlock(expr, ctx);
doBlock(parse("foo :print 123"), ctx);
//console.log(ctx);

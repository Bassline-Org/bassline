import * as t from "./src/prelude/datatypes/types.js";
import datatypes from "./src/prelude/datatypes/types.js";
import { fn, lookup, nativeFn } from "./src/prelude/datatypes/methods.js";
import { parse } from "./src/parser.js";
import { doBlock, reduceBlock } from "./src/evaluator.js";
import makeFns from "./src/prelude/make.js";
import lookupFns from "./src/prelude/datatypes/methods.js";
const { bind } = t;

const ctx = t.context(new Map());
bind(ctx, t.word("self"), ctx);
t.setMany(ctx, {
    ...datatypes,
    ...lookupFns,
    ...makeFns,
});
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

const expr = parse(`
    fn: make fn! [[args body] [make fn! reduce [args body]]]
    someWord: 'bar
    ;print make get-word! 'bar
    ;print make set-word! 'bar
    ;print make lit-word! 'bar
    ;print make word! 'bar

    foo: fn [a] [ fn [b] [ print a print b ] ]
    bar: print (foo 1)
    ;print :foo
    ;bar 2
    69
    `);
doBlock(expr, ctx);
//doBlock(parse(""), ctx);
//console.log(ctx);

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
import contextTypes from "./src/prelude/datatypes/context.js";
import { nativeFn } from "./src/prelude/datatypes/functions.js";
const { word } = core;

const ctx = contextChain();
setMany(ctx, {
    ...coreTypes,
    ...functions,
    ...contextTypes,
});
setMany(ctx, {
    "print": nativeFn("value", (value) => {
        console.log(value);
        return value;
    }),
    "in": nativeFn("context block", (ctx, block) => {
        return block.doBlock(ctx);
    }),
    "fold": nativeFn("series fn initial", (series, fn, initial, context) => {
        return series.fold(fn, initial, context);
    }),
    "append": nativeFn("series value", (series, value, context) => {
        return series.append(value, context);
    }),
    "add": nativeFn("a b", (a, b) => {
        return a.add(b);
    }),
    "form": nativeFn("value", (value) => {
        return value.form();
    }),
    "mold": nativeFn("value", (value) => {
        return value.mold();
    }),
    "type?": nativeFn("value", (value) => {
        return value.getType();
    }),
    "eq?": nativeFn("a b", (a, b) => {
        return a.equals(b);
    }),
});

const expr = parse(`
    fn: make fn! [[args body] [ make fn! reduce [args body] ]]
    does: fn [block] [ fn [ ] block ]
    constant: fn [x] [ fn [ ] reduce [x] ]
    hof: fn [f] [ fn [x] [ f x ] ]
    greeting: constant "Hello, world!"
    greet: does [ print greeting ]
    greet
    ;greeting: "Goodbye, world!"
    ;greet
    print :greeting

    ctx: make context-chain! self
    in ctx [ foo: 123 print foo ]
    map: fn [series f] [ fold series fn [acc x] [ append acc f x ] [] ]

    ;fold [1 2 3 4 5] fn [acc x] [ print x ] 0
    mapped: map [1 2 3 4 5] fn [x] [ add x x ]
    print form mapped
    print mold mapped
    print mold :map
    print type? mapped
    print type? :map
    print eq? "Hello, world!" greeting
    `);
expr.doBlock(ctx);
//console.log(result);
//doBlock(parse(""), ctx);
//console.log(ctx);

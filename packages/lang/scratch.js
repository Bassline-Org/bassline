import functions from "./src/prelude/datatypes/functions.js";
import { parse } from "./src/parser.js";
import * as core from "./src/prelude/datatypes/core.js";
import async from "./src/prelude/datatypes/async.js";
import coreTypes from "./src/prelude/datatypes/core.js";
import { context, setMany } from "./src/prelude/datatypes/context.js";
import contextTypes from "./src/prelude/datatypes/context.js";
import { nativeFn } from "./src/prelude/datatypes/functions.js";
const { word } = core;

const ctx = context();
setMany(ctx, {
    ...coreTypes,
    ...functions,
    ...contextTypes,
    ...async,
});
setMany(ctx, {
    "print": nativeFn("value", (value) => {
        console.log(value.form().value);
        return value;
    }),
    "system": ctx,
    "project": nativeFn("context keys", (ctx, keys) => {
        return ctx.project(keys);
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
    hof: fn [f] [ fn [x] compose [ (:f) x ] ]
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
    print mapped
    print eq? "Hello, world!" greeting
    createAdder: fn [x] [ fn [y] compose [ add (x) y ] ]
    add10: createAdder 10
    print add10 5

    task: make task! []
    after after task [ print "done" ] self [print "again done" ] self

    map "Hello" fn [x] [ print x ]
    `);
expr.doBlock(ctx);

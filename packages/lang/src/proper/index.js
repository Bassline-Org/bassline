import { bind, lookup } from "./bind.js";
import { make, series, wordConvert } from "./cells.js";
import { Context } from "./context.js";
import { evaluate } from "./evaluate.js";
import "./spelling.js";

export * from "./bind.js";
export * from "./cells.js";
export * from "./context.js";
export * from "./spelling.js";

// Create a block
const ctx = new Context();
const otherCtx = new Context();
let blk = make.block([make.num(1), make.num(2), make.num(3)]);

// Navigate (returns new cell, same buffer)
let blk2 = series.next(blk);
console.log(series.first(blk)); // num(1)
console.log(series.first(blk2)); // num(2)

// They share the same buffer!
console.log(blk.buffer === blk2.buffer); // true

// Insert mutates the buffer
series.insert(blk2, make.num(99));
console.log(series.first(blk)); // num(1)
console.log(series.first(blk2)); // num(99) - inserted here
console.log(series.pick(blk, 2)); // num(99) - blk sees it too!

// Example nested structure
const unboundNested = make.block([
    make.word("x"), // bind() hits case 1 → rebound
    make.num(10), // bind() hits case 3 → unchanged
    make.block([ // bind() hits case 2 → recurse
        make.word("y"), // bind() hits case 1 → rebound
        make.path([ // bind() hits case 2 → recurse again
            make.word("obj"), // bind() hits case 1 → rebound
            make.word("field"), // bind() hits case 1 → rebound
        ]),
    ]),
]);

const boundNested = bind(unboundNested, ctx);
const boundEntry = series.first(boundNested);
console.log(evaluate(boundEntry));
//console.log(boundNested.buffer.data[0]);
ctx.set("x", 123);
console.log(evaluate(boundEntry));
console.log(evaluate(wordConvert.toLitWord(boundEntry)));
//console.log(boundNested.buffer.data[0]);

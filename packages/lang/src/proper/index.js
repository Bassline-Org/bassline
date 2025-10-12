import { bind, lookup } from "./bind.js";
import { make, series } from "./cells.js";
import { Context } from "./context.js";
import "./spelling.js";

export * from "./bind.js";
export * from "./cells.js";
export * from "./context.js";
export * from "./spelling.js";

// Create a block
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

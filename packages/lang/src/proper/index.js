import { bind, lookup } from "./bind.js";
import { make } from "./cells.js";
import { Context } from "./context.js";
import "./spelling.js";

const word = make.word("x");
const ctx = new Context();
ctx.set("X", make.num(42));

const bound = bind(word, ctx);
console.log(bound);
const value = lookup(bound);

console.log(value); // ReCell { type: INTEGER, value: 42 }
console.log(value.value); // 42

export * from "./bind.js";
export * from "./cells.js";
export * from "./context.js";
export * from "./spelling.js";

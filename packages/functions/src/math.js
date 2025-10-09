import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/math";

export const inc = Object.create(transform);
Object.assign(inc, {
    pkg,
    name: "inc",
    fn: (x) => x + 1,
});

export const dec = Object.create(transform);
Object.assign(dec, {
    pkg,
    name: "dec",
    fn: (x) => x - 1,
});

export const neg = Object.create(transform);
Object.assign(neg, {
    pkg,
    name: "neg",
    fn: (x) => -x,
});

export const abs = Object.create(transform);
Object.assign(abs, {
    pkg,
    name: "abs",
    fn: (x) => Math.abs(x),
});

export const add = Object.create(partial);
Object.assign(add, {
    pkg,
    name: "add",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a + b,
});

export const sub = Object.create(partial);
Object.assign(sub, {
    pkg,
    name: "sub",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a - b,
});

export const mul = Object.create(partial);
Object.assign(mul, {
    pkg,
    name: "mul",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a * b,
});

export const div = Object.create(partial);
Object.assign(div, {
    pkg,
    name: "div",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a / b,
});

export const sum = Object.create(partial);
Object.assign(sum, {
    pkg,
    name: "sum",
    fn: (args) => Object.values(args).reduce((a, b) => a + b, 0),
});

export const average = Object.create(partial);
Object.assign(average, {
    pkg,
    name: "average",
    fn: (args) =>
        Object.values(args).reduce((a, b) => a + b, 0) /
        Object.values(args).length,
});

export const product = Object.create(partial);
Object.assign(product, {
    pkg,
    name: "product",
    fn: (args) => Object.values(args).reduce((a, b) => a * b, 1),
});

export default {
    gadgets: {
        inc,
        dec,
        neg,
        abs,
        add,
        sub,
        mul,
        div,
        sum,
        average,
        product,
    },
};

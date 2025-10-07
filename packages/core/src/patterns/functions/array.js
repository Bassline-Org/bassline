import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/array";

export const asArray = Object.create(transform);
Object.assign(asArray, {
    pkg,
    name: "asArray",
    fn: (arr) => Array.isArray(arr) ? arr : [arr],
});

export const length = Object.create(transform);
Object.assign(length, {
    pkg,
    name: "length",
    fn: (arr) => arr.length,
});

export const first = Object.create(transform);
Object.assign(first, {
    pkg,
    name: "first",
    fn: (arr) => arr[0],
});

export const last = Object.create(transform);
Object.assign(last, {
    pkg,
    name: "last",
    fn: (arr) => arr[arr.length - 1],
});

export const rest = Object.create(transform);
Object.assign(rest, {
    pkg,
    name: "rest",
    fn: (arr) => arr.slice(1),
});

export const butlast = Object.create(transform);
Object.assign(butlast, {
    pkg,
    name: "butlast",
    fn: (arr) => arr.slice(0, -1),
});

export const iota = Object.create(transform);
Object.assign(iota, {
    pkg,
    name: "iota",
    fn: (n) => Array.from({ length: n }, (_, i) => i),
});

export const nth = Object.create(partial);
Object.assign(nth, {
    pkg,
    name: "nth",
    requiredKeys: ["arr", "n"],
    fn: ({ arr, n }) => arr[n],
});

export const concat = Object.create(partial);
Object.assign(concat, {
    pkg,
    name: "concat",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a.concat(b),
});

export default {
    gadgets: {
        asArray,
        length,
        first,
        last,
        rest,
        butlast,
        iota,
        nth,
        concat,
    },
};

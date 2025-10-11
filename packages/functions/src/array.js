import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/array";

export const asArray = Object.create(transform);
Object.assign(asArray, {
    pkg,
    name: "asArray",
    fn: (arr) => Array.isArray(arr) ? arr : [arr],
    inputs: "any",
    outputs: {
        computed: { type: "array", description: "Input as array" },
    },
});

export const length = Object.create(transform);
Object.assign(length, {
    pkg,
    name: "length",
    fn: (arr) => arr.length,
    inputs: "array",
    outputs: {
        computed: { type: "number", description: "Array length" },
    },
});

export const first = Object.create(transform);
Object.assign(first, {
    pkg,
    name: "first",
    fn: (arr) => arr[0],
    inputs: "array",
    outputs: {
        computed: { type: "any", description: "First element" },
    },
});

export const last = Object.create(transform);
Object.assign(last, {
    pkg,
    name: "last",
    fn: (arr) => arr[arr.length - 1],
    inputs: "array",
    outputs: {
        computed: { type: "any", description: "Last element" },
    },
});

export const rest = Object.create(transform);
Object.assign(rest, {
    pkg,
    name: "rest",
    fn: (arr) => arr.slice(1),
    inputs: "array",
    outputs: {
        computed: { type: "array", description: "Array without first element" },
    },
});

export const butlast = Object.create(transform);
Object.assign(butlast, {
    pkg,
    name: "butlast",
    fn: (arr) => arr.slice(0, -1),
    inputs: "array",
    outputs: {
        computed: { type: "array", description: "Array without last element" },
    },
});

export const iota = Object.create(transform);
Object.assign(iota, {
    pkg,
    name: "iota",
    fn: (n) => Array.from({ length: n }, (_, i) => i),
    inputs: "number",
    outputs: {
        computed: { type: "array", description: "Array [0..n-1]" },
    },
});

export const nth = Object.create(partial);
Object.assign(nth, {
    pkg,
    name: "nth",
    requiredKeys: ["arr", "n"],
    fn: ({ arr, n }) => arr[n],
    inputs: {
        arr: { type: "array", description: "Array to index" },
        n: { type: "number", defaultFormValue: 0, description: "Index" },
    },
    outputs: {
        computed: { type: "any", description: "Element at index n" },
    },
});

export const concat = Object.create(partial);
Object.assign(concat, {
    pkg,
    name: "concat",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a.concat(b),
    inputs: {
        a: { type: "array", description: "First array" },
        b: { type: "array", description: "Second array" },
    },
    outputs: {
        computed: { type: "array", description: "Concatenated array" },
    },
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

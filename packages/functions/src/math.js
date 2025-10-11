import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/math";

export const inc = Object.create(transform);
Object.assign(inc, {
    pkg,
    name: "inc",
    fn: (x) => x + 1,
    inputs: "number",
    outputs: {
        computed: { type: "number", description: "Input + 1" }
    },
});

export const dec = Object.create(transform);
Object.assign(dec, {
    pkg,
    name: "dec",
    fn: (x) => x - 1,
    inputs: "number",
    outputs: {
        computed: { type: "number", description: "Input - 1" }
    },
});

export const neg = Object.create(transform);
Object.assign(neg, {
    pkg,
    name: "neg",
    fn: (x) => -x,
    inputs: "number",
    outputs: {
        computed: { type: "number", description: "-Input" }
    },
});

export const abs = Object.create(transform);
Object.assign(abs, {
    pkg,
    name: "abs",
    fn: (x) => Math.abs(x),
    inputs: "number",
    outputs: {
        computed: { type: "number", description: "Absolute value" }
    },
});

export const add = Object.create(partial);
Object.assign(add, {
    pkg,
    name: "add",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a + b,
    inputs: {
        a: { type: "number", defaultFormValue: 0, description: "First addend" },
        b: { type: "number", defaultFormValue: 0, description: "Second addend" }
    },
    outputs: {
        computed: { type: "number", description: "Sum of a and b" }
    },
});

export const sub = Object.create(partial);
Object.assign(sub, {
    pkg,
    name: "sub",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a - b,
    inputs: {
        a: { type: "number", defaultFormValue: 0, description: "Minuend" },
        b: { type: "number", defaultFormValue: 0, description: "Subtrahend" }
    },
    outputs: {
        computed: { type: "number", description: "Difference (a - b)" }
    },
});

export const mul = Object.create(partial);
Object.assign(mul, {
    pkg,
    name: "mul",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a * b,
    inputs: {
        a: { type: "number", defaultFormValue: 1, description: "First factor" },
        b: { type: "number", defaultFormValue: 1, description: "Second factor" }
    },
    outputs: {
        computed: { type: "number", description: "Product (a * b)" }
    },
});

export const div = Object.create(partial);
Object.assign(div, {
    pkg,
    name: "div",
    requiredKeys: ["a", "b"],
    fn: ({ a, b }) => a / b,
    inputs: {
        a: { type: "number", defaultFormValue: 0, description: "Dividend" },
        b: { type: "number", defaultFormValue: 1, description: "Divisor" }
    },
    outputs: {
        computed: { type: "number", description: "Quotient (a / b)" }
    },
});

export const sum = Object.create(partial);
Object.assign(sum, {
    pkg,
    name: "sum",
    fn: (args) => Object.values(args).reduce((a, b) => a + b, 0),
    inputs: {
        values: { type: "any", description: "Values to sum (variadic)" }
    },
    outputs: {
        computed: { type: "number", description: "Sum of all values" }
    },
});

export const average = Object.create(partial);
Object.assign(average, {
    pkg,
    name: "average",
    fn: (args) =>
        Object.values(args).reduce((a, b) => a + b, 0) /
        Object.values(args).length,
    inputs: {
        values: { type: "any", description: "Values to average (variadic)" }
    },
    outputs: {
        computed: { type: "number", description: "Average of all values" }
    },
});

export const product = Object.create(partial);
Object.assign(product, {
    pkg,
    name: "product",
    fn: (args) => Object.values(args).reduce((a, b) => a * b, 1),
    inputs: {
        values: { type: "any", description: "Values to multiply (variadic)" }
    },
    outputs: {
        computed: { type: "number", description: "Product of all values" }
    },
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

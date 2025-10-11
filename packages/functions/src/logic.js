import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/logic";

const and = Object.create(partial);
Object.assign(and, {
    pkg,
    name: "and",
    requiredKeys: ["a", "b"],
    fn({ a, b }) {
        return a && b;
    },
    inputs: {
        a: { type: "boolean", defaultFormValue: false, description: "First operand" },
        b: { type: "boolean", defaultFormValue: false, description: "Second operand" }
    },
    outputs: {
        computed: { type: "boolean", description: "Logical AND result" }
    },
});

const or = Object.create(partial);
Object.assign(or, {
    pkg,
    name: "or",
    requiredKeys: ["a", "b"],
    fn({ a, b }) {
        return a || b;
    },
    inputs: {
        a: { type: "boolean", defaultFormValue: false, description: "First operand" },
        b: { type: "boolean", defaultFormValue: false, description: "Second operand" }
    },
    outputs: {
        computed: { type: "boolean", description: "Logical OR result" }
    },
});

const xor = Object.create(partial);
Object.assign(xor, {
    pkg,
    name: "xor",
    requiredKeys: ["a", "b"],
    fn({ a, b }) {
        return !!(a ^ b);
    },
    inputs: {
        a: { type: "boolean", defaultFormValue: false, description: "First operand" },
        b: { type: "boolean", defaultFormValue: false, description: "Second operand" }
    },
    outputs: {
        computed: { type: "boolean", description: "Logical XOR result" }
    },
});

const every = Object.create(partial);
Object.assign(every, {
    pkg,
    name: "every",
    requiredKeys: ["args"],
    fn(args) {
        return Object.values(args).every(Boolean);
    },
    inputs: {
        args: { type: "any", description: "Values to check (variadic)" }
    },
    outputs: {
        computed: { type: "boolean", description: "True if all values are truthy" }
    },
});

const some = Object.create(partial);
Object.assign(some, {
    pkg,
    name: "some",
    requiredKeys: ["args"],
    fn(args) {
        return Object.values(args).some(Boolean);
    },
    inputs: {
        args: { type: "any", description: "Values to check (variadic)" }
    },
    outputs: {
        computed: { type: "boolean", description: "True if any value is truthy" }
    },
});

export default {
    gadgets: {
        and,
        or,
        xor,
        every,
        some,
    },
};

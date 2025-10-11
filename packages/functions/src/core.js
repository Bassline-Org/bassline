import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/core";
const identity = Object.create(transform);
Object.assign(identity, {
    pkg,
    name: "identity",
    fn(x) {
        return x;
    },
    inputs: "any",
    outputs: {
        computed: { type: "any", description: "Input value unchanged" }
    },
});

const constant = Object.create(transform);
Object.assign(constant, {
    pkg,
    name: "constant",
    fn(x) {
        return this.current();
    },
    inputs: "any",
    outputs: {
        computed: { type: "any", description: "Constant value (ignores input)" }
    },
});
const car = Object.create(transform);
Object.assign(car, {
    pkg,
    name: "car",
    fn([a, _]) {
        return a;
    },
    inputs: "array",
    outputs: {
        computed: { type: "any", description: "First element of pair" }
    },
});

const cdr = Object.create(transform);
Object.assign(cdr, {
    pkg,
    name: "cdr",
    fn([_, b]) {
        return b;
    },
    inputs: "array",
    outputs: {
        computed: { type: "any", description: "Second element of pair" }
    },
});

const not = Object.create(transform);
Object.assign(not, {
    pkg,
    name: "not",
    fn(x) {
        return !x;
    },
    inputs: "any",
    outputs: {
        computed: { type: "boolean", description: "Logical negation" }
    },
});

const obj = Object.create(partial);
Object.assign(obj, {
    pkg,
    name: "obj",
    fn({ key, value }) {
        return { [key]: value };
    },
    requiredKeys: ["key", "value"],
    inputs: {
        key: { type: "string", description: "Object key" },
        value: { type: "any", description: "Object value" }
    },
    outputs: {
        computed: { type: "object", description: "Object with single key-value pair" }
    },
});

const get = Object.create(partial);
Object.assign(get, {
    pkg,
    name: "get",
    fn({ obj, key }) {
        return obj[key];
    },
    requiredKeys: ["obj", "key"],
    inputs: {
        obj: { type: "object", description: "Object to access" },
        key: { type: "string", description: "Key to retrieve" }
    },
    outputs: {
        computed: { type: "any", description: "Value at key" }
    },
});

const cons = Object.create(partial);
Object.assign(cons, {
    pkg,
    name: "cons",
    fn({ car, cdr }) {
        return [car, cdr];
    },
    requiredKeys: ["car", "cdr"],
    inputs: {
        car: { type: "any", description: "First element" },
        cdr: { type: "any", description: "Second element" }
    },
    outputs: {
        computed: { type: "array", description: "Two-element array" }
    },
});

const gate = Object.create(partial);
Object.assign(gate, {
    pkg,
    name: "gate",
    fn({ control, value }) {
        return control ? value : undefined;
    },
    requiredKeys: ["control", "value"],
    inputs: {
        control: { type: "boolean", defaultFormValue: false, description: "Control signal" },
        value: { type: "any", description: "Value to pass through" }
    },
    outputs: {
        computed: { type: "any", description: "Value if control is true, undefined otherwise" }
    },
});

export default {
    gadgets: {
        identity,
        constant,
        car,
        cdr,
        not,
        obj,
        get,
        cons,
        gate,
    },
};

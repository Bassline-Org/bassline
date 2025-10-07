import { partial, transform } from "./functions.js";

const pkg = "@bassline/fn/core";
const identity = Object.create(transform);
Object.assign(identity, {
    pkg,
    name: "identity",
    fn(x) {
        return x;
    },
});

const constant = Object.create(transform);
Object.assign(constant, {
    pkg,
    name: "constant",
    fn(x) {
        return this.current();
    },
});

const car = Object.create(transform);
Object.assign(car, {
    pkg,
    name: "car",
    fn([a, _]) {
        return a;
    },
});

const cdr = Object.create(transform);
Object.assign(cdr, {
    pkg,
    name: "cdr",
    fn([_, b]) {
        return b;
    },
});

const not = Object.create(transform);
Object.assign(not, {
    pkg,
    name: "not",
    fn(x) {
        return !x;
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
});

const get = Object.create(partial);
Object.assign(get, {
    pkg,
    name: "get",
    fn({ obj, key }) {
        return obj[key];
    },
    requiredKeys: ["obj", "key"],
});

const cons = Object.create(partial);
Object.assign(cons, {
    pkg,
    name: "cons",
    fn({ car, cdr }) {
        return [car, cdr];
    },
    requiredKeys: ["car", "cdr"],
});

const gate = Object.create(partial);
Object.assign(gate, {
    pkg,
    name: "gate",
    fn({ control, value }) {
        return control ? value : undefined;
    },
    requiredKeys: ["control", "value"],
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

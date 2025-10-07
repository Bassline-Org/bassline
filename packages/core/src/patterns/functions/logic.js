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
});

const or = Object.create(partial);
Object.assign(or, {
    pkg,
    name: "or",
    requiredKeys: ["a", "b"],
    fn({ a, b }) {
        return a || b;
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
});

const every = Object.create(partial);
Object.assign(every, {
    pkg,
    name: "every",
    requiredKeys: ["args"],
    fn(args) {
        return Object.values(args).every(Boolean);
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

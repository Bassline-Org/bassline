import { ops } from "../extensions/ops.js";

const { def } = ops();
const { unary, named, varargs } = def;

export function installLogicOps() {
    named({ name: "and", fn: ({ a, b }) => a && b, requiredKeys: ["a", "b"] });
    named({ name: "or", fn: ({ a, b }) => a || b, requiredKeys: ["a", "b"] });
    named({
        name: "xor",
        fn: ({ a, b }) => !!(a ^ b),
        requiredKeys: ["a", "b"],
    });

    varargs({
        name: "every",
        fn: (args) => Object.values(args).every(Boolean),
    });
    varargs({
        name: "some",
        fn: (args) => Object.values(args).some(Boolean),
    });
}

export default {
    and({ a, b }) {
        return a && b;
    },
    or({ a, b }) {
        return a || b;
    },
    xor({ a, b }) {
        return !!(a ^ b);
    },
    every(args) {
        return Object.values(args).every(Boolean);
    },
    some(args) {
        return Object.values(args).some(Boolean);
    },
};

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

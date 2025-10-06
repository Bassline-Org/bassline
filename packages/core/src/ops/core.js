import { ops } from "../extensions/ops.js";

const { def } = ops();
const { unary, named, varargs } = def;

export function installCoreOps() {
    unary({ name: "identity", fn: (x) => x });
    unary({ name: "constant", fn: (x) => () => x });
    unary({ name: "car", fn: ([a, _]) => a });
    unary({ name: "cdr", fn: ([_, b]) => b });
    unary({ name: "not", fn: (x) => !x });

    named({
        name: "obj",
        fn: ({ key, value }) => ({ [key]: value }),
        requiredKeys: ["key", "value"],
    });
    named({
        name: "get",
        fn: ({ obj, key }) => obj[key],
        requiredKeys: ["obj", "key"],
    });

    named({
        name: "cons",
        fn: ({ a, b }) => [a, b],
        requiredKeys: ["a", "b"],
    });
    named({
        name: "switch",
        fn: ({ control, value }) => control ? value : undefined,
        requiredKeys: ["control", "value"],
    });
}

// src/extensions/ops/math.js - Basic arithmetic
export function installMathOps() {
    unary({ name: "inc", fn: (x) => x + 1 });
    unary({ name: "dec", fn: (x) => x - 1 });
    unary({ name: "neg", fn: (x) => -x });
    unary({ name: "abs", fn: (x) => Math.abs(x) });

    named({ name: "add", fn: ({ a, b }) => a + b, requiredKeys: ["a", "b"] });
    named({ name: "sub", fn: ({ a, b }) => a - b, requiredKeys: ["a", "b"] });
    named({ name: "mul", fn: ({ a, b }) => a * b, requiredKeys: ["a", "b"] });
    named({ name: "div", fn: ({ a, b }) => a / b, requiredKeys: ["a", "b"] });

    varargs({
        name: "sum",
        fn: (args) => Object.values(args).reduce((a, b) => a + b, 0),
    });
    varargs({
        name: "average",
        fn: (args) =>
            Object.values(args).reduce((a, b) => a + b, 0) /
            Object.values(args).length,
    });
    varargs({
        name: "product",
        fn: (args) => Object.values(args).reduce((a, b) => a * b, 1),
    });
}

// src/extensions/ops/logic.js - Boolean operations
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

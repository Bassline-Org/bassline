import { ops } from "../extensions/ops.js";

const { def } = ops();
const { unary, named, varargs } = def;

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

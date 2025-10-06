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

export default {
    inc(x) {
        return x + 1;
    },
    dec(x) {
        return x - 1;
    },
    neg(x) {
        return -x;
    },
    abs(x) {
        return Math.abs(x);
    },
    add({ a, b }) {
        return a + b;
    },
    sub({ a, b }) {
        return a - b;
    },
    mul({ a, b }) {
        return a * b;
    },
    div({ a, b }) {
        return a / b;
    },
    sum(args) {
        return Object.values(args).reduce((a, b) => a + b, 0);
    },
    average(args) {
        return Object.values(args).reduce((a, b) => a + b, 0) /
            Object.values(args).length;
    },
    product(args) {
        return Object.values(args).reduce((a, b) => a * b, 1);
    },
};

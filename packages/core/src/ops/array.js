import { ops } from "../extensions/ops.js";

const { def } = ops();
const { unary, named, varargs } = def;

export function installArrayOps() {
    unary({ name: "asArray", fn: (arr) => Array.isArray(arr) ? arr : [arr] });
    unary({ name: "length", fn: (arr) => arr.length });
    unary({ name: "first", fn: (arr) => arr[0] });
    unary({ name: "last", fn: (arr) => arr[arr.length - 1] });
    unary({ name: "rest", fn: (arr) => arr.slice(1) });
    unary({ name: "butlast", fn: (arr) => arr.slice(0, -1) });
    unary({ name: "iota", fn: (n) => Array.from({ length: n }, (_, i) => i) });

    named({ name: "nth", fn: (arr, n) => arr[n], requiredKeys: ["arr", "n"] });

    named({
        name: "concat",
        fn: ({ a, b }) => a.concat(b),
        requiredKeys: ["a", "b"],
    });
}

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

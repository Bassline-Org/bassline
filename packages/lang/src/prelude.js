import types from "./prelude/types.js";
import methods from "./prelude/actions.js";
import { Method, NativeFn } from "./datatypes/functions.js";
import { evaluate } from "./eval.js";
import { parse } from "./parser.js";
import { Context } from "./datatypes/context.js";
import datatypes from "./datatypes/index.js";

const prelude = {
    "do": new NativeFn(["a"], ([a], stream, context) => {
        return evaluate(a.items, context);
    }),
    "print": Method.unary("print"),
};

export function installPrelude(context) {
    context.setMany(datatypes);
    context.setMany(types);
    context.setMany(methods);
    context.setMany(prelude);
}

const example = `
    a: 456
    b: "123"
    c: append b a
    print type? c
    print c
    result: + (+ 10 c) 15
    print result
    print type? result
`;

const parsed = parse(example);
const context = new Context();
installPrelude(context);
evaluate(parsed, context);

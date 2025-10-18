import types from "./prelude/types.js";
import actions from "./prelude/actions.js";
import { Action, NativeFn } from "./datatypes/functions.js";
import { evaluate } from "./eval.js";
import { parse } from "./parser.js";
import { Context } from "./datatypes/context.js";
import datatypes from "./datatypes/index.js";

const prelude = {
    "do": new NativeFn(["a"], ([a], stream, context) => {
        return evaluate(a.items, context);
    }),
    "print": Action.unary("print"),
};

export function installPrelude(context) {
    context.setMany(datatypes);
    context.setMany(types);
    context.setMany(actions);
    context.setMany(prelude);
}

const example = `
    a: make context!
`;

const parsed = parse(example);
const context = new Context();
installPrelude(context);
evaluate(parsed, context);

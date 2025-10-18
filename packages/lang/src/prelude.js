import types from "./prelude/types.js";
import actions from "./prelude/actions.js";
import { NativeFn } from "./datatypes/functions.js";
import { evaluate } from "./eval.js";
import { parse } from "./parser.js";
import { Context } from "./datatypes/context.js";
import datatypes from "./datatypes/index.js";

const prelude = {
    "do": new NativeFn(["a"], ([a], stream, context) => {
        return evaluate(a.items, context);
    }),
    "print": new NativeFn(["a"], ([a], stream, context) => {
        console.log(a);
        return a;
    }),
};

export function installPrelude(context) {
    context.setMany(datatypes);
    context.setMany(types);
    context.setMany(actions);
    context.setMany(prelude);
}

const example = `
    a: make string!
    print string!
    print a
    append a " world"
`;

const parsed = parse(example);
const context = new Context();
installPrelude(context);
console.log(context);
const result = evaluate(parsed, context);
//console.log(result);

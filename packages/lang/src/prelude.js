import types from "./prelude/types.js";
import methods from "./prelude/actions.js";
import datatypes, { Context } from "./datatypes/index.js";
import { evaluate } from "./evaluator.js";
import { parse } from "./parser.js";
import doPrelude from "./prelude/do.js";
import print from "./prelude/print.js";

export function installPrelude(context) {
    context.setMany({
        ...datatypes,
        ...types,
        ...methods,
        ...doPrelude,
        ...print,
    });
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
